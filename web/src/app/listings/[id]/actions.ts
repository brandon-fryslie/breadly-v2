"use server";

// Listing-detail server actions. Single enforcer for every state change on
// a listing or its claims — UI never updates rows directly.
// [LAW:single-enforcer]
//
// Three baker-side and two eater-side transitions all share the same shape:
// read id from form → run one targeted UPDATE (precondition encoded in the
// WHERE clause) → optional cascade → revalidate. Variability lives in
// values and predicates, not in whether work runs.
// [LAW:dataflow-not-control-flow]

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { listings } from "@/db/schema";

// --- Baker actions -------------------------------------------------------

type Patch = Partial<typeof listings.$inferInsert>;

async function applyBakerPatch(formData: FormData, patch: Patch): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/baker");

  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/listings/${id}`);

  // Scope by listing id AND owner so a forged uuid can't mutate someone
  // else's row. Not-found and not-owner collapse to the same 0-row response.
  // [LAW:no-defensive-null-guards]
  const result = await db
    .update(listings)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(listings.id, id), eq(listings.bakerId, userId)))
    .returning({ id: listings.id });

  if (result.length === 0) {
    throw new Error(
      `listing action: no row matched id=${id} bakerId=${userId} (not owner or missing)`,
    );
  }

  // Cascade: any active claim on a listing whose status is now 'cancelled'
  // is itself cancelled. Runs after every baker action; the predicate (the
  // listing's current status) decides whether any rows actually mutate.
  // Same code path on every action — variability lives in the data, not in
  // an `if` branch. [LAW:dataflow-not-control-flow]
  await db.execute(sql`
    UPDATE claims c
    SET status = 'cancelled_by_baker',
        cancelled_at = NOW(),
        updated_at = NOW()
    FROM listings l
    WHERE c.listing_id = l.id
      AND l.id = ${id}
      AND l.status = 'cancelled'
      AND c.status = 'active'
  `);

  revalidatePath(`/listings/${id}`);
  revalidatePath("/baker");
}

export async function markOutOfOven(formData: FormData): Promise<void> {
  await applyBakerPatch(formData, {
    status: "ready",
    outOfOvenAt: new Date(),
  });
}

export async function markSoldOut(formData: FormData): Promise<void> {
  await applyBakerPatch(formData, {
    status: "expired",
    qtyAvailable: 0,
  });
}

export async function pullListing(formData: FormData): Promise<void> {
  await applyBakerPatch(formData, {
    status: "cancelled",
  });
}

// --- Eater actions -------------------------------------------------------

// 4-digit numeric code, zero-padded. Used by the baker→eater handoff in
// breadly-eater-b77.3. Codes are only meaningful within the (baker, eater,
// listing) triple — no global uniqueness needed.
function generatePickupCode(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

export async function createClaim(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/");

  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/listings/${id}`);

  // Idempotent: an existing active claim short-circuits the rest. Same
  // page response either way — the eater sees the pickup code revealed.
  const existing = await db.execute<{ id: string }>(sql`
    SELECT id FROM claims
    WHERE listing_id = ${id} AND eater_id = ${userId} AND status = 'active'
    LIMIT 1
  `);

  // The atomic decrement IS the claimability gate. Concurrent claimers
  // compete on the same row; only those that observe qty_available > 0
  // succeed. No separate pre-flight read; the data does the gating.
  // [LAW:dataflow-not-control-flow]
  const updated =
    existing.length > 0
      ? []
      : await db.execute<{ id: string }>(sql`
          UPDATE listings
          SET qty_available = qty_available - 1,
              status = CASE
                WHEN qty_available - 1 = 0 THEN 'claimed'::listing_status
                ELSE status
              END,
              updated_at = NOW()
          WHERE id = ${id}
            AND status = 'ready'
            AND qty_available > 0
            AND baker_id <> ${userId}
          RETURNING id
        `);

  if (existing.length === 0 && updated.length === 0) {
    throw new Error(
      `createClaim: listing ${id} not claimable by ${userId} (status, qty, or owner mismatch)`,
    );
  }

  if (existing.length === 0) {
    await db.execute(sql`
      INSERT INTO claims (listing_id, eater_id, qty, status, pickup_code)
      VALUES (${id}, ${userId}, 1, 'active', ${generatePickupCode()})
    `);
  }

  revalidatePath(`/listings/${id}`);
  revalidatePath("/me");
  revalidatePath("/baker");
}

export async function cancelClaimByEater(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/");

  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/listings/${id}`);

  const cancelled = await db.execute<{ id: string; qty: number }>(sql`
    UPDATE claims
    SET status = 'cancelled_by_eater',
        cancelled_at = NOW(),
        updated_at = NOW()
    WHERE listing_id = ${id}
      AND eater_id = ${userId}
      AND status = 'active'
    RETURNING id, qty
  `);

  if (cancelled.length === 0) {
    throw new Error(
      `cancelClaimByEater: no active claim for ${userId} on listing ${id}`,
    );
  }

  // Restore inventory; if the listing was fully booked into 'claimed', flip
  // it back to 'ready'. Other listing states (cancelled, expired, picked_up)
  // are never reachable from an active claim, so the CASE leaves them alone.
  const restoredQty = cancelled.reduce((acc, c) => acc + c.qty, 0);
  await db.execute(sql`
    UPDATE listings
    SET qty_available = qty_available + ${restoredQty},
        status = CASE
          WHEN status = 'claimed' THEN 'ready'::listing_status
          ELSE status
        END,
        updated_at = NOW()
    WHERE id = ${id}
  `);

  revalidatePath(`/listings/${id}`);
  revalidatePath("/me");
  revalidatePath("/baker");
}

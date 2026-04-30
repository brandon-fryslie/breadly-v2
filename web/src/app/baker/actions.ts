"use server";

// Baker-side handoff actions. Two transitions, same shape as every other
// state-change in this codebase: read inputs → run one targeted UPDATE
// (precondition encoded in the WHERE clause) → consolidate listing
// status → revalidate. [LAW:single-enforcer] [LAW:dataflow-not-control-flow]
//
// Direction of handoff: eater shows the 4-digit code, baker types it.
// Mirrors the physical exchange and keeps the entry surface on the page
// the baker is already managing seats from. The fallback action lets the
// baker mark a specific claim picked-up without a code (e.g. eater is
// already gone, code wasn't exchanged) — audit-log epic
// (breadly-admin-5h2.6) will record which path was taken.

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { consolidateListingPickedUp } from "@/app/listings/[id]/queries";

const PICKUP_CODE_RE = /^\d{4}$/;

export async function confirmPickupByCode(formData: FormData): Promise<void> {
  const listingId = String(formData.get("listingId") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  if (!listingId) redirect("/baker");

  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/baker");

  // Bad-code shape rejects without a DB round-trip. The DB itself is the
  // backstop: a four-digit string that doesn't match any active claim
  // returns 0 rows and surfaces as the same error to the operator.
  if (!PICKUP_CODE_RE.test(code)) {
    throw new Error("confirmPickupByCode: invalid pickup code format");
  }

  // Single UPDATE joins ownership + match + active-status into one
  // predicate. A forged listing id, wrong code, or already-picked claim
  // all collapse to 0 rows — caller can't tell them apart, by design.
  // [LAW:no-defensive-null-guards]
  const picked = await db.execute<{ id: string }>(sql`
    UPDATE claims c
    SET status = 'picked_up',
        picked_up_at = NOW(),
        updated_at = NOW()
    FROM listings l
    WHERE c.listing_id = l.id
      AND l.id = ${listingId}
      AND l.baker_id = ${userId}
      AND c.pickup_code = ${code}
      AND c.status = 'active'
    RETURNING c.id
  `);

  if (picked.length === 0) {
    throw new Error(
      `confirmPickupByCode: no active claim matched listing=${listingId} code=${code} for baker=${userId}`,
    );
  }

  await consolidateListingPickedUp(listingId);

  revalidatePath("/baker");
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/me");
}

export async function markPickedUpByBakerSelf(
  formData: FormData,
): Promise<void> {
  const claimId = String(formData.get("claimId") ?? "");
  if (!claimId) redirect("/baker");

  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/baker");

  // Same join-on-ownership shape as the code path. Identifies the claim by
  // id (rendered into the per-row form) instead of by code.
  const picked = await db.execute<{ id: string; listing_id: string }>(sql`
    UPDATE claims c
    SET status = 'picked_up',
        picked_up_at = NOW(),
        updated_at = NOW()
    FROM listings l
    WHERE c.listing_id = l.id
      AND c.id = ${claimId}
      AND l.baker_id = ${userId}
      AND c.status = 'active'
    RETURNING c.id, c.listing_id
  `);

  if (picked.length === 0) {
    throw new Error(
      `markPickedUpByBakerSelf: no active claim matched id=${claimId} for baker=${userId}`,
    );
  }

  await consolidateListingPickedUp(picked[0].listing_id);

  revalidatePath("/baker");
  revalidatePath(`/listings/${picked[0].listing_id}`);
  revalidatePath("/me");
}

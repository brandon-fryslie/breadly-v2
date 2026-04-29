"use server";

// Listing-detail baker actions. Single enforcer for status transitions on a
// baker's own listings — UI never updates the row directly.
// [LAW:single-enforcer]
//
// Every action re-checks auth and scopes the SQL UPDATE by both the listing
// id AND the bakerId so a forged uuid can't mutate someone else's row. A
// non-match returns 0 rows and the action throws — there is no degenerate
// "soft failure" UI because the page already gates owner-only buttons on
// userId === bakerId. [LAW:no-defensive-null-guards]
//
// Same shape for all three transitions: read id from form → run one targeted
// UPDATE → revalidate. Variability lives in the SET clause, not in whether
// the work runs. [LAW:dataflow-not-control-flow]

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { listings } from "@/db/schema";

type Patch = Partial<typeof listings.$inferInsert>;

async function applyPatch(formData: FormData, patch: Patch): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/baker");

  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/listings/${id}`);

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

  revalidatePath(`/listings/${id}`);
  revalidatePath("/baker");
}

export async function markOutOfOven(formData: FormData): Promise<void> {
  await applyPatch(formData, {
    status: "ready",
    outOfOvenAt: new Date(),
  });
}

export async function markSoldOut(formData: FormData): Promise<void> {
  await applyPatch(formData, {
    status: "expired",
    qtyAvailable: 0,
  });
}

export async function pullListing(formData: FormData): Promise<void> {
  await applyPatch(formData, {
    status: "cancelled",
  });
}

"use server";

// Capability mutations. The server action is the single enforcer that
// flips a capability + creates the supporting profile row(s) in one
// transaction. UI never sets capabilities directly. [LAW:single-enforcer]

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { bakerProfiles, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "baker";
}

export async function claimBaker(formData: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/me");

  const bakeryName = (formData.get("bakeryName") as string | null)?.trim();
  if (!bakeryName) {
    // HTML `required` enforces this client-side; if we get here the
    // request bypassed the form, so failing loudly is correct.
    throw new Error("Bakery name is required");
  }

  const me = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { displayName: true },
  });
  if (!me) {
    // Webhook race: Clerk just signed the user up but the user.created
    // mirror hasn't landed. The /me page renders a "setting up" placeholder
    // in this state; if the action fires anyway, fail loudly so the user
    // retries rather than getting a silent half-success.
    throw new Error("Account is still being provisioned — refresh and try again.");
  }

  const baseSlug = slugify(bakeryName);
  // unique slug — append short suffix from user id if collision
  const suffix = userId.slice(-6).toLowerCase();
  const slug = `${baseSlug}-${suffix}`;

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ canBake: true, updatedAt: sql`now()` })
      .where(eq(users.id, userId));

    await tx
      .insert(bakerProfiles)
      .values({
        userId,
        slug,
        bakeryName,
        bio: null,
      })
      .onConflictDoNothing({ target: bakerProfiles.userId });
  });

  revalidatePath("/me");
  revalidatePath("/baker");
  redirect("/baker");
}

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

export type ClaimBakerFields =
  | "bakeryName"
  | "slug"
  | "neighborhood"
  | "bio"
  | "coverPhotoUrl"
  | "pickupWindowText";

export type ClaimBakerState = {
  fieldErrors: Partial<Record<ClaimBakerFields, string>>;
  values: Record<ClaimBakerFields, string>;
  generalError?: string;
};

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,46}[a-z0-9]$/;

function deriveSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function claimBaker(
  _prev: ClaimBakerState,
  formData: FormData,
): Promise<ClaimBakerState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/me");

  const raw: Record<ClaimBakerFields, string> = {
    bakeryName: ((formData.get("bakeryName") as string) ?? "").trim(),
    slug: ((formData.get("slug") as string) ?? "").trim().toLowerCase(),
    neighborhood: ((formData.get("neighborhood") as string) ?? "").trim(),
    bio: ((formData.get("bio") as string) ?? "").trim(),
    coverPhotoUrl: ((formData.get("coverPhotoUrl") as string) ?? "").trim(),
    pickupWindowText: ((formData.get("pickupWindowText") as string) ?? "").trim(),
  };

  // Slug derivation: user-supplied wins; otherwise derive from bakery name.
  // Either way the same validator runs against the resulting string —
  // variability lives in the value, not in branching validation paths.
  // [LAW:dataflow-not-control-flow]
  const slug = raw.slug || deriveSlug(raw.bakeryName);
  const values: Record<ClaimBakerFields, string> = { ...raw, slug };

  const fieldErrors: ClaimBakerState["fieldErrors"] = {};

  if (!raw.bakeryName) fieldErrors.bakeryName = "Required";
  else if (raw.bakeryName.length > 80) fieldErrors.bakeryName = "Max 80 characters";

  if (!slug) fieldErrors.slug = "Required";
  else if (!SLUG_RE.test(slug))
    fieldErrors.slug =
      "Lowercase letters, numbers, and hyphens only (2–48 chars; no leading/trailing hyphen)";

  if (raw.neighborhood.length > 60) fieldErrors.neighborhood = "Max 60 characters";
  if (raw.bio.length > 500) fieldErrors.bio = "Max 500 characters";
  if (raw.pickupWindowText.length > 200)
    fieldErrors.pickupWindowText = "Max 200 characters";

  if (raw.coverPhotoUrl) {
    try {
      const u = new URL(raw.coverPhotoUrl);
      if (u.protocol !== "https:" && u.protocol !== "http:")
        fieldErrors.coverPhotoUrl = "Must be an http(s) URL";
    } catch {
      fieldErrors.coverPhotoUrl = "Not a valid URL";
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values };

  // Webhook race: Clerk just signed the user up but the user.created mirror
  // hasn't landed. Surface a recoverable error rather than a 500.
  const me = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { canBake: true },
  });
  if (!me) {
    return {
      fieldErrors: {},
      values,
      generalError:
        "Account is still being provisioned — refresh and try again.",
    };
  }
  if (me.canBake) {
    // Idempotent: already claimed (likely a stale form). Send to /baker.
    redirect("/baker");
  }

  // [LAW:one-source-of-truth] The DB unique index on baker_profiles.slug is
  // authoritative. The pre-check is for nice errors; the constraint catches
  // races. Either failure flows back as a slug field error.
  const collision = await db.query.bakerProfiles.findFirst({
    where: eq(bakerProfiles.slug, slug),
    columns: { userId: true },
  });
  if (collision) {
    return {
      fieldErrors: { slug: "That URL is already taken — pick another." },
      values,
    };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ canBake: true, updatedAt: sql`now()` })
        .where(eq(users.id, userId));

      await tx.insert(bakerProfiles).values({
        userId,
        slug,
        bakeryName: raw.bakeryName,
        neighborhood: raw.neighborhood || null,
        bio: raw.bio || null,
        coverPhotoUrl: raw.coverPhotoUrl || null,
        pickupWindowText: raw.pickupWindowText || null,
      });
    });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505") {
      return {
        fieldErrors: { slug: "That URL was just claimed by someone else — pick another." },
        values,
      };
    }
    throw err;
  }

  revalidatePath("/me");
  revalidatePath("/baker");
  redirect("/baker");
}

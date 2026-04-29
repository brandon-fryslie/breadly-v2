"use server";

// Post-a-loaf server action. Single enforcer for listing creation:
// validates input, snapshots baker location, atomically writes
// listings + listing_tags. UI never inserts listings directly.
// [LAW:single-enforcer]

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { bakerProfiles, listings, listingTags, tags, users } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

export type CreateListingFields =
  | "name"
  | "blurb"
  | "photoUrl"
  | "priceDollars"
  | "qty"
  | "readyAt"
  | "tagIds";

export type CreateListingState = {
  fieldErrors: Partial<Record<CreateListingFields, string>>;
  values: {
    name: string;
    blurb: string;
    photoUrl: string;
    priceDollars: string;
    qty: string;
    readyAt: string;
    tagIds: string[];
  };
  generalError?: string;
};

function parseInteger(input: string, opts: { min?: number; max?: number } = {}): number | null {
  if (input.trim() === "") return null;
  const n = Number(input);
  if (!Number.isInteger(n)) return null;
  if (opts.min !== undefined && n < opts.min) return null;
  if (opts.max !== undefined && n > opts.max) return null;
  return n;
}

export async function createListing(
  _prev: CreateListingState,
  formData: FormData,
): Promise<CreateListingState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/baker/new");

  const tagIdsRaw = formData.getAll("tagIds").map(String);
  const raw = {
    name: ((formData.get("name") as string) ?? "").trim(),
    blurb: ((formData.get("blurb") as string) ?? "").trim(),
    photoUrl: ((formData.get("photoUrl") as string) ?? "").trim(),
    priceDollars: ((formData.get("priceDollars") as string) ?? "").trim(),
    qty: ((formData.get("qty") as string) ?? "").trim(),
    // The client converts the datetime-local picker into a UTC ISO string
    // before submit. Server treats this as the only readyAt source so the
    // semantics don't depend on server timezone (Cloud Run = UTC; dev = local).
    readyAt: ((formData.get("readyAt") as string) ?? "").trim(),
    tagIds: tagIdsRaw,
  };

  const values: CreateListingState["values"] = { ...raw };
  const fieldErrors: CreateListingState["fieldErrors"] = {};

  if (!raw.name) fieldErrors.name = "Required";
  else if (raw.name.length > 80) fieldErrors.name = "Max 80 characters";

  if (raw.blurb.length > 400) fieldErrors.blurb = "Max 400 characters";

  if (raw.photoUrl) {
    try {
      const u = new URL(raw.photoUrl);
      if (u.protocol !== "https:" && u.protocol !== "http:")
        fieldErrors.photoUrl = "Must be an http(s) URL";
    } catch {
      fieldErrors.photoUrl = "Not a valid URL";
    }
  }

  // Price input is dollars (with optional decimal). Convert to integer cents.
  let priceCents: number | null = null;
  if (raw.priceDollars === "") {
    fieldErrors.priceDollars = "Required";
  } else {
    const dollars = Number(raw.priceDollars);
    if (!Number.isFinite(dollars) || dollars < 0) {
      fieldErrors.priceDollars = "Enter a non-negative number";
    } else {
      priceCents = Math.round(dollars * 100);
      if (priceCents > 100_000_00) fieldErrors.priceDollars = "Too high";
    }
  }

  const qty = parseInteger(raw.qty, { min: 1, max: 999 });
  if (qty === null) fieldErrors.qty = "Whole number, 1 or more";

  let readyAtDate: Date | null = null;
  if (!raw.readyAt) {
    fieldErrors.readyAt = "Required";
  } else {
    const d = new Date(raw.readyAt);
    if (Number.isNaN(d.getTime())) fieldErrors.readyAt = "Invalid date";
    else readyAtDate = d;
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values };

  // [LAW:dataflow-not-control-flow] capability + profile fetched once;
  // missing rows flow as data (null) into a single error path.
  const profile = await db.query.bakerProfiles.findFirst({
    where: eq(bakerProfiles.userId, userId),
  });
  const me = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { canBake: true, location: true },
  });
  if (!me?.canBake || !profile) {
    return {
      fieldErrors: {},
      values,
      generalError:
        "You need to claim baker capability before posting a loaf.",
    };
  }
  if (!me.location) {
    return {
      fieldErrors: {},
      values,
      generalError:
        "Your account is missing an address — set one before posting a loaf.",
    };
  }

  // Validate tag ids exist. Reject the whole submission on any unknown id —
  // an unknown id either means tampering or a tag was deleted underneath
  // the baker; either way the listing should not partially link.
  if (raw.tagIds.length > 0) {
    const known = await db
      .select({ id: tags.id })
      .from(tags)
      .where(inArray(tags.id, raw.tagIds));
    if (known.length !== raw.tagIds.length) {
      return {
        fieldErrors: { tagIds: "One or more tags are no longer valid" },
        values,
      };
    }
  }

  const now = new Date();
  const status: "ready" | "scheduled" =
    readyAtDate!.getTime() <= now.getTime() ? "ready" : "scheduled";
  const outOfOvenAt = status === "ready" ? readyAtDate : null;
  const expiresAt = new Date(
    readyAtDate!.getTime() + profile.listingCutoffHours * 60 * 60 * 1000,
  );

  await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(listings)
      .values({
        bakerId: userId,
        name: raw.name,
        blurb: raw.blurb || null,
        photoUrl: raw.photoUrl || null,
        priceCents: priceCents!,
        qtyTotal: qty!,
        qtyAvailable: qty!,
        status,
        readyAt: readyAtDate!,
        outOfOvenAt,
        expiresAt,
        location: { x: me.location!.x, y: me.location!.y },
      })
      .returning({ id: listings.id });

    if (raw.tagIds.length > 0) {
      await tx.insert(listingTags).values(
        raw.tagIds.map((tagId) => ({ listingId: inserted.id, tagId })),
      );
    }
  });

  revalidatePath("/baker");
  redirect("/baker");
}


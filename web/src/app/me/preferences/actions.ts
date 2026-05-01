"use server";

// Eater preferences editor. The single enforcer for the eater_preferences
// row: every save runs the same upsert, so first-visit creation and
// subsequent edits flow through one path. [LAW:single-enforcer]
// [LAW:dataflow-not-control-flow]
//
// Form inputs are flat slug arrays + a radius integer + an optional
// neighborhood slug. Neighborhood selection writes through to the user's
// `location` (centroid lookup) and `city`; this is what powers the feed's
// PostGIS radius queries today.

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { eaterPreferences, users } from "@/db/schema";
import { TAGS, NEIGHBORHOODS } from "@/db/seed-data";

const TAG_SLUGS = new Set(TAGS.map((t) => t.slug));
const NEIGHBORHOOD_BY_SLUG = new Map(NEIGHBORHOODS.map((n) => [n.slug, n]));

const RADIUS_MIN = 1;
const RADIUS_MAX = 10;

export type PreferencesFields = "include" | "exclude" | "radiusMi" | "neighborhood";

export type PreferencesState = {
  fieldErrors: Partial<Record<PreferencesFields, string>>;
  values: {
    include: string[];
    exclude: string[];
    radiusMi: number;
    neighborhood: string;
  };
  generalError?: string;
  saved?: boolean;
};

function readSlugList(formData: FormData, name: string): string[] {
  // FormData.getAll returns every checked checkbox with this name. Filter
  // to known slugs so a tampered POST can't insert garbage; the same input
  // shape (deduped, validated array) flows through whether 0 or N tags
  // are checked. [LAW:dataflow-not-control-flow]
  const raw = formData.getAll(name).map((v) => String(v));
  const seen = new Set<string>();
  for (const slug of raw) if (TAG_SLUGS.has(slug)) seen.add(slug);
  return [...seen].sort();
}

export async function savePreferences(
  _prev: PreferencesState,
  formData: FormData,
): Promise<PreferencesState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/me/preferences");

  const include = readSlugList(formData, "include");
  const exclude = readSlugList(formData, "exclude");
  const neighborhood = String(formData.get("neighborhood") ?? "").trim();
  const radiusRaw = String(formData.get("radiusMi") ?? "").trim();
  const radiusMi = Number.parseInt(radiusRaw, 10);

  const values: PreferencesState["values"] = {
    include,
    exclude,
    radiusMi: Number.isFinite(radiusMi) ? radiusMi : 2,
    neighborhood,
  };

  const fieldErrors: PreferencesState["fieldErrors"] = {};

  if (!Number.isFinite(radiusMi) || radiusMi < RADIUS_MIN || radiusMi > RADIUS_MAX) {
    fieldErrors.radiusMi = `Pick a radius between ${RADIUS_MIN} and ${RADIUS_MAX} miles`;
  }

  if (neighborhood && !NEIGHBORHOOD_BY_SLUG.has(neighborhood)) {
    fieldErrors.neighborhood = "Pick a neighborhood from the list";
  }

  // [LAW:no-mode-explosion] Include and exclude operate on the same tag
  // catalog by design; collisions are the user telling us they're confused.
  // Surface as a field error so the form can show *which* tag conflicts.
  const conflict = include.find((slug) => exclude.includes(slug));
  if (conflict) {
    fieldErrors.include = `"${conflict}" can't be in both Include and Exclude`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, values };
  }

  // Webhook race: same recoverable failure mode the claim-baker action
  // uses. The eater_preferences FK to users.id would 23503 otherwise.
  const me = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true },
  });
  if (!me) {
    return {
      fieldErrors: {},
      values,
      generalError:
        "Account is still being provisioned — refresh and try again.",
    };
  }

  const hood = neighborhood ? NEIGHBORHOOD_BY_SLUG.get(neighborhood)! : null;

  await db.transaction(async (tx) => {
    // [LAW:single-enforcer] One upsert covers first-visit creation and
    // every subsequent edit. The DB picks INSERT vs UPDATE by primary-key
    // conflict; the action runs the same SQL either way.
    await tx
      .insert(eaterPreferences)
      .values({
        userId,
        includeTagSlugs: include,
        excludeTagSlugs: exclude,
        radiusMi: values.radiusMi,
      })
      .onConflictDoUpdate({
        target: eaterPreferences.userId,
        set: {
          includeTagSlugs: include,
          excludeTagSlugs: exclude,
          radiusMi: values.radiusMi,
          updatedAt: sql`now()`,
        },
      });

    // Neighborhood is the eater's anchor for radius queries. Selecting a
    // neighborhood writes both the labelled city and the centroid point
    // that PostGIS reads. Leaving it blank is allowed (browse-only users)
    // and is a no-op on the location.
    if (hood) {
      await tx
        .update(users)
        .set({
          city: "Boulder",
          location: { x: hood.centroid.lng, y: hood.centroid.lat },
          updatedAt: sql`now()`,
        })
        .where(eq(users.id, userId));
    }
  });

  revalidatePath("/me/preferences");
  revalidatePath("/me");
  revalidatePath("/a");

  return { fieldErrors: {}, values, saved: true };
}

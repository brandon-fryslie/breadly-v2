// /me/preferences — eater preferences editor (W16).
//
// Loads the current eater_preferences row (or defaults if first visit) and
// the user's anchor neighborhood (derived from users.location nearest to a
// known centroid), then renders the editor. The form posts to a single
// server action that upserts the row.

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { eaterPreferences, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { TAGS, NEIGHBORHOODS } from "@/db/seed-data";
import { PreferencesForm } from "./preferences-form";

export const dynamic = "force-dynamic";

function nearestNeighborhoodSlug(
  loc: { x: number; y: number } | null | undefined,
): string {
  if (!loc) return "";
  // Pick whichever NEIGHBORHOODS centroid the user's location matches
  // exactly (set via this same editor) or is closest to. Same code path
  // every call. [LAW:dataflow-not-control-flow]
  let bestSlug = "";
  let bestSq = Number.POSITIVE_INFINITY;
  for (const n of NEIGHBORHOODS) {
    const dLat = n.centroid.lat - loc.y;
    const dLng = n.centroid.lng - loc.x;
    const sq = dLat * dLat + dLng * dLng;
    if (sq < bestSq) {
      bestSq = sq;
      bestSlug = n.slug;
    }
  }
  // ~0.001° ≈ 100m: only attribute the user to a neighborhood if their
  // location is unambiguously inside one. Otherwise leave blank so the
  // editor prompts them to pick.
  return bestSq < 0.001 * 0.001 ? bestSlug : "";
}

export default async function PreferencesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/me/preferences");

  const me = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, location: true },
  });

  // Webhook race: same handling as /me. The form will still render with
  // defaults so a user can save once their row lands.
  const prefs = me
    ? await db.query.eaterPreferences.findFirst({
        where: eq(eaterPreferences.userId, userId),
      })
    : null;

  const initial = {
    include: prefs?.includeTagSlugs ?? [],
    exclude: prefs?.excludeTagSlugs ?? [],
    radiusMi: prefs?.radiusMi ?? 2,
    neighborhood: nearestNeighborhoodSlug(me?.location),
  };

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Preferences</h1>
        <p className="text-sm text-stone-600 mt-1">
          What you want to see in your feed. Includes get prioritized; excludes
          are deal-breakers and stay hidden by default.
        </p>
      </header>

      <PreferencesForm
        initial={initial}
        tags={TAGS}
        neighborhoods={NEIGHBORHOODS.map((n) => ({ slug: n.slug, name: n.name }))}
      />
    </main>
  );
}

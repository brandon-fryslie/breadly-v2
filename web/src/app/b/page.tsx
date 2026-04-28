import { getEater, getNearbyListings } from "@/lib/queries";
import { fmtPrice, fmtTime, matchScore } from "@/lib/format";
import { TestBanner, BreadImg, TagPill } from "@/lib/ui";

export const dynamic = "force-dynamic";

// Variant B — One Perfect Match.
// Hypothesis: relevance is the surprise. Calm, centered, almost no choice.
// One hero card. The map is gone. No browse. Reasoning is foregrounded.

export default async function VariantB() {
  const [eater, listings] = await Promise.all([getEater(), getNearbyListings()]);
  const ranked = [...listings]
    .filter((l) => !eater.preferences.exclude.some((t) => l.tags.includes(t)))
    .sort((a, b) => matchScore(b, eater.preferences) - matchScore(a, eater.preferences));

  const hero = ranked[0];
  const heroBaker = hero.baker;
  const secondary = ranked.slice(1, 4);

  return (
    <main className="flex-1 flex flex-col">
      <TestBanner variant="B" label="One perfect match — picked for you" />

      <div className="flex-1 max-w-2xl mx-auto w-full px-5 py-10">
        <p className="text-xs uppercase tracking-widest text-stone-500 mb-1">
          Good morning, {eater.name}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 mb-1">
          We found one for you.
        </h1>
        <p className="text-sm text-stone-500 mb-8">
          Out of {listings.length} loaves nearby, this is the closest fit.
        </p>

        {/* Hero card */}
        <article className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
          <BreadImg src={hero.photo} alt={hero.breadName} className="aspect-[16/10]" />
          <div className="p-6">
            <div className="flex items-baseline justify-between mb-1 gap-3">
              <h2 className="text-2xl font-semibold text-stone-900">
                {hero.breadName}
              </h2>
              <span className="text-2xl font-semibold text-stone-900 whitespace-nowrap">
                {fmtPrice(hero.priceCents)}
              </span>
            </div>
            <div className="text-sm text-stone-600 mb-4">
              {heroBaker.name} · {heroBaker.neighborhood} ·{" "}
              {hero.distanceMi} mi away
            </div>
            <p className="text-stone-700 mb-5 leading-relaxed">
              “{hero.blurb}”
            </p>

            {/* Reasoning */}
            <div className="bg-amber-50/60 border border-amber-200/60 rounded-lg p-4 mb-5">
              <h3 className="text-xs uppercase tracking-widest text-amber-800 font-semibold mb-2">
                Why this one
              </h3>
              <ul className="space-y-1.5 text-sm text-stone-700">
                <li className="flex gap-2">
                  <span className="text-amber-600 mt-0.5">●</span>
                  Matches your <strong>sourdough</strong> preference, not rye.
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-600 mt-0.5">●</span>
                  Came out of the oven{" "}
                  <strong>{fmtTime(hero.readyMinutesFromNow)}</strong>.
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-600 mt-0.5">●</span>
                  {heroBaker.name} is rated{" "}
                  <strong>{heroBaker.rating}★ by {heroBaker.reviews} eaters</strong>{" "}
                  — top 5% in {heroBaker.neighborhood}.
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-600 mt-0.5">●</span>
                  Walking distance ({hero.distanceMi} mi) — about a 6-min walk.
                </li>
              </ul>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-5">
              {hero.tags.map((t) => (
                <TagPill key={t} tag={t} />
              ))}
            </div>

            <div className="flex gap-3">
              <button className="flex-1 bg-stone-900 hover:bg-stone-800 text-white font-medium py-3 rounded-lg transition">
                Reserve · {fmtPrice(hero.priceCents)}
              </button>
              <button className="px-4 border border-stone-300 hover:border-stone-500 rounded-lg text-stone-700 transition">
                Save
              </button>
            </div>
          </div>
        </article>

        {/* Secondary */}
        <div className="mt-10">
          <p className="text-xs uppercase tracking-widest text-stone-500 mb-3">
            Or, three more we’d stand behind
          </p>
          <ul className="space-y-3">
            {secondary.map((l) => {
              const b = l.baker;
              return (
                <li
                  key={l.id}
                  className="flex gap-4 bg-white rounded-xl border border-stone-200 p-3 hover:border-stone-400 transition"
                >
                  <BreadImg
                    src={l.photo}
                    alt={l.breadName}
                    className="w-24 h-24 rounded-lg flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-stone-900 truncate">
                        {l.breadName}
                      </h3>
                      <span className="font-semibold text-stone-900 whitespace-nowrap">
                        {fmtPrice(l.priceCents)}
                      </span>
                    </div>
                    <div className="text-xs text-stone-600 mb-1.5">
                      {b.name} · {l.distanceMi} mi · {fmtTime(l.readyMinutesFromNow)}
                    </div>
                    <p className="text-xs text-stone-500 italic">
                      Picked because:{" "}
                      {l.tags.includes("sourdough")
                        ? "you love sourdough"
                        : l.tags.includes("country")
                          ? "you tend to pick country-style loaves"
                          : `${b.name} is highly rated nearby`}
                      .
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <button className="mt-5 text-sm text-stone-500 hover:text-stone-900 transition">
            Show me everything instead →
          </button>
        </div>
      </div>
    </main>
  );
}

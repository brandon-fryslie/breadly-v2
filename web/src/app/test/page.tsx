import { getEater } from "@/lib/queries";

export const dynamic = "force-dynamic";

const variants = [
  {
    letter: "A",
    name: "Density",
    hypothesis:
      "The eater comes back because the sheer presence of options is the surprise.",
    yes: "“wait, all of this is near me right now?”",
    no: "“this is overwhelming.”",
  },
  {
    letter: "B",
    name: "One Perfect Match",
    hypothesis:
      "The eater comes back because relevance is the surprise — the app knows what they want.",
    yes: "“this is exactly the kind of loaf I’d want.”",
    no: "“I don’t trust the algorithm.”",
  },
  {
    letter: "C",
    name: "Coming Soon",
    hypothesis:
      "The eater comes back because anticipation is the surprise — bread is a thing-in-progress, not a thing-on-shelf.",
    yes: "“I want to time my walk for the boule.”",
    no: "“I just want bread, not a stakeout.”",
  },
  {
    letter: "D",
    name: "The Week",
    hypothesis:
      "The eater comes back because the bakery’s full upcoming schedule is the surprise — info they’ve never had before.",
    yes: "“I had no idea I could see what they’re baking next Saturday.”",
    no: "“I don’t plan bread purchases.”",
  },
] as const;

export default async function TestMenu() {
  const eater = await getEater();
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
          Breadly · feed-shape test
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-stone-900 mb-3">
          Four versions of the same home screen.
        </h1>
        <p className="text-stone-600 max-w-2xl leading-relaxed">
          Same neighborhood, same baker pool, same simulated eater (loves
          sourdough, no rye, within 2 miles of {eater.neighborhood}). The only
          variable is how the feed is shaped. Click into each, then tell us
          which one made you actually want to come back tomorrow — and which
          made you close the app.
        </p>
      </header>

      <ol className="space-y-3">
        {variants.map((v) => (
          <li key={v.letter}>
            <a
              href={`/${v.letter.toLowerCase()}`}
              className="block group rounded-xl border border-stone-200 bg-white px-6 py-5 hover:border-stone-400 hover:shadow-sm transition"
            >
              <div className="flex items-baseline gap-4 mb-2">
                <span className="text-3xl font-semibold text-stone-300 group-hover:text-amber-600 transition">
                  {v.letter}
                </span>
                <h2 className="text-xl font-semibold text-stone-900">
                  {v.name}
                </h2>
                <span className="ml-auto text-sm text-stone-400 group-hover:text-stone-700 transition">
                  open →
                </span>
              </div>
              <p className="text-sm text-stone-600 mb-2 leading-relaxed">
                {v.hypothesis}
              </p>
              <div className="text-xs text-stone-500 flex flex-wrap gap-x-6 gap-y-1">
                <span>
                  <span className="text-emerald-600">yes →</span> {v.yes}
                </span>
                <span>
                  <span className="text-rose-600">no →</span> {v.no}
                </span>
              </div>
            </a>
          </li>
        ))}
      </ol>

      <footer className="mt-12 pt-6 border-t border-stone-200 text-xs text-stone-500 leading-relaxed">
        <p className="mb-2">
          <strong>How to run the test:</strong> show the four variants in a
          random order. After each one, ask: <em>“if this were the app, would
          you open it again tomorrow? Why?”</em> Watch for visceral reactions —
          polite approval is failure.
        </p>
        <p>
          Build the test to invite a fifth answer (“none of these — what I want
          is X”). That would be the most valuable possible result.
        </p>
      </footer>
    </div>
  );
}

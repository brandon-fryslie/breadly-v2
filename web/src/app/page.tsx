// Public marketing landing.
//
// Anonymous: hero + value prop + CTAs.
// Signed-in: same page + a "continue to feed" affordance — we don't redirect
// away from /, since the URL is the natural share target. The header already
// shows their identity.
//
// The four feed-shape variants live at /a /b /c /d (kept; /a is the lead).
// The internal four-variant test menu lives at /test (unlinked from prod nav).

import Link from "next/link";

export const metadata = {
  title: "Breadly — fresh bread, made today, near you.",
  description:
    "Boulder bakers post what they're making. Eaters claim a loaf before it cools.",
};

export default function Landing() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="px-6 pt-16 pb-20 max-w-5xl mx-auto">
        <p className="text-xs uppercase tracking-[0.18em] text-amber-700 mb-5">
          Boulder · time-bound bread
        </p>
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-stone-900 leading-[1.05] max-w-3xl">
          Fresh bread, made today, near you.
        </h1>
        <p className="mt-6 text-lg text-stone-600 max-w-2xl leading-relaxed">
          Boulder bakers post what's coming out of the oven this afternoon.
          You see what's nearby — what's still warm — and claim a loaf before
          it cools.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/a"
            className="bg-stone-900 text-white rounded-md px-5 py-3 text-sm font-medium hover:bg-stone-700 transition"
          >
            Browse what's baking
          </Link>
          <Link
            href="/sign-up"
            className="border border-stone-300 rounded-md px-5 py-3 text-sm font-medium text-stone-800 hover:border-stone-500 transition"
          >
            I bake — let me post
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-stone-200 bg-white">
        <div className="px-6 py-16 max-w-5xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-500 mb-10">
            How it works
          </h2>
          <ol className="grid md:grid-cols-3 gap-10">
            <li>
              <div className="text-3xl font-semibold text-amber-700 mb-3">01</div>
              <h3 className="text-lg font-semibold mb-2">A baker posts a loaf</h3>
              <p className="text-stone-600 text-sm leading-relaxed">
                A home baker or small bakery says: country sourdough, four
                loaves, out of the oven at 3pm, ten dollars. Thirty seconds,
                done.
              </p>
            </li>
            <li>
              <div className="text-3xl font-semibold text-amber-700 mb-3">02</div>
              <h3 className="text-lg font-semibold mb-2">You see what's near</h3>
              <p className="text-stone-600 text-sm leading-relaxed">
                Open the app. Loaves within a couple miles, with the time
                they'll be ready and what's already gone. No chasing, no
                guessing.
              </p>
            </li>
            <li>
              <div className="text-3xl font-semibold text-amber-700 mb-3">03</div>
              <h3 className="text-lg font-semibold mb-2">Claim it; pick it up</h3>
              <p className="text-stone-600 text-sm leading-relaxed">
                One tap to claim. Walk over at the ready time. Show your
                pickup code, take your bread home while it's still warm.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* For bakers */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-stone-900 mb-4">
              If you bake, the listing is the post.
            </h2>
            <p className="text-stone-600 leading-relaxed mb-4">
              No storefront, no inventory system, no batch reconciliation. Tell
              Breadly what's in the oven and when it'll be ready — that's the
              listing. Sell out and disappear; come back when you bake again.
            </p>
            <p className="text-stone-600 leading-relaxed">
              Recurring schedules cover the loaves you make every Tuesday.
              One-off posts cover the experiments. Both go to the same
              neighborhood feed.
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <p className="text-xs uppercase tracking-widest text-stone-500 mb-3">
              What a post looks like
            </p>
            <p className="font-semibold text-stone-900 mb-1">Country sourdough</p>
            <p className="text-sm text-stone-600 mb-3">
              Long-fermented, dark crust. Out of the oven at 3pm.
            </p>
            <div className="flex gap-3 text-sm text-stone-700">
              <span>$10</span>
              <span className="text-stone-400">·</span>
              <span>4 loaves</span>
              <span className="text-stone-400">·</span>
              <span>0.7 mi</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-stone-100">
        <div className="px-6 py-10 max-w-5xl mx-auto text-sm text-stone-600">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="font-semibold text-stone-900">Breadly</span>
            <nav className="flex gap-5">
              <Link href="/a" className="hover:text-stone-900">Browse</Link>
              <Link href="/sign-up" className="hover:text-stone-900">Become a baker</Link>
            </nav>
          </div>
          <p className="mt-6 text-xs text-stone-500 max-w-xl leading-relaxed">
            Operating in Boulder, Colorado. Cottage-food licensed bakers only;
            standard food-safety practices apply.
          </p>
        </div>
      </footer>
    </main>
  );
}

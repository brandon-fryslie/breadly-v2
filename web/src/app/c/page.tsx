import { listings, bakerById, fmtPrice, fmtTime } from "@/lib/data";
import { TestBanner, BreadImg, TagPill, Stars } from "@/lib/ui";

// Variant C — Coming Soon.
// Hypothesis: anticipation is the surprise. Bread as a thing-in-progress.
// The feed is sorted by minutes-until-ready, with countdowns prominent.
// "Already out, getting older" loaves are visually demoted.

export default function VariantC() {
  const upcoming = [...listings]
    .filter((l) => l.readyMinutesFromNow > -120 && l.readyMinutesFromNow < 60 * 12)
    .sort((a, b) => a.readyMinutesFromNow - b.readyMinutesFromNow);

  // Bucket: about-to-emerge (next 90 min) is the headline.
  const headline = upcoming.filter((l) => l.readyMinutesFromNow > -10 && l.readyMinutesFromNow <= 90);
  const stillWarm = upcoming.filter((l) => l.readyMinutesFromNow <= -10 && l.readyMinutesFromNow >= -120);
  const laterToday = upcoming.filter((l) => l.readyMinutesFromNow > 90);

  return (
    <main className="flex-1 flex flex-col bg-stone-900 text-stone-100">
      <TestBanner variant="C" label="Coming soon — what’s about to happen" />

      <div className="max-w-3xl mx-auto w-full px-5 py-8">
        <p className="text-xs uppercase tracking-widest text-amber-400 mb-2">
          Right now in your neighborhood
        </p>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          Ovens are running.
        </h1>
        <p className="text-stone-400 mb-8 text-sm">
          {headline.length} loaves coming out in the next hour and a half.
        </p>

        {/* Headline: about-to-emerge */}
        <section className="mb-10">
          <h2 className="text-xs uppercase tracking-widest text-stone-500 mb-3">
            ⏱ Next out of the oven
          </h2>
          <ul className="space-y-3">
            {headline.map((l) => {
              const b = bakerById(l.bakerId);
              const min = l.readyMinutesFromNow;
              const isOut = min <= 0;
              return (
                <li
                  key={l.id}
                  className={`relative bg-stone-800 border rounded-2xl overflow-hidden flex gap-0 ${
                    isOut
                      ? "border-emerald-700/50"
                      : "border-amber-700/50 shadow-[0_0_30px_-10px_rgba(251,191,36,0.4)]"
                  }`}
                >
                  <BreadImg
                    src={l.photo}
                    alt={l.breadName}
                    className="w-32 sm:w-44 flex-shrink-0"
                  />
                  <div className="flex-1 p-4 sm:p-5 flex flex-col">
                    <div
                      className={`inline-flex items-center gap-1.5 self-start text-xs font-semibold px-2 py-1 rounded-full mb-2 ${
                        isOut
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {isOut ? (
                        <>● JUST OUT</>
                      ) : (
                        <>
                          <Pulse /> READY IN{" "}
                          <span className="text-base ml-1 font-mono tabular-nums">
                            {min}
                          </span>{" "}
                          MIN
                        </>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold leading-tight mb-1">
                      {l.breadName}
                    </h3>
                    <div className="text-xs text-stone-400 mb-2">
                      {b.name} · {l.distanceMi} mi
                    </div>
                    <p className="text-sm text-stone-300 italic mb-3">
                      “{l.blurb}”
                    </p>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="font-semibold">
                        {fmtPrice(l.priceCents)}
                      </span>
                      <button className="bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold text-sm px-4 py-1.5 rounded-full transition">
                        {isOut ? "Claim" : "Hold for me"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Later today */}
        {laterToday.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xs uppercase tracking-widest text-stone-500 mb-3">
              ⏳ Later today
            </h2>
            <ul className="grid sm:grid-cols-2 gap-3">
              {laterToday.map((l) => {
                const b = bakerById(l.bakerId);
                return (
                  <li
                    key={l.id}
                    className="bg-stone-800/60 border border-stone-700 rounded-xl p-3 flex gap-3"
                  >
                    <BreadImg
                      src={l.photo}
                      alt={l.breadName}
                      className="w-16 h-16 rounded-lg flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-amber-400 font-mono mb-0.5">
                        {fmtTime(l.readyMinutesFromNow)}
                      </div>
                      <h3 className="font-semibold text-sm truncate">
                        {l.breadName}
                      </h3>
                      <div className="text-xs text-stone-400">
                        {b.name} · {fmtPrice(l.priceCents)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Still warm — demoted */}
        {stillWarm.length > 0 && (
          <section className="opacity-60">
            <h2 className="text-xs uppercase tracking-widest text-stone-500 mb-3">
              Cooling on the rack
            </h2>
            <ul className="space-y-2">
              {stillWarm.map((l) => {
                const b = bakerById(l.bakerId);
                return (
                  <li
                    key={l.id}
                    className="flex items-center gap-3 text-sm py-2 border-b border-stone-800 last:border-b-0"
                  >
                    <span className="text-xs text-stone-500 font-mono w-20 flex-shrink-0">
                      {fmtTime(l.readyMinutesFromNow)}
                    </span>
                    <span className="flex-1 truncate">
                      {l.breadName}{" "}
                      <span className="text-stone-500">— {b.name}</span>
                    </span>
                    <span className="text-stone-400 font-mono">
                      {fmtPrice(l.priceCents)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

const Pulse = () => (
  <span className="relative inline-flex w-2 h-2">
    <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-75" />
    <span className="relative inline-flex w-2 h-2 rounded-full bg-amber-300" />
  </span>
);

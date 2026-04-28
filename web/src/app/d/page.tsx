import { getNearbyListings, getWeekSchedule } from "@/lib/queries";
import { fmtPrice, dayLabel } from "@/lib/format";
import { TestBanner } from "@/lib/ui";

export const dynamic = "force-dynamic";

// Variant D — The Week.
// Hypothesis: the bakery's full upcoming schedule is the surprise — info
// the eater has never had access to before. Calendar-first. Available-now is
// secondary. The product reads as a planning tool, not a hunting tool.

export default async function VariantD() {
  const [schedule, listings] = await Promise.all([
    getWeekSchedule(),
    getNearbyListings(),
  ]);
  const days = [0, 1, 2, 3, 4, 5, 6] as const;
  const byDay = days.map((d) => ({
    offset: d,
    items: schedule.filter((s) => s.dayOffset === d),
  }));
  const todayAvailable = listings.filter(
    (l) => l.readyMinutesFromNow > -180 && l.readyMinutesFromNow < 60 * 6,
  );

  return (
    <main className="flex-1 flex flex-col">
      <TestBanner variant="D" label="The week — what your bakers are baking" />

      <div className="max-w-6xl mx-auto w-full px-5 py-8">
        <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
          Boulder · 7 days
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 mb-2">
          What your neighborhood is baking this week.
        </h1>
        <p className="text-stone-600 mb-8 max-w-2xl">
          Reserve in advance from{" "}
          <strong>{new Set(schedule.map((s) => s.bakerId)).size} local bakers</strong>.
          You’re seeing schedules they’ve never published anywhere else.
        </p>

        {/* The week */}
        <div className="grid grid-cols-1 md:grid-cols-7 border border-stone-200 rounded-xl overflow-hidden bg-white">
          {byDay.map(({ offset, items }) => (
            <div
              key={offset}
              className={`border-b md:border-b-0 md:border-r border-stone-200 last:border-r-0 last:border-b-0 ${
                offset === 0 ? "bg-amber-50/40" : ""
              }`}
            >
              <div className="px-3 py-2.5 border-b border-stone-200 sticky top-0 bg-inherit">
                <div className="text-xs uppercase tracking-wide text-stone-500">
                  {dayLabel(offset)}
                </div>
                <div className="text-xs text-stone-400">
                  {items.length} planned
                </div>
              </div>
              <ul className="p-2 space-y-2 min-h-[140px]">
                {items.length === 0 && (
                  <li className="text-xs text-stone-400 italic px-2 py-3">
                    No bakes scheduled
                  </li>
                )}
                {items.map((s) => {
                  const b = s.baker;
                  return (
                    <li
                      key={s.id}
                      className="bg-white border border-stone-200 hover:border-amber-400 rounded-lg p-2.5 cursor-pointer transition group"
                    >
                      <div className="text-[11px] font-mono text-amber-700 mb-0.5">
                        {s.readyTimeLabel}
                      </div>
                      <div className="text-sm font-semibold text-stone-900 leading-tight mb-1">
                        {s.breadName}
                      </div>
                      <div className="text-xs text-stone-500 mb-1.5 truncate">
                        {b.name}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-stone-700">
                          {fmtPrice(s.priceCents)}
                        </span>
                        <span className="text-[10px] text-stone-500 group-hover:text-amber-700 transition">
                          {s.qty} planned →
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Filters / lens */}
        <div className="mt-6 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-stone-500 mr-2">Show me:</span>
          <Lens active>Everyone</Lens>
          <Lens>Just bakers I follow (3)</Lens>
          <Lens>Sourdough only</Lens>
          <Lens>What pairs with brunch</Lens>
        </div>

        {/* Available right now — secondary, smaller */}
        <section className="mt-12">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-base font-semibold text-stone-900">
              Also: ready right now
            </h2>
            <span className="text-xs text-stone-500">
              {todayAvailable.length} loaves out of the oven today
            </span>
          </div>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {todayAvailable.map((l) => {
              const b = l.baker;
              return (
                <li
                  key={l.id}
                  className="bg-stone-100 rounded-lg p-2.5 hover:bg-stone-200 transition cursor-pointer"
                >
                  <div className="text-xs font-medium text-stone-900 truncate">
                    {l.breadName}
                  </div>
                  <div className="text-[11px] text-stone-500 truncate">
                    {b.name} · {fmtPrice(l.priceCents)}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Bounty CTA — natural fit on a planning surface */}
        <section className="mt-10 bg-stone-900 text-stone-100 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Want something nobody’s baking?</h3>
            <p className="text-sm text-stone-400">
              Post a bounty — describe what you want and what you’ll pay. Local bakers see it and decide.
            </p>
          </div>
          <button className="bg-amber-400 hover:bg-amber-300 text-stone-900 font-semibold px-5 py-2.5 rounded-lg transition self-start sm:self-auto">
            Post a bounty
          </button>
        </section>
      </div>
    </main>
  );
}

const Lens = ({
  children,
  active = false,
}: {
  children: React.ReactNode;
  active?: boolean;
}) => (
  <button
    className={`px-3 py-1.5 rounded-full border transition ${
      active
        ? "bg-stone-900 text-white border-stone-900"
        : "bg-white text-stone-700 border-stone-200 hover:border-stone-400"
    }`}
  >
    {children}
  </button>
);

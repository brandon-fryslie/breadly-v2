import { getEater, getNearbyListings } from "@/lib/queries";
import { fmtPrice, fmtTime } from "@/lib/format";
import { TestBanner, BreadImg, TagPill, Stars } from "@/lib/ui";

export const dynamic = "force-dynamic";

// Variant A — Density.
// Hypothesis: the surprise is the sheer presence of options. The screen is
// busy, browse-able, and emphasizes "look how much is near you right now."
// No curation. No "for you." The map and the long list are the whole pitch.

export default async function VariantA() {
  const [eater, listings] = await Promise.all([getEater(), getNearbyListings()]);
  const sorted = [...listings].sort((a, b) => a.distanceMi - b.distanceMi);

  return (
    <main className="flex-1 flex flex-col">
      <TestBanner variant="A" label="Density — every loaf nearby right now" />

      {/* sticky filter bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-2 overflow-x-auto">
        <FilterChip active>Available now</FilterChip>
        <FilterChip>Within 2 mi</FilterChip>
        <FilterChip>Sourdough</FilterChip>
        <FilterChip>Rye</FilterChip>
        <FilterChip>Wheat</FilterChip>
        <FilterChip>Gluten-free</FilterChip>
        <FilterChip>Vegan</FilterChip>
        <FilterChip>Under $12</FilterChip>
        <FilterChip>Out of oven &lt; 1h</FilterChip>
        <span className="ml-auto text-xs text-stone-500 whitespace-nowrap">
          Sort: <span className="text-stone-900 font-medium">distance</span>
        </span>
      </div>

      <div className="flex-1 grid lg:grid-cols-[1fr_1.2fr] gap-0">
        {/* Map column */}
        <aside className="relative bg-emerald-50 border-r border-stone-200 min-h-[400px] lg:min-h-0 lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)]">
          <FakeMap pinCount={sorted.length} />
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow-sm text-xs">
            <strong>{sorted.length}</strong> loaves within{" "}
            <strong>{eater.radiusMi} mi</strong>
          </div>
          <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow-sm text-xs text-stone-600">
            Pin colors: 🟢 just out of oven · 🟡 still warm · 🔵 coming soon
          </div>
        </aside>

        {/* Listing column */}
        <section className="bg-stone-50 px-4 py-4">
          <h2 className="px-2 mb-3 text-sm font-semibold text-stone-700 uppercase tracking-wide">
            {sorted.length} loaves in {eater.neighborhood}
          </h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            {sorted.map((l) => {
              const baker = l.baker;
              return (
                <li
                  key={l.id}
                  className="bg-white rounded-lg border border-stone-200 hover:border-stone-400 hover:shadow-sm transition overflow-hidden"
                >
                  <BreadImg src={l.photo} alt={l.breadName} className="aspect-[4/3]" />
                  <div className="p-3">
                    <div className="flex items-baseline justify-between mb-1 gap-2">
                      <h3 className="font-semibold text-stone-900 text-sm leading-tight">
                        {l.breadName}
                      </h3>
                      <span className="font-semibold text-sm text-stone-900 whitespace-nowrap">
                        {fmtPrice(l.priceCents)}
                      </span>
                    </div>
                    <div className="text-xs text-stone-600 mb-2">
                      {baker.name} · {l.distanceMi} mi · {fmtTime(l.readyMinutesFromNow)}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {l.tags.slice(0, 3).map((t) => (
                        <TagPill key={t} tag={t} />
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <Stars rating={baker.rating} reviews={baker.reviews} />
                      <span className="text-xs text-stone-500">
                        {l.qty} left
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}

const FilterChip = ({
  children,
  active = false,
}: {
  children: React.ReactNode;
  active?: boolean;
}) => (
  <button
    className={`text-xs whitespace-nowrap px-3 py-1.5 rounded-full border transition ${
      active
        ? "bg-stone-900 text-white border-stone-900"
        : "bg-white text-stone-700 border-stone-200 hover:border-stone-400"
    }`}
  >
    {children}
  </button>
);

// Stylized fake map — a soft topo-ish backdrop with colored pins.
const FakeMap = ({ pinCount }: { pinCount: number }) => {
  const pins = Array.from({ length: pinCount }, (_, i) => ({
    left: `${15 + (i * 47) % 70}%`,
    top: `${10 + (i * 31) % 75}%`,
    color:
      i % 3 === 0
        ? "bg-emerald-500"
        : i % 3 === 1
          ? "bg-amber-500"
          : "bg-sky-500",
  }));
  return (
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#ecfdf5_0%,#d1fae5_40%,#a7f3d0_100%)] overflow-hidden">
      {/* fake roads */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <line x1="0" y1="35%" x2="100%" y2="40%" stroke="#fff" strokeWidth="6" />
        <line x1="0" y1="70%" x2="100%" y2="65%" stroke="#fff" strokeWidth="4" />
        <line x1="35%" y1="0" x2="40%" y2="100%" stroke="#fff" strokeWidth="5" />
        <line x1="75%" y1="0" x2="70%" y2="100%" stroke="#fff" strokeWidth="3" />
      </svg>
      {/* pins */}
      {pins.map((p, i) => (
        <span
          key={i}
          className={`absolute w-3.5 h-3.5 rounded-full ${p.color} ring-2 ring-white shadow-md`}
          style={{ left: p.left, top: p.top }}
        />
      ))}
      {/* you */}
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-blue-600 rounded-full ring-4 ring-blue-200 shadow-md" />
    </div>
  );
};

// Public storefront. Anonymous, indexable. The whole purpose: a baker
// pastes /b/<slug> into Instagram and the preview card looks credible.
//
// generateMetadata + the page body share one DB call via React `cache()`
// in queries.ts — single source of truth for "what does this storefront
// look like right now". [LAW:one-source-of-truth]
//
// All sections render unconditionally; emptiness is data, not control
// flow. [LAW:dataflow-not-control-flow]

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getStorefront,
  type Storefront,
  type StorefrontListing,
  type StorefrontScheduleProjection,
} from "./queries";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

const fmtPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const fmtClock = (d: Date) =>
  d
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .toLowerCase();

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dayLabel(offset: number, weekday: number): string {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return DAY_LABELS[weekday];
}

function fmtRelative(target: Date, now: Date): string {
  const diffMin = (target.getTime() - now.getTime()) / 60_000;
  const abs = Math.abs(diffMin);
  if (abs < 1) return "now";
  if (abs < 60) {
    const m = Math.round(abs);
    return diffMin >= 0 ? `in ${m} min` : `${m} min ago`;
  }
  const h = Math.floor(abs / 60);
  const m = Math.round(abs % 60);
  const label = m ? `${h}h ${m}m` : `${h}h`;
  return diffMin >= 0 ? `in ${label}` : `${label} ago`;
}

function buildTagline(s: Storefront): string {
  const hood = s.profile.neighborhood ? ` · ${s.profile.neighborhood}` : "";
  const ready = s.ready.length;
  const upcoming = s.upcoming.length + s.scheduled.length;
  if (ready > 0) {
    return `${ready} ready right now${hood}`;
  }
  if (upcoming > 0) {
    return `${upcoming} bakes scheduled this week${hood}`;
  }
  return s.profile.bio?.slice(0, 140) ?? `Home baker${hood}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const storefront = await getStorefront(slug);
  if (!storefront) {
    return { title: "Bakery not found · Breadly" };
  }
  const { profile } = storefront;
  const title = `${profile.bakeryName} · Breadly`;
  const description = buildTagline(storefront);
  const images = profile.coverPhotoUrl ? [profile.coverPhotoUrl] : undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      siteName: "Breadly",
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      images,
    },
  };
}

export default async function StorefrontPage({ params }: PageProps) {
  const { slug } = await params;
  const storefront = await getStorefront(slug);
  if (!storefront) notFound();

  const { profile, ownerName, signatureTags, rating, ready, scheduled, upcoming } =
    storefront;
  const now = new Date();

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 space-y-12">
      <Hero
        bakeryName={profile.bakeryName}
        ownerName={ownerName}
        neighborhood={profile.neighborhood}
        bio={profile.bio}
        coverPhotoUrl={profile.coverPhotoUrl}
        pickupWindowText={profile.pickupWindowText}
        rating={rating}
        signatureTags={signatureTags}
        slug={profile.slug}
      />

      <Section
        eyebrow="01"
        title="Ready right now"
        sub="Out of the oven · pickup today"
        empty="Nothing on the rack right now. Check back later or follow for a heads-up."
        count={ready.length}
      >
        {ready.map((l) => (
          <ReadyCard key={l.id} listing={l} now={now} />
        ))}
      </Section>

      <Section
        eyebrow="02"
        title="Coming up"
        sub="Posted bakes for the next 7 days"
        empty="No specific bakes posted yet — see the weekly rhythm below."
        count={scheduled.length}
      >
        {scheduled.map((l) => (
          <ScheduledRow key={l.id} listing={l} now={now} />
        ))}
      </Section>

      <Section
        eyebrow="03"
        title="The weekly rhythm"
        sub="Recurring + one-off bakes, projected across 7 days"
        empty="No recurring schedule yet."
        count={upcoming.length}
      >
        <WeekProjection items={upcoming} />
      </Section>

      <footer className="pt-8 border-t border-stone-200 text-xs text-stone-500 leading-relaxed">
        <p>
          {profile.bakeryName} is a home baker on{" "}
          <Link href="/" className="underline hover:text-stone-900">
            Breadly
          </Link>
          . Cottage food. Made in {ownerName}&apos;s home kitchen.
        </p>
      </footer>
    </main>
  );
}

function Hero({
  bakeryName,
  ownerName,
  neighborhood,
  bio,
  coverPhotoUrl,
  pickupWindowText,
  rating,
  signatureTags,
  slug,
}: {
  bakeryName: string;
  ownerName: string;
  neighborhood: string | null;
  bio: string | null;
  coverPhotoUrl: string | null;
  pickupWindowText: string | null;
  rating: { rating: number; reviews: number };
  signatureTags: string[];
  slug: string;
}) {
  return (
    <header className="space-y-5" data-testid="storefront-hero">
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-gradient-to-br from-amber-100 via-orange-200 to-amber-700 border border-stone-200">
        {coverPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverPhotoUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : null}
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-stone-500 mb-2">
          /b/{slug}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
          {bakeryName}
        </h1>
        <div className="mt-2 flex items-center flex-wrap gap-x-3 gap-y-1 text-sm text-stone-600">
          <span>by {ownerName}</span>
          {neighborhood ? (
            <>
              <span>·</span>
              <span>{neighborhood}</span>
            </>
          ) : null}
          <span>·</span>
          {rating.reviews === 0 ? (
            <span data-testid="storefront-rating">
              <span className="text-stone-400">★</span> No ratings yet
            </span>
          ) : (
            <span data-testid="storefront-rating">
              <span className="text-amber-600">★</span> {rating.rating.toFixed(1)}
              <span className="text-stone-400"> ({rating.reviews})</span>
            </span>
          )}
        </div>
      </div>

      {bio ? (
        <p className="text-stone-800 leading-relaxed text-base">{bio}</p>
      ) : null}

      {pickupWindowText ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-amber-800 font-semibold mb-1">
            Pickup
          </p>
          <p className="text-sm text-stone-800">{pickupWindowText}</p>
        </div>
      ) : null}

      {signatureTags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" data-testid="storefront-tags">
          {signatureTags.map((t) => (
            <span
              key={t}
              className="inline-block text-[11px] uppercase tracking-wide px-2 py-0.5 rounded bg-stone-200 text-stone-700"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}
    </header>
  );
}

function Section({
  eyebrow,
  title,
  sub,
  empty,
  count,
  children,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <section data-testid={`section-${slug}`}>
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-[10px] font-mono text-stone-400">{eyebrow}</span>
        <h2 className="text-xl font-semibold tracking-tight text-stone-900">
          {title}
        </h2>
        {sub ? <span className="text-xs text-stone-500">· {sub}</span> : null}
        <span className="ml-auto text-sm text-stone-400 tabular-nums">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p className="text-sm text-stone-500 italic border-l-2 border-stone-200 pl-3">
          {empty}
        </p>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </section>
  );
}

function ReadyCard({
  listing,
  now,
}: {
  listing: StorefrontListing;
  now: Date;
}) {
  const out = listing.outOfOvenAt
    ? fmtRelative(listing.outOfOvenAt, now)
    : "out now";
  return (
    <div className="flex gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="relative w-24 h-24 overflow-hidden rounded-lg bg-gradient-to-br from-amber-100 via-orange-200 to-amber-700 shrink-0">
        {listing.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.photoUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h3 className="font-semibold text-stone-900 truncate">
            {listing.name}
          </h3>
          <span className="text-xs text-amber-800 uppercase tracking-wide whitespace-nowrap">
            {out}
          </span>
        </div>
        {listing.blurb ? (
          <p className="text-sm text-stone-700 mt-0.5 line-clamp-2">
            {listing.blurb}
          </p>
        ) : null}
        <div className="mt-2 flex items-center gap-3 text-xs text-stone-600">
          <span className="font-medium text-stone-900">
            {fmtPrice(listing.priceCents)}
          </span>
          <span>·</span>
          <span>
            {listing.qtyAvailable}/{listing.qtyTotal} left
          </span>
        </div>
      </div>
    </div>
  );
}

function ScheduledRow({
  listing,
  now,
}: {
  listing: StorefrontListing;
  now: Date;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-stone-200 pb-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-sm tabular-nums text-stone-900">
            {fmtClock(listing.readyAt)}
          </span>
          <h3 className="font-semibold text-stone-900 truncate">
            {listing.name}
          </h3>
        </div>
        <p className="text-xs text-stone-500 mt-0.5">
          {fmtRelative(listing.readyAt, now)} · {listing.qtyTotal} loaves ·{" "}
          {fmtPrice(listing.priceCents)}
        </p>
      </div>
    </div>
  );
}

function WeekProjection({
  items,
}: {
  items: StorefrontScheduleProjection[];
}) {
  const byDay = new Map<number, StorefrontScheduleProjection[]>();
  for (const it of items) {
    const list = byDay.get(it.dayOffset) ?? [];
    list.push(it);
    byDay.set(it.dayOffset, list);
  }
  const days = Array.from(byDay.keys()).sort((a, b) => a - b);

  return (
    <ol className="space-y-4" data-testid="week-projection">
      {days.map((offset) => {
        const dayItems = byDay.get(offset)!;
        const weekday = dayItems[0].readyAt.getDay();
        return (
          <li key={offset} className="flex gap-4">
            <div className="w-24 shrink-0">
              <p className="text-sm font-semibold text-stone-900">
                {dayLabel(offset, weekday)}
              </p>
              <p className="text-xs text-stone-500">
                {dayItems[0].readyAt.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
            <ul className="flex-1 space-y-2">
              {dayItems.map((it) => (
                <li
                  key={`${it.scheduleId}-${it.readyAt.toISOString()}`}
                  className="flex items-baseline gap-3 border-b border-stone-100 pb-1.5"
                >
                  <span className="font-mono text-xs tabular-nums text-stone-700 w-16">
                    {fmtClock(it.readyAt)}
                  </span>
                  <span className="font-medium text-stone-900 truncate flex-1">
                    {it.name}
                  </span>
                  <span className="text-xs text-stone-500 whitespace-nowrap">
                    {it.defaultQty} · {fmtPrice(it.priceCents)}
                  </span>
                  {it.kind === "one_off" ? (
                    <span className="text-[10px] uppercase tracking-widest text-amber-700">
                      one-off
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

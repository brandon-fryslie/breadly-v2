// Baker today screen. The daily-driver — every section a baker reaches for
// during a Saturday morning of handoffs lives on this page.
//
// Auth + canBake gate is here at the page boundary; the action layer
// re-checks for any writes (single enforcer for state changes lives in
// /baker/new/actions.ts and /me/actions.ts).
//
// All four content sections render unconditionally. Empty states are data,
// not branches. [LAW:dataflow-not-control-flow]

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getBakerToday,
  type ClaimedSeat,
  type TodayListing,
} from "./queries";
import {
  confirmPickupByCode,
  markPickedUpByBakerSelf,
} from "./actions";

export const dynamic = "force-dynamic";

const fmtPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const fmtClock = (d: Date) =>
  d
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .toLowerCase();

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

export default async function BakerHome() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/baker");

  const me = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { canBake: true },
  });
  if (!me?.canBake) redirect("/me");

  const { profile, inOven, comingUpToday, claimedSeats, recentlyPickedUp } =
    await getBakerToday(userId);

  const now = new Date();

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 space-y-10">
      <Hero
        bakeryName={profile.bakeryName}
        neighborhood={profile.neighborhood}
        slug={profile.slug}
        pickupWindowText={profile.pickupWindowText}
      />

      <CounterStrip
        inOven={inOven.length}
        comingUp={comingUpToday.length}
        claimed={claimedSeats.length}
        pickedUp={recentlyPickedUp.length}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/baker/new"
          className="inline-flex items-center gap-2 bg-stone-900 text-white text-sm rounded-md px-4 py-2 hover:bg-stone-700"
        >
          + Post a loaf
        </Link>
        <Link
          href="/baker/schedule"
          className="inline-flex items-center gap-2 border border-stone-300 text-stone-700 text-sm rounded-md px-4 py-2 hover:border-stone-500 hover:text-stone-900"
        >
          Bake schedule
        </Link>
      </div>

      <Section
        eyebrow="01"
        title="In the oven now"
        sub="Live · ready for pickup"
        empty="Nothing ready right this minute."
        count={inOven.length}
      >
        {inOven.map((l) => (
          <OvenCard key={l.id} listing={l} now={now} />
        ))}
      </Section>

      <Section
        eyebrow="02"
        title="Coming up today"
        sub="Scheduled · within the next 12 hours"
        empty="No bakes scheduled for the next 12 hours."
        count={comingUpToday.length}
      >
        {comingUpToday.map((l) => (
          <ComingUpRow key={l.id} listing={l} now={now} />
        ))}
      </Section>

      <Section
        eyebrow="03"
        title="Claimed seats"
        sub="Enter the eater's pickup code to confirm handoff"
        empty="Nothing claimed yet."
        count={claimedSeats.length}
      >
        {claimedSeats.map((c) => (
          <ClaimedSeatRow key={c.claimId} seat={c} />
        ))}
      </Section>

      <Section
        eyebrow="04"
        title="Recently picked up"
        sub="Last 24 hours"
        empty="No handoffs in the last 24 hours."
        count={recentlyPickedUp.length}
      >
        {recentlyPickedUp.map((l) => (
          <PickedUpRow key={l.id} listing={l} now={now} />
        ))}
      </Section>

      <footer className="pt-6 border-t border-stone-200 flex items-center gap-4 text-sm">
        <Link
          href="/me"
          className="text-stone-500 underline hover:text-stone-900"
        >
          Profile
        </Link>
        <Link
          href={`/b/${profile.slug}`}
          className="text-stone-500 underline hover:text-stone-900"
        >
          View public storefront
        </Link>
      </footer>
    </main>
  );
}

function Hero({
  bakeryName,
  neighborhood,
  slug,
  pickupWindowText,
}: {
  bakeryName: string;
  neighborhood: string | null;
  slug: string;
  pickupWindowText: string | null;
}) {
  return (
    <header className="border-b border-stone-200 pb-6">
      <p className="text-xs uppercase tracking-[0.25em] text-stone-500 mb-3">
        Baker · today
      </p>
      <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
        {bakeryName}
      </h1>
      <div className="mt-3 flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600">
        {neighborhood ? <span>{neighborhood}</span> : null}
        {pickupWindowText ? (
          <span className="text-stone-500">{pickupWindowText}</span>
        ) : null}
        <Link
          href={`/b/${slug}`}
          className="font-mono underline decoration-amber-400 hover:decoration-stone-600"
          data-testid="storefront-link"
        >
          /b/{slug}
        </Link>
      </div>
    </header>
  );
}

function CounterStrip({
  inOven,
  comingUp,
  claimed,
  pickedUp,
}: {
  inOven: number;
  comingUp: number;
  claimed: number;
  pickedUp: number;
}) {
  return (
    <div className="grid grid-cols-4 gap-px bg-stone-200 rounded-xl overflow-hidden border border-stone-200">
      <Stat label="In oven" value={inOven} testid="stat-in-oven" />
      <Stat label="Coming up" value={comingUp} testid="stat-coming-up" />
      <Stat label="Claimed" value={claimed} testid="stat-claimed" />
      <Stat label="Picked up" value={pickedUp} testid="stat-picked-up" />
    </div>
  );
}

function Stat({
  label,
  value,
  testid,
}: {
  label: string;
  value: number;
  testid: string;
}) {
  return (
    <div className="bg-white px-4 py-4 text-center" data-testid={testid}>
      <div className="text-3xl font-semibold tabular-nums text-stone-900">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-stone-500 mt-1">
        {label}
      </div>
    </div>
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

function OvenCard({ listing, now }: { listing: TodayListing; now: Date }) {
  const out = listing.outOfOvenAt
    ? fmtRelative(listing.outOfOvenAt, now)
    : "out now";
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="flex gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 hover:bg-amber-100"
    >
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
          {listing.tagSlugs.length > 0 ? (
            <>
              <span>·</span>
              <span className="truncate text-stone-500">
                {listing.tagSlugs.slice(0, 3).join(" · ")}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function ComingUpRow({
  listing,
  now,
}: {
  listing: TodayListing;
  now: Date;
}) {
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="flex items-center justify-between gap-4 border-b border-stone-200 pb-3 hover:bg-stone-50 -mx-2 px-2 py-1 rounded"
    >
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
      <span className="text-xs text-stone-400">view</span>
    </Link>
  );
}

// Each claimed seat is its own handoff terminal: visible code (so the
// baker can sight-verify against the eater's screen), code-entry form,
// and a self-mark fallback. Same shape on every row — variability lives
// in the seat data, not in branching layouts. [LAW:dataflow-not-control-flow]
function ClaimedSeatRow({ seat }: { seat: ClaimedSeat }) {
  return (
    <div
      className="rounded-lg border border-stone-200 bg-white px-4 py-3 space-y-3"
      data-testid="claimed-seat-row"
      data-claim-id={seat.claimId}
    >
      <div className="flex items-center gap-4">
        <div className="font-mono text-2xl tabular-nums tracking-wider text-stone-900">
          {seat.pickupCode}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-stone-900 truncate">
            {seat.listingName}
          </h3>
          <p className="text-xs text-stone-500">
            {seat.qty} {seat.qty === 1 ? "loaf" : "loaves"} for{" "}
            {seat.eaterName}
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-stone-400">
          held
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <form
          action={confirmPickupByCode}
          className="flex items-center gap-2"
          data-testid="handoff-form"
        >
          <input type="hidden" name="listingId" value={seat.listingId} />
          <input
            name="code"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            placeholder="0000"
            aria-label="Pickup code"
            data-testid="handoff-code-input"
            className="w-20 font-mono tabular-nums tracking-widest text-center rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-stone-500 focus:outline-none"
            required
          />
          <button
            type="submit"
            data-testid="handoff-confirm"
            className="text-sm rounded-md bg-stone-900 text-white px-3 py-1.5 hover:bg-stone-700"
          >
            Confirm pickup
          </button>
        </form>
        <form action={markPickedUpByBakerSelf}>
          <input type="hidden" name="claimId" value={seat.claimId} />
          <button
            type="submit"
            data-testid="handoff-self-pickup"
            className="text-xs text-stone-500 underline hover:text-stone-800"
            title="Use if the eater is already gone or no code was exchanged."
          >
            Mark picked up myself
          </button>
        </form>
      </div>
    </div>
  );
}

function PickedUpRow({
  listing,
  now,
}: {
  listing: TodayListing;
  now: Date;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm text-stone-600 border-b border-stone-100 pb-2">
      <span className="truncate">
        <span className="text-emerald-600 mr-2">✓</span>
        {listing.name}
      </span>
      <span className="text-xs text-stone-500">
        {listing.qtyTotal} {listing.qtyTotal === 1 ? "loaf" : "loaves"} ·{" "}
        {fmtRelative(listing.updatedAt, now)}
      </span>
    </div>
  );
}

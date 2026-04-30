// Public listing detail page.
//
// One page, one query, three viewer modes encoded as data:
//   - anonymous : public read view, claim CTA links to sign-in
//   - eater     : public read view, claim CTA placeholder (ED2-2 wires it up)
//   - owner     : public read view PLUS a baker-actions toolbar
//
// The viewer relationship is a value (`viewer.kind`), not a control-flow
// pivot. Every section renders unconditionally; the actions toolbar is a
// component that takes the listing as data and decides which buttons make
// sense for the current status. [LAW:dataflow-not-control-flow]
//
// Privacy gradient: pre-claim shows neighborhood + bakery name; post-claim
// adds the exact address. The full fuzzed-pin map is ED5-3; until then we
// just gate the address text by claim status. [LAW:single-enforcer] for the
// reveal lives in viewerHasActiveClaim().

import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getListingDetail,
  getViewerCurrentClaim,
  type ListingDetail,
  type ViewerCurrentClaim,
} from "./queries";
import {
  cancelClaimByEater,
  createClaim,
  markOutOfOven,
  markPickedUpByEaterSelf,
  markSoldOut,
  pullListing,
} from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

const fmtPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const fmtClock = (d: Date) =>
  d
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .toLowerCase();

const fmtDay = (d: Date) =>
  d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

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

const STATUS_BADGE: Record<
  ListingDetail["status"],
  { label: string; className: string }
> = {
  scheduled: {
    label: "Scheduled",
    className: "bg-stone-100 text-stone-700 border-stone-200",
  },
  ready: {
    label: "Out of the oven",
    className: "bg-amber-100 text-amber-900 border-amber-200",
  },
  claimed: {
    label: "Claimed",
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  picked_up: {
    label: "Picked up",
    className: "bg-stone-100 text-stone-600 border-stone-200",
  },
  cancelled: {
    label: "Pulled by baker",
    className: "bg-rose-50 text-rose-800 border-rose-200",
  },
  expired: {
    label: "Sold out",
    className: "bg-stone-200 text-stone-700 border-stone-300",
  },
};

type Viewer =
  | { kind: "anonymous" }
  | { kind: "owner" }
  | { kind: "eater"; claim: ViewerCurrentClaim | null };

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params;

  const listing = await getListingDetail(id);
  if (!listing) notFound();

  const { userId } = await auth();
  const viewer: Viewer = await resolveViewer(listing, userId);

  const now = new Date();

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <Hero listing={listing} now={now} />

      <Photo listing={listing} />

      {listing.blurb ? (
        <p
          className="text-stone-800 leading-relaxed text-base"
          data-testid="listing-blurb"
        >
          {listing.blurb}
        </p>
      ) : null}

      <Facts listing={listing} now={now} />

      <PrivacyBlock listing={listing} viewer={viewer} />

      <ViewerActions listing={listing} viewer={viewer} />

      <BakerLink listing={listing} />
    </main>
  );
}

async function resolveViewer(
  listing: ListingDetail,
  userId: string | null,
): Promise<Viewer> {
  if (!userId) return { kind: "anonymous" };
  if (userId === listing.bakerId) return { kind: "owner" };
  const claim = await getViewerCurrentClaim(listing.id, userId);
  return { kind: "eater", claim };
}

function Hero({ listing, now }: { listing: ListingDetail; now: Date }) {
  const badge = STATUS_BADGE[listing.status];
  return (
    <header className="space-y-3" data-testid="listing-hero">
      <div className="flex items-center gap-3">
        <span
          className={`inline-block text-[10px] uppercase tracking-widest px-2 py-1 rounded border ${badge.className}`}
          data-testid="listing-status"
        >
          {badge.label}
        </span>
        <span className="text-xs text-stone-500" data-testid="listing-ready">
          {listing.outOfOvenAt
            ? `out ${fmtRelative(listing.outOfOvenAt, now)}`
            : `${fmtDay(listing.readyAt)} · ${fmtClock(listing.readyAt)}`}
        </span>
      </div>
      <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
        {listing.name}
      </h1>
      <p className="text-sm text-stone-600">
        by{" "}
        <Link
          href={`/b/${listing.bakerSlug}`}
          className="underline hover:text-stone-900"
        >
          {listing.bakeryName}
        </Link>
        {listing.neighborhood ? ` · ${listing.neighborhood}` : null}
      </p>
    </header>
  );
}

function Photo({ listing }: { listing: ListingDetail }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-amber-100 via-orange-200 to-amber-700 border border-stone-200">
      {listing.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={listing.photoUrl}
          alt={listing.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : null}
    </div>
  );
}

function Facts({ listing, now }: { listing: ListingDetail; now: Date }) {
  return (
    <dl
      className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-stone-200 bg-white px-5 py-4"
      data-testid="listing-facts"
    >
      <Fact label="Price" value={fmtPrice(listing.priceCents)} />
      <Fact
        label="Available"
        value={`${listing.qtyAvailable} of ${listing.qtyTotal}`}
      />
      <Fact
        label="Ready"
        value={`${fmtClock(listing.readyAt)} · ${fmtRelative(
          listing.readyAt,
          now,
        )}`}
      />
      <Fact
        label="Tags"
        value={
          listing.tagSlugs.length === 0
            ? "—"
            : listing.tagSlugs.slice(0, 4).join(" · ")
        }
      />
    </dl>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest text-stone-500">
        {label}
      </dt>
      <dd className="text-sm text-stone-900 mt-0.5">{value}</dd>
    </div>
  );
}

function PrivacyBlock({
  listing,
  viewer,
}: {
  listing: ListingDetail;
  viewer: Viewer;
}) {
  // Reveal exact address only to the owner or to an eater with an active
  // claim. Everyone else sees the neighborhood line.
  const showExact =
    viewer.kind === "owner" ||
    (viewer.kind === "eater" && viewer.claim !== null);

  const exactLines = [
    listing.addressLine,
    [listing.city, listing.region, listing.postalCode].filter(Boolean).join(", "),
  ].filter((s): s is string => Boolean(s && s.length > 0));

  return (
    <section
      className="rounded-xl border border-stone-200 bg-stone-50 px-5 py-4"
      data-testid="listing-pickup"
    >
      <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-1">
        Pickup
      </p>
      <p className="text-sm text-stone-800">
        {listing.pickupWindowText ?? "Coordinate with the baker."}
      </p>
      <p className="text-xs text-stone-600 mt-2">
        {showExact && exactLines.length > 0 ? (
          <span data-testid="listing-address-exact">
            {exactLines.join(" · ")}
          </span>
        ) : (
          <span data-testid="listing-address-fuzzed">
            {listing.neighborhood ?? "Boulder area"} · exact address shared
            after claim
          </span>
        )}
      </p>
    </section>
  );
}

function ViewerActions({
  listing,
  viewer,
}: {
  listing: ListingDetail;
  viewer: Viewer;
}) {
  if (viewer.kind === "owner") {
    return <OwnerToolbar listing={listing} />;
  }
  return <EaterClaimSection listing={listing} viewer={viewer} />;
}

// Baker-side actions. Which buttons are *available* is data: the listing's
// current status defines the legal transitions. Every button always renders
// (disabled when not applicable) so the layout doesn't shuffle as state
// changes. [LAW:dataflow-not-control-flow]
function OwnerToolbar({ listing }: { listing: ListingDetail }) {
  const canMarkReady = listing.status === "scheduled";
  const canMarkSoldOut =
    listing.status === "ready" || listing.status === "scheduled";
  const canPull =
    listing.status !== "cancelled" &&
    listing.status !== "picked_up" &&
    listing.status !== "expired";

  return (
    <section
      className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 space-y-3"
      data-testid="owner-toolbar"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-tight text-amber-900">
          Baker actions
        </h2>
        <span className="text-[10px] uppercase tracking-widest text-amber-800">
          you own this listing
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <ActionForm
          action={markOutOfOven}
          id={listing.id}
          label="Mark out of oven"
          disabled={!canMarkReady}
          variant="primary"
          testid="action-out-of-oven"
        />
        <ActionForm
          action={markSoldOut}
          id={listing.id}
          label="Mark sold out"
          disabled={!canMarkSoldOut}
          variant="secondary"
          testid="action-sold-out"
        />
        <ActionForm
          action={pullListing}
          id={listing.id}
          label="Pull listing"
          disabled={!canPull}
          variant="danger"
          testid="action-pull"
        />
      </div>
    </section>
  );
}

function ActionForm({
  action,
  id,
  label,
  disabled,
  variant,
  testid,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label: string;
  disabled: boolean;
  variant: "primary" | "secondary" | "danger";
  testid: string;
}) {
  const cls =
    variant === "primary"
      ? "bg-stone-900 text-white hover:bg-stone-700"
      : variant === "danger"
        ? "border border-rose-300 text-rose-800 hover:border-rose-500 hover:text-rose-900 bg-white"
        : "border border-stone-300 text-stone-700 hover:border-stone-500 hover:text-stone-900 bg-white";
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={disabled}
        data-testid={testid}
        className={`inline-flex items-center text-sm rounded-md px-4 py-2 transition disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}
      >
        {label}
      </button>
    </form>
  );
}

// Eater-facing actions panel. Three mutually exclusive states encoded as
// data, not as nested if/else: an active claim (reveal pickup code +
// directions + cancel), an anonymous viewer (sign-in link), or a signed-in
// eater facing a fresh listing (claim form when listing is ready, disabled
// notice otherwise). Each state gets its own component with the same outer
// shell so layout doesn't shuffle. [LAW:dataflow-not-control-flow]
function EaterClaimSection({
  listing,
  viewer,
}: {
  listing: ListingDetail;
  viewer: Viewer;
}) {
  if (viewer.kind === "eater" && viewer.claim) {
    return <ClaimedReveal listing={listing} claim={viewer.claim} />;
  }
  if (viewer.kind === "anonymous") {
    return <SignInToClaim listing={listing} />;
  }
  return <ClaimForm listing={listing} />;
}

// Eater's view of their claim. Two states encoded in claim.status:
// 'active' (pre-handoff: code visible, cancel + self-mark fallback) and
// 'picked_up' (post-handoff: receipt mode, no actions). Same shell, same
// privacy gradient, different inner blocks. [LAW:dataflow-not-control-flow]
function ClaimedReveal({
  listing,
  claim,
}: {
  listing: ListingDetail;
  claim: ViewerCurrentClaim;
}) {
  const directionsHref = buildDirectionsHref(listing);
  const pickedUp = claim.status === "picked_up";

  return (
    <section
      className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-5 space-y-4"
      data-testid="eater-cta"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-tight text-emerald-900">
          {pickedUp ? "Picked up — enjoy" : "You claimed this loaf"}
        </h2>
        <span
          className="text-[10px] uppercase tracking-widest text-emerald-800"
          data-testid="claim-state"
        >
          {pickedUp
            ? claim.pickedUpAt
              ? `picked up ${fmtDay(claim.pickedUpAt)} · ${fmtClock(claim.pickedUpAt)}`
              : "picked up"
            : "show this code at pickup"}
        </span>
      </div>

      <div className="flex items-center gap-4 rounded-lg border border-emerald-200 bg-white px-4 py-3">
        <div
          className={`font-mono text-3xl tabular-nums tracking-[0.3em] ${
            pickedUp ? "text-stone-400 line-through" : "text-stone-900"
          }`}
          data-testid="claim-pickup-code"
        >
          {claim.pickupCode}
        </div>
        <div className="text-xs text-stone-600">
          <p className="font-semibold text-stone-800">
            {pickedUp ? "Pickup complete" : "Pickup code"}
          </p>
          <p>
            {claim.qty} {claim.qty === 1 ? "loaf" : "loaves"}{" "}
            {pickedUp ? "received" : "held for you"}
          </p>
        </div>
      </div>

      {directionsHref ? (
        <a
          href={directionsHref}
          target="_blank"
          rel="noreferrer"
          data-testid="claim-directions"
          className="inline-flex items-center text-sm rounded-md border border-emerald-300 bg-white px-4 py-2 text-emerald-900 hover:border-emerald-500 hover:text-emerald-950"
        >
          {pickedUp ? "Bakery address" : "Get directions"}
        </a>
      ) : null}

      {pickedUp ? null : (
        <div className="flex items-center gap-4 pt-1">
          <form action={cancelClaimByEater}>
            <input type="hidden" name="id" value={listing.id} />
            <button
              type="submit"
              data-testid="claim-cancel"
              className="text-xs text-stone-500 underline hover:text-stone-800"
            >
              Cancel my claim
            </button>
          </form>
          <form action={markPickedUpByEaterSelf}>
            <input type="hidden" name="id" value={listing.id} />
            <button
              type="submit"
              data-testid="claim-self-pickup"
              className="text-xs text-stone-500 underline hover:text-stone-800"
              title="Use this if the baker is offline at handoff."
            >
              Mark picked up myself
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

function SignInToClaim({ listing }: { listing: ListingDetail }) {
  const claimable = listing.status === "ready" && listing.qtyAvailable > 0;
  return (
    <section
      className="rounded-xl border border-stone-200 bg-white px-5 py-4 space-y-3"
      data-testid="eater-cta"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-tight text-stone-900">
          {claimable ? "Available now" : "Not currently claimable"}
        </h2>
      </div>
      <Link
        href={`/sign-in?redirect_url=/listings/${listing.id}`}
        aria-disabled={!claimable}
        data-testid="claim-cta"
        className={`inline-flex items-center bg-stone-900 text-white text-sm rounded-md px-4 py-2 hover:bg-stone-700 ${
          claimable ? "" : "opacity-40 pointer-events-none"
        }`}
      >
        Sign in to claim
      </Link>
    </section>
  );
}

function ClaimForm({ listing }: { listing: ListingDetail }) {
  const claimable = listing.status === "ready" && listing.qtyAvailable > 0;
  return (
    <section
      className="rounded-xl border border-stone-200 bg-white px-5 py-4 space-y-3"
      data-testid="eater-cta"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-tight text-stone-900">
          {claimable ? "Available now" : "Not currently claimable"}
        </h2>
        <span className="text-[10px] uppercase tracking-widest text-stone-500">
          {listing.qtyAvailable} of {listing.qtyTotal} left
        </span>
      </div>
      <form action={createClaim}>
        <input type="hidden" name="id" value={listing.id} />
        <button
          type="submit"
          disabled={!claimable}
          data-testid="claim-cta"
          className="inline-flex items-center bg-stone-900 text-white text-sm rounded-md px-4 py-2 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Claim a loaf
        </button>
      </form>
    </section>
  );
}

function buildDirectionsHref(listing: ListingDetail): string | null {
  const parts = [
    listing.addressLine,
    [listing.city, listing.region, listing.postalCode]
      .filter(Boolean)
      .join(", "),
  ].filter((s): s is string => Boolean(s && s.length > 0));
  if (parts.length === 0) return null;
  const dest = encodeURIComponent(parts.join(" "));
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

function BakerLink({ listing }: { listing: ListingDetail }) {
  return (
    <footer className="pt-6 border-t border-stone-200 text-sm">
      <Link
        href={`/b/${listing.bakerSlug}`}
        className="text-stone-500 underline hover:text-stone-900"
      >
        See more from {listing.bakeryName}
      </Link>
    </footer>
  );
}

// Server-only data helpers for /baker. Kept out of any "use server" file so
// they can't be invoked as RPCs.
//
// One function — getBakerToday(userId) — returns every section the today
// screen renders. Sections come back as arrays so empty states are encoded
// in the data shape, not in branching at the call site.
// [LAW:dataflow-not-control-flow]

import "server-only";
import { sql, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { bakerProfiles, type BakerProfile } from "@/db/schema";

export type TodayBucket = "in_oven" | "coming_up";

export type TodayListing = {
  id: string;
  name: string;
  blurb: string | null;
  photoUrl: string | null;
  priceCents: number;
  qtyAvailable: number;
  qtyTotal: number;
  readyAt: Date;
  outOfOvenAt: Date | null;
  updatedAt: Date;
  tagSlugs: string[];
  bucket: TodayBucket;
};

export type ClaimedSeat = {
  claimId: string;
  listingId: string;
  listingName: string;
  qty: number;
  pickupCode: string;
  claimedAt: Date;
  eaterName: string;
};

// One row per (claim picked-up in the last 24h). Each row carries the
// baker's own rating for that claim if they've already submitted one,
// so the page renders the prompt or the receipt from the same shape.
// [LAW:dataflow-not-control-flow]
export type RecentHandoff = {
  claimId: string;
  listingId: string;
  listingName: string;
  eaterId: string;
  eaterName: string;
  pickedUpAt: Date;
  myRating: { score: number; comment: string | null } | null;
};

export type BakerRating = {
  rating: number; // average score, 1.0–5.0; 0 when reviews=0
  reviews: number;
};

export type BakerToday = {
  profile: BakerProfile;
  rating: BakerRating;
  inOven: TodayListing[];
  comingUpToday: TodayListing[];
  claimedSeats: ClaimedSeat[];
  recentHandoffs: RecentHandoff[];
};

type ListingRow = {
  id: string;
  name: string;
  blurb: string | null;
  photo_url: string | null;
  price_cents: number;
  qty_available: number;
  qty_total: number;
  ready_at: string | Date;
  out_of_oven_at: string | Date | null;
  updated_at: string | Date;
  bucket: TodayBucket;
  tag_slugs: string[];
};

const toDate = (v: string | Date): Date =>
  typeof v === "string" ? new Date(v) : v;

function rowToTodayListing(r: ListingRow): TodayListing {
  return {
    id: r.id,
    name: r.name,
    blurb: r.blurb,
    photoUrl: r.photo_url,
    priceCents: r.price_cents,
    qtyAvailable: r.qty_available,
    qtyTotal: r.qty_total,
    readyAt: toDate(r.ready_at),
    outOfOvenAt: r.out_of_oven_at === null ? null : toDate(r.out_of_oven_at),
    updatedAt: toDate(r.updated_at),
    tagSlugs: r.tag_slugs,
    bucket: r.bucket,
  };
}

export async function getBakerToday(userId: string): Promise<BakerToday> {
  // [LAW:single-enforcer] /me capability flow inserts canBake + profile in one
  // tx (src/app/me/actions.ts), so canBake=true => profile exists. Caller has
  // already gated on canBake; a missing row here means data corruption, not
  // a state we should silently degrade through.
  // [LAW:no-defensive-null-guards]
  const profile = await db.query.bakerProfiles.findFirst({
    where: eq(bakerProfiles.userId, userId),
  });
  if (!profile) {
    throw new Error(
      `getBakerToday: bakerProfiles row missing for canBake user ${userId}`,
    );
  }

  const [listingRows, claimRows, handoffRows, ratingRow] = await Promise.all([
    db.execute<ListingRow>(sql`
      SELECT
        l.id,
        l.name,
        l.blurb,
        l.photo_url,
        l.price_cents,
        l.qty_available,
        l.qty_total,
        l.ready_at,
        l.out_of_oven_at,
        l.updated_at,
        CASE
          WHEN l.status = 'ready' AND l.qty_available > 0 THEN 'in_oven'
          WHEN l.status = 'scheduled'
               AND l.ready_at <= NOW() + INTERVAL '12 hours'
               AND l.ready_at > NOW() - INTERVAL '1 hour'
            THEN 'coming_up'
        END AS bucket,
        COALESCE(
          (SELECT array_agg(t.slug ORDER BY t.slug)
           FROM listing_tags lt
           JOIN tags t ON t.id = lt.tag_id
           WHERE lt.listing_id = l.id),
          ARRAY[]::text[]
        ) AS tag_slugs
      FROM listings l
      WHERE l.baker_id = ${userId}
        AND (
          (l.status = 'ready' AND l.qty_available > 0)
          OR (l.status = 'scheduled'
              AND l.ready_at <= NOW() + INTERVAL '12 hours'
              AND l.ready_at > NOW() - INTERVAL '1 hour')
        )
    `),
    db.execute<{
      claim_id: string;
      qty: number;
      pickup_code: string;
      claimed_at: string | Date;
      listing_id: string;
      listing_name: string;
      eater_name: string;
    }>(sql`
      SELECT
        c.id AS claim_id,
        c.qty,
        c.pickup_code,
        c.created_at AS claimed_at,
        l.id AS listing_id,
        l.name AS listing_name,
        u.display_name AS eater_name
      FROM claims c
      JOIN listings l ON l.id = c.listing_id
      JOIN users u ON u.id = c.eater_id
      WHERE l.baker_id = ${userId}
        AND c.status = 'active'
      ORDER BY c.created_at DESC
    `),
    // Recent handoffs (last 24h, picked_up). LEFT JOIN ratings filtered to
    // this baker's row gives one row per claim with optional self-rating.
    // [LAW:one-source-of-truth] for "did I rate this handoff?"
    db.execute<{
      claim_id: string;
      listing_id: string;
      listing_name: string;
      eater_id: string;
      eater_name: string;
      picked_up_at: string | Date;
      my_score: number | null;
      my_comment: string | null;
    }>(sql`
      SELECT
        c.id AS claim_id,
        l.id AS listing_id,
        l.name AS listing_name,
        u.id AS eater_id,
        u.display_name AS eater_name,
        c.picked_up_at,
        r.score AS my_score,
        r.comment AS my_comment
      FROM claims c
      JOIN listings l ON l.id = c.listing_id
      JOIN users u ON u.id = c.eater_id
      LEFT JOIN ratings r
        ON r.claim_id = c.id AND r.rater_id = ${userId}
      WHERE l.baker_id = ${userId}
        AND c.status = 'picked_up'
        AND c.picked_up_at >= NOW() - INTERVAL '24 hours'
      ORDER BY c.picked_up_at DESC
    `),
    // Aggregate rating for this baker (where they are rated_id). Always
    // returns one row — COALESCE collapses the no-ratings case to 0/0.
    // [LAW:one-source-of-truth] replaces the placeholderRating helper.
    db.execute<{ avg_score: string | null; review_count: number }>(sql`
      SELECT
        AVG(score)::float AS avg_score,
        COUNT(*)::int AS review_count
      FROM ratings
      WHERE rated_id = ${userId}
    `),
  ]);

  const listings = listingRows.map(rowToTodayListing);

  const inOven = listings
    .filter((l) => l.bucket === "in_oven")
    .sort(
      (a, b) =>
        (b.outOfOvenAt?.getTime() ?? 0) - (a.outOfOvenAt?.getTime() ?? 0),
    );

  const comingUpToday = listings
    .filter((l) => l.bucket === "coming_up")
    .sort((a, b) => a.readyAt.getTime() - b.readyAt.getTime());

  const claimedSeats: ClaimedSeat[] = claimRows.map((r) => ({
    claimId: r.claim_id,
    listingId: r.listing_id,
    listingName: r.listing_name,
    qty: r.qty,
    pickupCode: r.pickup_code,
    claimedAt: toDate(r.claimed_at),
    eaterName: r.eater_name,
  }));

  const recentHandoffs: RecentHandoff[] = handoffRows.map((r) => ({
    claimId: r.claim_id,
    listingId: r.listing_id,
    listingName: r.listing_name,
    eaterId: r.eater_id,
    eaterName: r.eater_name,
    pickedUpAt: toDate(r.picked_up_at),
    myRating:
      r.my_score === null
        ? null
        : { score: r.my_score, comment: r.my_comment },
  }));

  const reviews = ratingRow[0]?.review_count ?? 0;
  const avg = ratingRow[0]?.avg_score;
  const rating: BakerRating = {
    reviews,
    rating: reviews === 0 || avg === null ? 0 : Number(avg),
  };

  return {
    profile,
    rating,
    inOven,
    comingUpToday,
    claimedSeats,
    recentHandoffs,
  };
}

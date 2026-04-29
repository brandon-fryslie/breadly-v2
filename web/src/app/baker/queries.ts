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

export type TodayBucket = "in_oven" | "coming_up" | "recently_picked";

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

export type BakerToday = {
  profile: BakerProfile;
  inOven: TodayListing[];
  comingUpToday: TodayListing[];
  claimedSeats: ClaimedSeat[];
  recentlyPickedUp: TodayListing[];
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

  const [listingRows, claimRows] = await Promise.all([
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
          WHEN l.status = 'picked_up'
               AND l.updated_at >= NOW() - INTERVAL '24 hours'
            THEN 'recently_picked'
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
          OR (l.status = 'picked_up'
              AND l.updated_at >= NOW() - INTERVAL '24 hours')
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

  const recentlyPickedUp = listings
    .filter((l) => l.bucket === "recently_picked")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const claimedSeats: ClaimedSeat[] = claimRows.map((r) => ({
    claimId: r.claim_id,
    listingId: r.listing_id,
    listingName: r.listing_name,
    qty: r.qty,
    pickupCode: r.pickup_code,
    claimedAt: toDate(r.claimed_at),
    eaterName: r.eater_name,
  }));

  return { profile, inOven, comingUpToday, claimedSeats, recentlyPickedUp };
}

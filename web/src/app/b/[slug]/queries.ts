// Server-only data helpers for the public storefront /b/<slug>.
//
// The page renders anonymously, so no auth helpers run here. We expose a
// single getStorefront(slug) function that returns everything the page +
// generateMetadata both need; the call is wrapped in React `cache()` so
// the two consumers share one DB hit per request.
// [LAW:one-source-of-truth]

import "server-only";
import { cache } from "react";
import { sql, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  bakerProfiles,
  type BakerProfile,
} from "@/db/schema";

export type StorefrontListing = {
  id: string;
  name: string;
  blurb: string | null;
  photoUrl: string | null;
  priceCents: number;
  qtyAvailable: number;
  qtyTotal: number;
  readyAt: Date;
  outOfOvenAt: Date | null;
  status: "ready" | "scheduled";
  tagSlugs: string[];
};

export type StorefrontScheduleProjection = {
  scheduleId: string;
  name: string;
  blurb: string | null;
  photoUrl: string | null;
  priceCents: number;
  defaultQty: number;
  tagSlugs: string[];
  readyAt: Date;
  dayOffset: number; // 0=today
  kind: "recurring" | "one_off";
};

export type StorefrontPlaceholderRating = {
  rating: number;
  reviews: number;
};

export type Storefront = {
  profile: BakerProfile;
  ownerName: string;
  // Aggregated tag slugs across the baker's recent inventory + schedules,
  // de-duplicated. Drives the "kitchen tags / styles" strip on the hero.
  signatureTags: string[];
  rating: StorefrontPlaceholderRating;
  ready: StorefrontListing[];
  scheduled: StorefrontListing[];
  upcoming: StorefrontScheduleProjection[];
};

// Same hash → rating shape used by lib/queries.ts; placeholder until the
// ratings epic ships. Kept inline so /b/<slug> doesn't import the eater
// feed module just for this one helper. [LAW:one-type-per-behavior]:
// when the real ratings table lands, both sites consume the same query.
function placeholderRating(bakerId: string): StorefrontPlaceholderRating {
  let h = 0;
  for (let i = 0; i < bakerId.length; i++) {
    h = (h * 31 + bakerId.charCodeAt(i)) | 0;
  }
  const r = (Math.abs(h) % 51) / 100; // 0.00 - 0.50
  const reviews = 12 + (Math.abs(h >> 8) % 369);
  return { rating: 4.5 + r, reviews };
}

const toDate = (v: string | Date): Date =>
  typeof v === "string" ? new Date(v) : v;

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
  status: "ready" | "scheduled";
  tag_slugs: string[];
};

type ScheduleProjectionRow = {
  schedule_id: string;
  name: string;
  blurb: string | null;
  photo_url: string | null;
  price_cents: number;
  default_qty: number;
  tag_slugs: string[];
  ready_at: string | Date;
  day_offset: number;
  kind: "recurring" | "one_off";
};

function rowToListing(r: ListingRow): StorefrontListing {
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
    status: r.status,
    tagSlugs: r.tag_slugs,
  };
}

export const getStorefront = cache(
  async (slug: string): Promise<Storefront | null> => {
    const profile = await db.query.bakerProfiles.findFirst({
      where: eq(bakerProfiles.slug, slug),
    });
    if (!profile) return null;

    const userId = profile.userId;

    const [ownerRow, listingRows, scheduleRows] = await Promise.all([
      db.execute<{ display_name: string }>(sql`
        SELECT display_name FROM users WHERE id = ${userId} LIMIT 1
      `),
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
          l.status,
          COALESCE(
            (SELECT array_agg(t.slug ORDER BY t.slug)
             FROM listing_tags lt
             JOIN tags t ON t.id = lt.tag_id
             WHERE lt.listing_id = l.id),
            ARRAY[]::text[]
          ) AS tag_slugs
        FROM listings l
        WHERE l.baker_id = ${userId}
          AND l.qty_available > 0
          AND (
            (l.status = 'ready' AND l.ready_at > NOW() - INTERVAL '6 hours')
            OR (l.status = 'scheduled'
                AND l.ready_at >= NOW() - INTERVAL '1 hour'
                AND l.ready_at < NOW() + INTERVAL '7 days')
          )
        ORDER BY l.ready_at
      `),
      // 7-day projection of this baker's schedules — recurring entries are
      // expanded across the next 7 days; one-offs surface their concrete
      // first_ready_at (when it falls in window). Mirrors the structure of
      // lib/queries.getWeekSchedule, scoped to one baker.
      db.execute<ScheduleProjectionRow>(sql`
        WITH one_offs AS (
          SELECT s.id,
                 s.name,
                 s.blurb,
                 s.photo_url,
                 s.price_cents,
                 s.default_qty,
                 s.tag_slugs,
                 s.first_ready_at AS ready_at,
                 'one_off'::text AS kind
          FROM schedules s
          WHERE s.baker_id = ${userId}
            AND s.kind = 'one_off'
            AND s.active = true
            AND s.first_ready_at IS NOT NULL
            AND s.first_ready_at >= NOW()
            AND s.first_ready_at < NOW() + INTERVAL '7 days'
        ),
        recurring AS (
          SELECT s.id,
                 s.name,
                 s.blurb,
                 s.photo_url,
                 s.price_cents,
                 s.default_qty,
                 s.tag_slugs,
                 (date_trunc('day', NOW())
                    + (gs.offset_d || ' days')::interval
                    + (s.time_of_day || ':00')::interval) AS ready_at,
                 'recurring'::text AS kind
          FROM schedules s
          CROSS JOIN generate_series(0, 6) AS gs(offset_d)
          WHERE s.baker_id = ${userId}
            AND s.kind = 'recurring'
            AND s.active = true
            AND s.time_of_day IS NOT NULL
            AND EXTRACT(DOW FROM date_trunc('day', NOW())
                  + (gs.offset_d || ' days')::interval)::int = ANY(
              ARRAY(SELECT jsonb_array_elements_text(s.days_of_week::jsonb)::int)
            )
        ),
        union_all AS (
          SELECT * FROM one_offs UNION ALL SELECT * FROM recurring
        )
        SELECT
          id AS schedule_id,
          name,
          blurb,
          photo_url,
          price_cents,
          default_qty,
          tag_slugs,
          ready_at,
          EXTRACT(DAY FROM ready_at - date_trunc('day', NOW()))::int AS day_offset,
          kind
        FROM union_all
        WHERE ready_at >= NOW()
        ORDER BY ready_at
        LIMIT 50
      `),
    ]);

    if (ownerRow.length === 0) {
      throw new Error(
        `getStorefront: bakerProfiles row for slug ${slug} has no matching users row (userId=${userId})`,
      );
    }

    const listings = listingRows.map(rowToListing);
    const ready = listings.filter((l) => l.status === "ready");
    const scheduled = listings.filter((l) => l.status === "scheduled");

    const upcoming: StorefrontScheduleProjection[] = scheduleRows.map((r) => ({
      scheduleId: r.schedule_id,
      name: r.name,
      blurb: r.blurb,
      photoUrl: r.photo_url,
      priceCents: r.price_cents,
      defaultQty: r.default_qty,
      tagSlugs: r.tag_slugs,
      readyAt: toDate(r.ready_at),
      dayOffset: r.day_offset,
      kind: r.kind,
    }));

    const tagBag = new Set<string>();
    for (const l of listings) for (const t of l.tagSlugs) tagBag.add(t);
    for (const u of upcoming) for (const t of u.tagSlugs) tagBag.add(t);
    const signatureTags = Array.from(tagBag).sort();

    return {
      profile,
      ownerName: ownerRow[0].display_name,
      signatureTags,
      rating: placeholderRating(userId),
      ready,
      scheduled,
      upcoming,
    };
  },
);

// Server-side DB queries that return UI-shape data (see `./types.ts`).
// All functions are async server-only — never import this from a client
// component.

import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { UiBaker, UiEater, UiListing, UiScheduled } from "./types";

// Map a listing's `type` enum from a tag set. The DB doesn't carry a
// dedicated bread-type column on listings (matching is by tag), but the UI
// occasionally branches on a coarse type. We derive it here.
const TYPE_TAG_PRIORITY: Array<UiListing["type"]> = [
  "miche",
  "focaccia",
  "ciabatta",
  "brioche",
  "baguette",
  "rye",
  "sourdough",
];
function deriveType(tagSlugs: string[]): UiListing["type"] {
  const has = (slug: string) => tagSlugs.includes(slug);
  if (has("miche")) return "miche";
  if (has("focaccia")) return "focaccia";
  if (has("ciabatta")) return "ciabatta";
  if (has("brioche")) return "brioche";
  if (has("baguette")) return "baguette";
  if (has("rye-bread") || has("rye")) return "rye";
  return "sourdough";
}

// Deterministic placeholder rating until M2 ships ratings. Hash the baker
// id into [4.5, 5.0]; review count into [12, 380].
function placeholderRating(bakerId: string): { rating: number; reviews: number } {
  let h = 0;
  for (let i = 0; i < bakerId.length; i++) h = (h * 31 + bakerId.charCodeAt(i)) | 0;
  const r = (Math.abs(h) % 51) / 100; // 0.00 - 0.50
  const reviews = 12 + (Math.abs(h >> 8) % 369);
  return { rating: 4.5 + r, reviews };
}

const SEED_EATER_ID = "user_seed_eater";

export async function getEater(): Promise<UiEater> {
  const rows = await db.execute<{
    id: string;
    display_name: string;
    include_tag_slugs: string[];
    exclude_tag_slugs: string[];
    radius_mi: number;
    neighborhood: string | null;
  }>(sql`
    SELECT u.id,
           u.display_name,
           ep.include_tag_slugs,
           ep.exclude_tag_slugs,
           ep.radius_mi,
           NULL::text AS neighborhood
    FROM users u
    JOIN eater_preferences ep ON ep.user_id = u.id
    WHERE u.id = ${SEED_EATER_ID}
    LIMIT 1
  `);
  const r = rows[0];
  if (!r) {
    throw new Error("seed eater not found — run `npm run db:seed`");
  }
  return {
    id: r.id,
    name: r.display_name,
    neighborhood: r.neighborhood ?? "Newlands",
    preferences: {
      include: r.include_tag_slugs,
      exclude: r.exclude_tag_slugs,
      needs: [],
    },
    radiusMi: r.radius_mi,
  };
}

type ListingRow = {
  id: string;
  baker_id: string;
  bakery_name: string;
  baker_slug: string;
  baker_neighborhood: string | null;
  baker_bio: string;
  owner_name: string;
  bread_name: string;
  blurb: string | null;
  photo_url: string | null;
  price_cents: number;
  qty_available: number;
  ready_at: Date | string;
  miles: number;
  tag_slugs: string[];
};

const LISTING_QUERY_BODY = sql`
  SELECT
    l.id,
    l.baker_id,
    bp.bakery_name,
    bp.slug AS baker_slug,
    bp.neighborhood AS baker_neighborhood,
    bp.bio AS baker_bio,
    u.display_name AS owner_name,
    l.name AS bread_name,
    l.blurb,
    l.photo_url,
    l.price_cents,
    l.qty_available,
    l.ready_at,
    ST_DistanceSphere(l.location, eater.location) / 1609.34 AS miles,
    COALESCE(
      (SELECT array_agg(t.slug ORDER BY t.slug)
       FROM listing_tags lt
       JOIN tags t ON t.id = lt.tag_id
       WHERE lt.listing_id = l.id),
      ARRAY[]::text[]
    ) AS tag_slugs
  FROM listings l
  JOIN baker_profiles bp ON bp.user_id = l.baker_id
  JOIN users u ON u.id = l.baker_id
  CROSS JOIN (SELECT location FROM users WHERE id = ${SEED_EATER_ID}) eater
`;

function rowToListing(r: ListingRow): UiListing {
  const readyAt = typeof r.ready_at === "string" ? new Date(r.ready_at) : r.ready_at;
  const minutesFromNow = Math.round((readyAt.getTime() - Date.now()) / 60_000);
  const baker: UiBaker = {
    id: r.baker_id,
    slug: r.baker_slug,
    name: r.bakery_name,
    ownerName: r.owner_name,
    neighborhood: r.baker_neighborhood ?? "Boulder",
    bio: r.baker_bio,
    kitchenTags: r.tag_slugs.filter((t) => t.endsWith("-kitchen")),
    ...placeholderRating(r.baker_id),
  };
  return {
    id: r.id,
    bakerId: r.baker_id,
    baker,
    breadName: r.bread_name,
    type: deriveType(r.tag_slugs),
    tags: r.tag_slugs,
    readyMinutesFromNow: minutesFromNow,
    priceCents: r.price_cents,
    qty: r.qty_available,
    distanceMi: Math.round(Number(r.miles) * 100) / 100,
    photo: r.photo_url ?? "",
    blurb: r.blurb ?? "",
  };
}

export async function getNearbyListings(opts?: { radiusMi?: number; limit?: number }): Promise<UiListing[]> {
  const radiusMi = opts?.radiusMi ?? 2;
  const radiusMeters = radiusMi * 1609.34;
  const limit = opts?.limit ?? 200;

  const rows = await db.execute<ListingRow>(sql`
    ${LISTING_QUERY_BODY}
    WHERE l.status IN ('ready', 'scheduled')
      AND l.ready_at > NOW() - INTERVAL '6 hours'
      AND l.ready_at < NOW() + INTERVAL '7 days'
      AND ST_DistanceSphere(l.location, eater.location) <= ${radiusMeters}
    ORDER BY l.ready_at
    LIMIT ${limit}
  `);

  return rows.map(rowToListing);
}

type ScheduleRow = {
  id: string;
  baker_id: string;
  bakery_name: string;
  baker_slug: string;
  baker_neighborhood: string | null;
  baker_bio: string;
  owner_name: string;
  name: string;
  price_cents: number;
  default_qty: number;
  tag_slugs: string[];
  day_offset: number;
  ready_time_label: string;
};

// Forward 7-day schedule view for variant D. Both materialized listings
// (status='scheduled') and not-yet-materialized recurring schedules are
// projected onto the next 7 days. For E1 we read only `schedules` and
// project recurring entries; planned `listings` show up in the same view
// once the materialization job exists (later epic).
export async function getWeekSchedule(opts?: { radiusMi?: number }): Promise<UiScheduled[]> {
  const radiusMi = opts?.radiusMi ?? 2;
  const radiusMeters = radiusMi * 1609.34;

  // We project schedule entries onto the next 7 days. For one_off entries,
  // use first_ready_at; for recurring, expand days_of_week + time_of_day
  // across the 7-day window.
  const rows = await db.execute<ScheduleRow>(sql`
    WITH eater AS (SELECT location FROM users WHERE id = ${SEED_EATER_ID}),
    baker_dist AS (
      SELECT bp.user_id,
             bp.bakery_name,
             bp.slug,
             bp.neighborhood,
             bp.bio,
             u.display_name AS owner_name,
             ST_DistanceSphere(u.location, e.location) AS meters
      FROM baker_profiles bp
      JOIN users u ON u.id = bp.user_id
      CROSS JOIN eater e
    ),
    one_offs AS (
      SELECT s.id,
             s.baker_id,
             s.name,
             s.price_cents,
             s.default_qty,
             s.tag_slugs,
             s.first_ready_at AS ready_at
      FROM schedules s
      WHERE s.kind = 'one_off'
        AND s.active = true
        AND s.first_ready_at IS NOT NULL
        AND s.first_ready_at >= NOW()
        AND s.first_ready_at < NOW() + INTERVAL '7 days'
    ),
    recurring AS (
      SELECT s.id,
             s.baker_id,
             s.name,
             s.price_cents,
             s.default_qty,
             s.tag_slugs,
             (date_trunc('day', NOW())
                + (gs.offset_d || ' days')::interval
                + (s.time_of_day || ':00')::interval) AS ready_at
      FROM schedules s
      CROSS JOIN generate_series(0, 6) AS gs(offset_d)
      WHERE s.kind = 'recurring'
        AND s.active = true
        AND s.time_of_day IS NOT NULL
        AND EXTRACT(DOW FROM date_trunc('day', NOW()) + (gs.offset_d || ' days')::interval)::int = ANY(
          ARRAY(SELECT jsonb_array_elements_text(s.days_of_week::jsonb)::int)
        )
    ),
    union_all AS (
      SELECT * FROM one_offs UNION ALL SELECT * FROM recurring
    )
    SELECT u.id,
           u.baker_id,
           bd.bakery_name,
           bd.slug AS baker_slug,
           bd.neighborhood AS baker_neighborhood,
           bd.bio AS baker_bio,
           bd.owner_name,
           u.name,
           u.price_cents,
           u.default_qty,
           u.tag_slugs,
           EXTRACT(DAY FROM u.ready_at - date_trunc('day', NOW()))::int AS day_offset,
           to_char(u.ready_at, 'FMHH12:MIam') AS ready_time_label
    FROM union_all u
    JOIN baker_dist bd ON bd.user_id = u.baker_id
    WHERE bd.meters <= ${radiusMeters}
    ORDER BY u.ready_at
    LIMIT 200
  `);

  return rows.map((r) => {
    const baker: UiBaker = {
      id: r.baker_id,
      slug: r.baker_slug,
      name: r.bakery_name,
      ownerName: r.owner_name,
      neighborhood: r.baker_neighborhood ?? "Boulder",
      bio: r.baker_bio,
      kitchenTags: r.tag_slugs.filter((t) => t.endsWith("-kitchen")),
      ...placeholderRating(r.baker_id),
    };
    return {
      id: r.id,
      bakerId: r.baker_id,
      baker,
      breadName: r.name,
      tags: r.tag_slugs,
      priceCents: r.price_cents,
      qty: r.default_qty,
      dayOffset: r.day_offset,
      readyTimeLabel: r.ready_time_label.toLowerCase(),
    };
  });
}

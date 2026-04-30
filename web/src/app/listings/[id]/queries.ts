// Server-only data helpers for /listings/<id>. Kept out of any "use server"
// file so they can't be invoked as RPCs. [LAW:single-enforcer] for reads.
//
// One function — getListingDetail(id) — returns the full UI shape. The
// privacy gradient (pre-claim shows neighborhood, post-claim shows exact
// address) is *data*, not control flow: the query returns both the
// `neighborhood` and the address fields, and the page picks which one to
// show based on the viewer relationship. The actual fuzzed-pin logic
// arrives in breadly-baker-95i.ED5-3 — until then the same fields just
// render different copy. [LAW:dataflow-not-control-flow]

import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export type ListingDetailViewer =
  | { kind: "anonymous" }
  | { kind: "owner"; userId: string }
  | { kind: "eater"; userId: string };

export type ListingDetail = {
  id: string;
  bakerId: string;
  bakerSlug: string;
  bakeryName: string;
  ownerName: string;
  neighborhood: string | null;
  pickupWindowText: string | null;
  // Exact address fields. These are returned but the page only renders
  // them when the viewer has a confirmed claim (privacy gradient).
  addressLine: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;

  name: string;
  blurb: string | null;
  photoUrl: string | null;
  priceCents: number;
  qtyTotal: number;
  qtyAvailable: number;
  status:
    | "scheduled"
    | "ready"
    | "claimed"
    | "picked_up"
    | "cancelled"
    | "expired";
  readyAt: Date;
  outOfOvenAt: Date | null;
  expiresAt: Date | null;
  tagSlugs: string[];
};

type Row = {
  id: string;
  baker_id: string;
  baker_slug: string;
  bakery_name: string;
  owner_name: string;
  neighborhood: string | null;
  pickup_window_text: string | null;
  address_line: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  name: string;
  blurb: string | null;
  photo_url: string | null;
  price_cents: number;
  qty_total: number;
  qty_available: number;
  status: ListingDetail["status"];
  ready_at: string | Date;
  out_of_oven_at: string | Date | null;
  expires_at: string | Date | null;
  tag_slugs: string[];
};

const toDate = (v: string | Date): Date =>
  typeof v === "string" ? new Date(v) : v;

export async function getListingDetail(id: string): Promise<ListingDetail | null> {
  const rows = await db.execute<Row>(sql`
    SELECT
      l.id,
      l.baker_id,
      bp.slug AS baker_slug,
      bp.bakery_name,
      u.display_name AS owner_name,
      bp.neighborhood,
      bp.pickup_window_text,
      u.address_line,
      u.city,
      u.region,
      u.postal_code,
      l.name,
      l.blurb,
      l.photo_url,
      l.price_cents,
      l.qty_total,
      l.qty_available,
      l.status,
      l.ready_at,
      l.out_of_oven_at,
      l.expires_at,
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
    WHERE l.id = ${id}
    LIMIT 1
  `);

  const r = rows[0];
  if (!r) return null;

  return {
    id: r.id,
    bakerId: r.baker_id,
    bakerSlug: r.baker_slug,
    bakeryName: r.bakery_name,
    ownerName: r.owner_name,
    neighborhood: r.neighborhood,
    pickupWindowText: r.pickup_window_text,
    addressLine: r.address_line,
    city: r.city,
    region: r.region,
    postalCode: r.postal_code,
    name: r.name,
    blurb: r.blurb,
    photoUrl: r.photo_url,
    priceCents: r.price_cents,
    qtyTotal: r.qty_total,
    qtyAvailable: r.qty_available,
    status: r.status,
    readyAt: toDate(r.ready_at),
    outOfOvenAt: r.out_of_oven_at === null ? null : toDate(r.out_of_oven_at),
    expiresAt: r.expires_at === null ? null : toDate(r.expires_at),
    tagSlugs: r.tag_slugs,
  };
}

// The viewer's active claim on this listing, or null. The shape is the
// single source for both the privacy gradient (exact address reveal) and
// the eater-facing pickup-code panel — one query, one value, two consumers.
// [LAW:one-source-of-truth]
export type ViewerActiveClaim = {
  id: string;
  qty: number;
  pickupCode: string;
  createdAt: Date;
};

export async function getViewerActiveClaim(
  listingId: string,
  userId: string,
): Promise<ViewerActiveClaim | null> {
  const rows = await db.execute<{
    id: string;
    qty: number;
    pickup_code: string;
    created_at: string | Date;
  }>(sql`
    SELECT id, qty, pickup_code, created_at
    FROM claims
    WHERE listing_id = ${listingId}
      AND eater_id = ${userId}
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    qty: r.qty,
    pickupCode: r.pickup_code,
    createdAt: toDate(r.created_at),
  };
}

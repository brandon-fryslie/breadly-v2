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

// This module mixes reads and a single shared write helper
// (consolidateListingPickedUp). Both belong here because they are
// server-internal — `import "server-only"` keeps them off the client and
// the absence of `"use server"` keeps them off the RPC surface. UI code
// invokes them indirectly through the actions in actions.ts.

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

// The viewer's current claim on this listing, or null. "Current" = active
// or already picked up — i.e. anything except cancelled. Cancelled claims
// resolve to null so the address re-fuzzes and the claim form re-appears.
//
// One query, one value, three consumers (privacy gradient, pickup-code
// reveal, picked-up receipt). The status field is a discriminator, not a
// branch in this query. [LAW:one-source-of-truth]
export type ViewerClaimStatus = "active" | "picked_up";

export type ViewerCurrentClaim = {
  id: string;
  qty: number;
  pickupCode: string;
  status: ViewerClaimStatus;
  createdAt: Date;
  pickedUpAt: Date | null;
};

export async function getViewerCurrentClaim(
  listingId: string,
  userId: string,
): Promise<ViewerCurrentClaim | null> {
  const rows = await db.execute<{
    id: string;
    qty: number;
    pickup_code: string;
    status: ViewerClaimStatus;
    created_at: string | Date;
    picked_up_at: string | Date | null;
  }>(sql`
    SELECT id, qty, pickup_code, status, created_at, picked_up_at
    FROM claims
    WHERE listing_id = ${listingId}
      AND eater_id = ${userId}
      AND status IN ('active', 'picked_up')
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    qty: r.qty,
    pickupCode: r.pickup_code,
    status: r.status,
    createdAt: toDate(r.created_at),
    pickedUpAt: r.picked_up_at === null ? null : toDate(r.picked_up_at),
  };
}

// Listing transitions to 'picked_up' iff inventory is exhausted AND no
// active claims remain. Run after every claim-pickup; the predicate
// (qty_available + active-claim count) decides whether any row mutates.
// Same code path each time. [LAW:dataflow-not-control-flow]
//
// Shared between eater-self-mark (listings/[id]/actions.ts) and the baker
// handoff actions (baker/actions.ts). [LAW:one-source-of-truth] for the
// listing-status transition rule.
export async function consolidateListingPickedUp(
  listingId: string,
): Promise<void> {
  await db.execute(sql`
    UPDATE listings
    SET status = 'picked_up'::listing_status, updated_at = NOW()
    WHERE id = ${listingId}
      AND status IN ('ready', 'claimed')
      AND qty_available = 0
      AND NOT EXISTS (
        SELECT 1 FROM claims c
        WHERE c.listing_id = listings.id AND c.status = 'active'
      )
  `);
}

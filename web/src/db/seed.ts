// Deterministic seed: ~30 bakers, ~100 listings (mix of past/now/scheduled),
// ~40 forward schedule entries, all anchored on real Boulder neighborhoods.
//
// Idempotent against the placeholder seed user. Truncates the relevant
// tables before inserting; preserves Clerk-mirrored real users (those have
// id starting with `user_` but not `user_seed_`).

import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { eq, like } from "drizzle-orm";
import * as schema from "./schema";
import {
  NEIGHBORHOODS,
  TAGS,
  BAKERY_NAMES,
  BREAD_TYPES,
  BREAD_PHOTOS,
  FIRST_NAMES,
  photoUrl,
} from "./seed-data";

// --- deterministic PRNG (mulberry32) so seeded data doesn't churn -------

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260427);
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const range = (min: number, max: number) => min + rand() * (max - min);
const intRange = (min: number, max: number) => Math.floor(range(min, max + 1));
const jitter = (m: number) => (rand() - 0.5) * m;

// Convert a meters-jitter on a centroid to a lat/lng offset.
// 1° lat ≈ 111_320 m; 1° lng ≈ 111_320 * cos(lat).
function jitterLatLng(c: { lat: number; lng: number }, meters: number) {
  const dLat = jitter(meters) / 111_320;
  const dLng = jitter(meters) / (111_320 * Math.cos((c.lat * Math.PI) / 180));
  return { lat: c.lat + dLat, lng: c.lng + dLng };
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Postgres geometry literal builder
const point = (lat: number, lng: number) =>
  sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geometry`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });

  console.log("[seed] clearing seed-owned rows");
  // Order respects FK constraints.
  await db.execute(sql`DELETE FROM listing_tags WHERE listing_id IN (SELECT id FROM listings WHERE baker_id LIKE 'user_seed_%')`);
  await db.execute(sql`DELETE FROM claims WHERE listing_id IN (SELECT id FROM listings WHERE baker_id LIKE 'user_seed_%')`);
  await db.execute(sql`DELETE FROM listings WHERE baker_id LIKE 'user_seed_%'`);
  await db.execute(sql`DELETE FROM schedules WHERE baker_id LIKE 'user_seed_%'`);
  await db.execute(sql`DELETE FROM baker_profiles WHERE user_id LIKE 'user_seed_%'`);
  await db.execute(sql`DELETE FROM eater_preferences WHERE user_id LIKE 'user_seed_%'`);
  await db.execute(sql`DELETE FROM users WHERE id LIKE 'user_seed_%'`);
  await db.execute(sql`DELETE FROM tags WHERE slug = ANY(${sql.raw(`ARRAY[${TAGS.map((t) => `'${t.slug}'`).join(",")}]`)})`);

  // --- tags --------------------------------------------------------------
  console.log("[seed] tags");
  const insertedTags = await db
    .insert(schema.tags)
    .values(TAGS.map((t) => ({ slug: t.slug, label: t.label, kind: t.kind })))
    .returning({ id: schema.tags.id, slug: schema.tags.slug });
  const tagIdBySlug = new Map(insertedTags.map((t) => [t.slug, t.id]));

  // --- the synthetic eater ----------------------------------------------
  console.log("[seed] synthetic eater");
  const eaterCentroid = NEIGHBORHOODS.find((n) => n.slug === "newlands")!.centroid;
  const eaterLoc = jitterLatLng(eaterCentroid, 200);
  await db.insert(schema.users).values({
    id: "user_seed_eater",
    email: "eater@seed.breadly.local",
    displayName: "You",
    canBake: false,
    canOperate: false,
    addressLine: "123 Newlands St",
    city: "Boulder",
    region: "CO",
    postalCode: "80302",
    location: { x: eaterLoc.lng, y: eaterLoc.lat },
  });
  await db.insert(schema.eaterPreferences).values({
    userId: "user_seed_eater",
    includeTagSlugs: ["sourdough"],
    excludeTagSlugs: ["rye-bread"],
    radiusMi: 2,
  });

  // --- bakers ------------------------------------------------------------
  console.log("[seed] bakers");
  const bakers = BAKERY_NAMES.map((b, i) => {
    const hood = NEIGHBORHOODS[i % NEIGHBORHOODS.length];
    const loc = jitterLatLng(hood.centroid, 400);
    const userId = `user_seed_baker_${i}`;
    const slug = slugify(b.name);
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    return {
      userId,
      slug,
      bakeryName: b.name,
      bio: b.bio,
      tier: b.tier,
      neighborhood: hood.name,
      location: loc,
      ownerName: firstName,
    };
  });

  await db.insert(schema.users).values(
    bakers.map((b) => ({
      id: b.userId,
      email: `${b.slug}@seed.breadly.local`,
      displayName: b.ownerName,
      canBake: true,
      canOperate: false,
      addressLine: `${intRange(100, 4900)} ${b.neighborhood} St`,
      city: "Boulder",
      region: "CO",
      postalCode: "80302",
      location: { x: b.location.lng, y: b.location.lat },
    })),
  );

  await db.insert(schema.bakerProfiles).values(
    bakers.map((b) => ({
      userId: b.userId,
      slug: b.slug,
      bakeryName: b.bakeryName,
      neighborhood: b.neighborhood,
      bio: b.bio,
      coverPhotoUrl: photoUrl(pick(BREAD_PHOTOS), 1200),
      pickupWindowText:
        b.tier === "casual"
          ? "Text me when you head over"
          : b.tier === "side"
            ? "Pickup window 9–11am"
            : "Open daily 7am–noon",
      disclaimerAcceptedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * intRange(7, 365)),
      verifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * intRange(1, 90)),
      listingCutoffHours: 24,
    })),
  );

  // --- listings ----------------------------------------------------------
  console.log("[seed] listings");
  const now = Date.now();

  type SeedListing = {
    bakerIdx: number;
    breadIdx: number;
    readyMinutesFromNow: number;
    qty: number;
    priceCents: number;
    status: "ready" | "scheduled" | "claimed" | "expired" | "cancelled" | "picked_up";
  };

  const listingsToCreate: SeedListing[] = [];

  // 25 already-out (recently): -10 to -240 min
  for (let i = 0; i < 25; i++) {
    listingsToCreate.push({
      bakerIdx: intRange(0, bakers.length - 1),
      breadIdx: intRange(0, BREAD_TYPES.length - 1),
      readyMinutesFromNow: -intRange(10, 240),
      qty: intRange(1, 8),
      priceCents: intRange(700, 1800),
      status: "ready",
    });
  }
  // 30 imminent: 0 to 90 min
  for (let i = 0; i < 30; i++) {
    listingsToCreate.push({
      bakerIdx: intRange(0, bakers.length - 1),
      breadIdx: intRange(0, BREAD_TYPES.length - 1),
      readyMinutesFromNow: intRange(0, 90),
      qty: intRange(2, 12),
      priceCents: intRange(700, 1800),
      status: "scheduled",
    });
  }
  // 30 later today: 90 min – 12h
  for (let i = 0; i < 30; i++) {
    listingsToCreate.push({
      bakerIdx: intRange(0, bakers.length - 1),
      breadIdx: intRange(0, BREAD_TYPES.length - 1),
      readyMinutesFromNow: intRange(90, 60 * 12),
      qty: intRange(2, 12),
      priceCents: intRange(700, 1800),
      status: "scheduled",
    });
  }
  // 15 next 1-3 days
  for (let i = 0; i < 15; i++) {
    listingsToCreate.push({
      bakerIdx: intRange(0, bakers.length - 1),
      breadIdx: intRange(0, BREAD_TYPES.length - 1),
      readyMinutesFromNow: intRange(60 * 18, 60 * 24 * 3),
      qty: intRange(4, 16),
      priceCents: intRange(700, 1800),
      status: "scheduled",
    });
  }

  const insertedListings = await db
    .insert(schema.listings)
    .values(
      listingsToCreate.map((l) => {
        const baker = bakers[l.bakerIdx];
        const bread = BREAD_TYPES[l.breadIdx];
        const readyAt = new Date(now + l.readyMinutesFromNow * 60_000);
        return {
          bakerId: baker.userId,
          name: bread.name,
          blurb: pick([
            "Just out — still warm.",
            "Crackly crust, open crumb.",
            "Last one until next bake.",
            "Built for a dinner party.",
            "Sunflower + flax on top.",
            "Take it off my hands.",
            "The kitchen smells incredible.",
            "Pickup window 9–11am.",
          ]),
          photoUrl: photoUrl(pick(BREAD_PHOTOS)),
          priceCents: l.priceCents,
          qtyTotal: l.qty,
          qtyAvailable: l.qty,
          status: l.status,
          readyAt,
          outOfOvenAt: l.readyMinutesFromNow <= 0 ? readyAt : null,
          expiresAt: new Date(readyAt.getTime() + 24 * 60 * 60_000),
          location: { x: baker.location.lng, y: baker.location.lat },
        };
      }),
    )
    .returning({ id: schema.listings.id });

  // attach 2-4 tags per listing
  console.log("[seed] listing_tags");
  const linkRows: { listingId: string; tagId: string }[] = [];
  insertedListings.forEach((l, i) => {
    const bread = BREAD_TYPES[listingsToCreate[i].breadIdx];
    const baker = bakers[listingsToCreate[i].bakerIdx];
    const tagSet = new Set(bread.tags);
    // a baker who's "casual" tier sometimes adds nut-free-kitchen
    if (baker.tier === "casual" && rand() < 0.6) tagSet.add("nut-free-kitchen");
    if (baker.tier === "casual" && rand() < 0.4) tagSet.add("dairy-free-kitchen");
    for (const slug of tagSet) {
      const tagId = tagIdBySlug.get(slug);
      if (tagId) linkRows.push({ listingId: l.id, tagId });
    }
  });
  if (linkRows.length) {
    // chunk to keep parameter count sane
    for (let i = 0; i < linkRows.length; i += 500) {
      await db.insert(schema.listingTags).values(linkRows.slice(i, i + 500));
    }
  }

  // --- schedules ---------------------------------------------------------
  console.log("[seed] schedules");
  const scheduleRows = Array.from({ length: 40 }, (_, i) => {
    const baker = bakers[i % bakers.length];
    const bread = BREAD_TYPES[i % BREAD_TYPES.length];
    const isRecurring = rand() < 0.55;
    return {
      bakerId: baker.userId,
      kind: isRecurring ? ("recurring" as const) : ("one_off" as const),
      name: bread.name,
      blurb: pick([
        "Standing weekly bake.",
        "By reservation only.",
        "Pre-order if you want one held.",
        "First-come first-served.",
      ]),
      photoUrl: photoUrl(pick(BREAD_PHOTOS)),
      priceCents: intRange(700, 1800),
      defaultQty: intRange(4, 16),
      daysOfWeek: isRecurring ? Array.from(new Set([intRange(1, 6), intRange(1, 6)])) : [],
      timeOfDay: isRecurring ? pick(["06:00", "07:00", "08:30", "10:00", "11:30", "14:00"]) : null,
      firstReadyAt: isRecurring
        ? null
        : new Date(now + intRange(60 * 24, 60 * 24 * 7) * 60_000),
      tagSlugs: bread.tags,
      active: true,
    };
  });
  await db.insert(schema.schedules).values(scheduleRows);

  console.log(
    `[seed] done — ${bakers.length} bakers, ${insertedListings.length} listings, ${scheduleRows.length} schedules, ${TAGS.length} tags`,
  );
  await client.end();
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});

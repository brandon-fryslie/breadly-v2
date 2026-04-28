// "Weekend morning" — the canonical demo state. ~30 Boulder bakers,
// ~100 listings spanning recent-past / imminent / later-today / next-few-days,
// 40 schedule entries, one synthetic eater anchored on Newlands. Same data
// `npm run db:seed` has always produced; the pack machinery just gives it
// a name and lets dev-tools rerun it on demand.
//
// Idempotent — calls reset's clearSeedRows() first, so running twice in a
// row leaves the DB in the same state. The deterministic PRNG (seeded by
// date) keeps row content stable between reseeds.

import * as schema from "../schema";
import {
  NEIGHBORHOODS,
  TAGS,
  BAKERY_NAMES,
  BREAD_TYPES,
  BREAD_PHOTOS,
  FIRST_NAMES,
  photoUrl,
} from "../seed-data";
import { clearSeedRows } from "./reset";
import type { Pack, PackContext, PackResult } from "./types";

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

// Convert a meters-jitter on a centroid to a lat/lng offset.
function jitterLatLng(
  c: { lat: number; lng: number },
  meters: number,
  rand: () => number,
) {
  const jitter = (m: number) => (rand() - 0.5) * m;
  const dLat = jitter(meters) / 111_320;
  const dLng = jitter(meters) / (111_320 * Math.cos((c.lat * Math.PI) / 180));
  return { lat: c.lat + dLat, lng: c.lng + dLng };
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const weekendMorningPack: Pack = {
  name: "weekend-morning",
  displayName: "Weekend morning",
  description:
    "30 Boulder bakers across 8 neighborhoods, 100 listings (recent-past, imminent, later-today, next-few-days), 40 schedule entries, 1 synthetic eater anchored on Newlands. The default demo state.",
  destructive: true,
  async run(ctx: PackContext): Promise<PackResult> {
    const { db, log } = ctx;
    const rand = mulberry32(20260427);
    const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
    const range = (min: number, max: number) => min + rand() * (max - min);
    const intRange = (min: number, max: number) =>
      Math.floor(range(min, max + 1));

    log("[weekend-morning] clearing seed-owned rows");
    await clearSeedRows(ctx);

    // --- tags ------------------------------------------------------------
    log("[weekend-morning] tags");
    const insertedTags = await db
      .insert(schema.tags)
      .values(TAGS.map((t) => ({ slug: t.slug, label: t.label, kind: t.kind })))
      .returning({ id: schema.tags.id, slug: schema.tags.slug });
    const tagIdBySlug = new Map(insertedTags.map((t) => [t.slug, t.id]));

    // --- the synthetic eater --------------------------------------------
    log("[weekend-morning] synthetic eater");
    const eaterCentroid = NEIGHBORHOODS.find((n) => n.slug === "newlands")!.centroid;
    const eaterLoc = jitterLatLng(eaterCentroid, 200, rand);
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

    // --- bakers ---------------------------------------------------------
    log("[weekend-morning] bakers");
    const bakers = BAKERY_NAMES.map((b, i) => {
      const hood = NEIGHBORHOODS[i % NEIGHBORHOODS.length];
      const loc = jitterLatLng(hood.centroid, 400, rand);
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
        disclaimerAcceptedAt: new Date(
          Date.now() - 1000 * 60 * 60 * 24 * intRange(7, 365),
        ),
        verifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * intRange(1, 90)),
        listingCutoffHours: 24,
      })),
    );

    // --- listings -------------------------------------------------------
    log("[weekend-morning] listings");
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

    log("[weekend-morning] listing_tags");
    const linkRows: { listingId: string; tagId: string }[] = [];
    insertedListings.forEach((l, i) => {
      const bread = BREAD_TYPES[listingsToCreate[i].breadIdx];
      const baker = bakers[listingsToCreate[i].bakerIdx];
      const tagSet = new Set(bread.tags);
      if (baker.tier === "casual" && rand() < 0.6) tagSet.add("nut-free-kitchen");
      if (baker.tier === "casual" && rand() < 0.4) tagSet.add("dairy-free-kitchen");
      for (const slug of tagSet) {
        const tagId = tagIdBySlug.get(slug);
        if (tagId) linkRows.push({ listingId: l.id, tagId });
      }
    });
    if (linkRows.length) {
      for (let i = 0; i < linkRows.length; i += 500) {
        await db.insert(schema.listingTags).values(linkRows.slice(i, i + 500));
      }
    }

    // --- schedules ------------------------------------------------------
    log("[weekend-morning] schedules");
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
        daysOfWeek: isRecurring
          ? Array.from(new Set([intRange(1, 6), intRange(1, 6)]))
          : [],
        timeOfDay: isRecurring
          ? pick(["06:00", "07:00", "08:30", "10:00", "11:30", "14:00"])
          : null,
        firstReadyAt: isRecurring
          ? null
          : new Date(now + intRange(60 * 24, 60 * 24 * 7) * 60_000),
        tagSlugs: bread.tags,
        active: true,
      };
    });
    await db.insert(schema.schedules).values(scheduleRows);

    return {
      message: `Loaded ${bakers.length} bakers, ${insertedListings.length} listings, ${scheduleRows.length} schedules, ${TAGS.length} tags.`,
      counts: {
        bakers: bakers.length,
        listings: insertedListings.length,
        schedules: scheduleRows.length,
        tags: TAGS.length,
      },
    };
  },
};

// Drizzle schema covering the M1 tables.
//
// Conventions:
//  - All ids are uuid (gen_random_uuid()) except `users.id` which mirrors
//    Clerk's user id (string, prefixed `user_...`).
//  - All timestamps are `timestamptz` with default `now()`.
//  - PostGIS `geography(Point, 4326)` for any lat/lng point. The migration
//    runs `CREATE EXTENSION IF NOT EXISTS postgis` before tables are made.
//  - Tag system is one mechanism (per universal-laws / data-driven
//    architecture). `tags.kind` is informational only — it does not change
//    matching behavior; matching is by tag identity.
//
// Entities here cover M1 (cold core loop). M2/M3 tables (ratings, follows,
// subscriptions, bounties, notifications) are added when their epics start.

import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  pgEnum,
  primaryKey,
  uuid,
  index,
  geometry,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// --- PostGIS geometry point ----------------------------------------------
//
// Stored as `geometry(point, 4326)`. Radius queries cast to ::geography at
// query time, e.g.
//
//   ST_DWithin(loc::geography, ST_MakePoint(:lng,:lat)::geography, :meters)
//
// At Boulder distances (≲10mi) this is identical to a stored geography
// column — and using geometry plays nicely with drizzle's first-class type.
export const point = (name: string) =>
  geometry(name, { type: "point", mode: "xy", srid: 4326 });

// --- Enums ---------------------------------------------------------------

export const listingStatus = pgEnum("listing_status", [
  "scheduled",
  "ready",
  "claimed",
  "picked_up",
  "cancelled",
  "expired",
]);

export const claimStatus = pgEnum("claim_status", [
  "active",
  "picked_up",
  "cancelled_by_eater",
  "cancelled_by_baker",
  "no_show",
]);

export const tagKind = pgEnum("tag_kind", [
  "style",      // sourdough, country, baguette, miche
  "dietary",    // vegan, gluten-free, dairy-free, nut-free
  "ingredient", // rye, wheat, seeded
  "process",    // long-ferment, wood-fired
  "kitchen",    // nut-free-kitchen, dairy-free-kitchen
]);

export const scheduleKind = pgEnum("schedule_kind", [
  "one_off",
  "recurring",
]);

// --- Users ---------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    // Clerk user id (e.g. "user_2abc..."). We mirror Clerk on user.created.
    id: varchar("id", { length: 64 }).primaryKey(),
    email: text("email").notNull().unique(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),

    // Capabilities — single user, multi-role. Eater is implicit (always true);
    // baker and operator are opt-in. (one-type-per-behavior law)
    canBake: boolean("can_bake").notNull().default(false),
    canOperate: boolean("can_operate").notNull().default(false),
    // [LAW:one-type-per-behavior] Dev-tools is a capability flag, not a
    // separate user kind. The /dev-tools panel additionally requires the
    // server to be running in a non-prod env (single-enforcer gate in
    // src/lib/dev-tools-gate.ts).
    canDev: boolean("can_dev").notNull().default(false),

    // Address geocoded once at save. Optional for eaters (some users only
    // browse maps); required when canBake=true (enforced at app layer).
    addressLine: text("address_line"),
    city: text("city"),
    region: text("region"),
    postalCode: text("postal_code"),
    location: point("location"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("users_location_idx").using("gist", t.location),
    index("users_can_bake_idx").on(t.canBake),
  ],
);

// --- Baker profiles (1:1 with users when canBake) ------------------------

export const bakerProfiles = pgTable(
  "baker_profiles",
  {
    userId: varchar("user_id", { length: 64 })
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),

    slug: varchar("slug", { length: 64 }).notNull().unique(), // /b/<slug>
    bakeryName: text("bakery_name").notNull(),
    neighborhood: text("neighborhood"),
    bio: text("bio"),
    coverPhotoUrl: text("cover_photo_url"),

    // Default pickup window the baker has configured ("after 10am", etc.)
    pickupWindowText: text("pickup_window_text"),

    // Cottage-food disclaimer accepted at this timestamp; mocked
    // verification approves at verifiedAt.
    disclaimerAcceptedAt: timestamp("disclaimer_accepted_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),

    // Baker-configured cutoff in hours after which a `ready` listing is
    // auto-hidden. Default 24h.
    listingCutoffHours: integer("listing_cutoff_hours").notNull().default(24),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("baker_profiles_slug_idx").on(t.slug)],
);

// --- Tags ----------------------------------------------------------------

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // canonical machine-friendly identifier — what code matches against
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    label: text("label").notNull(),
    kind: tagKind("kind").notNull(),
  },
);

// --- Listings ------------------------------------------------------------

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bakerId: varchar("baker_id", { length: 64 })
      .notNull()
      .references(() => bakerProfiles.userId, { onDelete: "cascade" }),

    name: text("name").notNull(),
    blurb: text("blurb"),
    photoUrl: text("photo_url"),

    priceCents: integer("price_cents").notNull(),
    qtyTotal: integer("qty_total").notNull(),
    qtyAvailable: integer("qty_available").notNull(),

    status: listingStatus("status").notNull().default("scheduled"),

    // The one moment that matters: scheduled or actual ready time.
    readyAt: timestamp("ready_at", { withTimezone: true }).notNull(),
    // Set when status flips to `ready`.
    outOfOvenAt: timestamp("out_of_oven_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    // Snapshotted from the baker's location when the listing is created.
    location: point("location").notNull(),

    // For listings born from a schedule entry; null for spontaneous posts.
    scheduleId: uuid("schedule_id").references((): any => schedules.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("listings_status_idx").on(t.status),
    index("listings_ready_at_idx").on(t.readyAt),
    index("listings_baker_idx").on(t.bakerId),
    index("listings_location_idx").using("gist", t.location),
  ],
);

// --- Listing tags (junction) --------------------------------------------

export const listingTags = pgTable(
  "listing_tags",
  {
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.listingId, t.tagId] }),
    index("listing_tags_tag_idx").on(t.tagId),
  ],
);

// --- Eater preferences (1:1 with users) ----------------------------------

export const eaterPreferences = pgTable("eater_preferences", {
  userId: varchar("user_id", { length: 64 })
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),

  // Tag slugs the eater wants to see prioritized.
  includeTagSlugs: jsonb("include_tag_slugs").$type<string[]>().notNull().default([]),
  // Tag slugs the eater wants to hide / treat as deal-breakers.
  excludeTagSlugs: jsonb("exclude_tag_slugs").$type<string[]>().notNull().default([]),

  // Search radius in miles for the home feed.
  radiusMi: integer("radius_mi").notNull().default(2),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Claims --------------------------------------------------------------

export const claims = pgTable(
  "claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "restrict" }),
    eaterId: varchar("eater_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    qty: integer("qty").notNull().default(1),

    status: claimStatus("status").notNull().default("active"),

    // 4-digit pickup code, shown to one party, entered by the other.
    pickupCode: varchar("pickup_code", { length: 8 }).notNull(),

    pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("claims_eater_idx").on(t.eaterId),
    index("claims_listing_idx").on(t.listingId),
    index("claims_status_idx").on(t.status),
  ],
);

// --- Schedules -----------------------------------------------------------
//
// A schedule entry says "Country sourdough, every Tuesday + Friday at 6am,
// 8 loaves." For one-off entries, the dayOfWeek/hour fields are unused
// and the single concrete `firstReadyAt` carries the moment.
//
// Materialization (cron job, future epic) walks active schedule entries
// forward and creates `listings` rows in `scheduled` status.

export const schedules = pgTable(
  "schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bakerId: varchar("baker_id", { length: 64 })
      .notNull()
      .references(() => bakerProfiles.userId, { onDelete: "cascade" }),

    kind: scheduleKind("kind").notNull(),

    name: text("name").notNull(),
    blurb: text("blurb"),
    photoUrl: text("photo_url"),
    priceCents: integer("price_cents").notNull(),
    defaultQty: integer("default_qty").notNull(),

    // For recurring: ISO weekday set as JSON array, plus local-time HH:mm.
    // For one_off: ignored; firstReadyAt is the truth.
    daysOfWeek: jsonb("days_of_week").$type<number[]>().notNull().default([]), // 0=Sun..6=Sat
    timeOfDay: varchar("time_of_day", { length: 5 }), // "06:00"
    firstReadyAt: timestamp("first_ready_at", { withTimezone: true }),

    // Tag set inherited by every materialized listing (snake_case slugs).
    tagSlugs: jsonb("tag_slugs").$type<string[]>().notNull().default([]),

    active: boolean("active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("schedules_baker_idx").on(t.bakerId)],
);

// --- Type exports --------------------------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type BakerProfile = typeof bakerProfiles.$inferSelect;
export type NewBakerProfile = typeof bakerProfiles.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type Claim = typeof claims.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type EaterPreferences = typeof eaterPreferences.$inferSelect;

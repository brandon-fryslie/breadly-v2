// Wipe all seed-owned rows so the next pack starts from a clean slate.
// Real Clerk-mirrored users (id starts with "user_" but not "user_seed_")
// are untouched. The pack itself reinserts nothing — that's another pack's
// job. Idempotent.

import { sql } from "drizzle-orm";
import { TAGS } from "../seed-data";
import type { Pack, PackContext, PackResult } from "./types";

export async function clearSeedRows({ db }: PackContext): Promise<void> {
  // FK-respecting delete order.
  await db.execute(sql`DELETE FROM listing_tags WHERE listing_id IN (SELECT id FROM listings WHERE baker_id LIKE 'user_seed_%')`);
  await db.execute(sql`DELETE FROM claims WHERE listing_id IN (SELECT id FROM listings WHERE baker_id LIKE 'user_seed_%')`);
  await db.execute(sql`DELETE FROM listings WHERE baker_id LIKE 'user_seed_%'`);
  await db.execute(sql`DELETE FROM schedules WHERE baker_id LIKE 'user_seed_%'`);
  await db.execute(sql`DELETE FROM baker_profiles WHERE user_id LIKE 'user_seed_%'`);
  await db.execute(sql`DELETE FROM eater_preferences WHERE user_id LIKE 'user_seed_%'`);
  await db.execute(sql`DELETE FROM users WHERE id LIKE 'user_seed_%'`);
  await db.execute(
    sql`DELETE FROM tags WHERE slug = ANY(${sql.raw(`ARRAY[${TAGS.map((t) => `'${t.slug}'`).join(",")}]`)})`,
  );
}

export const resetPack: Pack = {
  name: "reset",
  displayName: "Reset",
  description:
    "Delete every seed-owned row (users, baker profiles, listings, claims, schedules, tags). Real Clerk users are untouched. Run before another pack to start clean.",
  destructive: true,
  async run(ctx: PackContext): Promise<PackResult> {
    ctx.log("[reset] clearing seed-owned rows");
    await clearSeedRows(ctx);
    return {
      message: "Reset complete. Load another pack to populate.",
      counts: { bakers: 0, listings: 0, schedules: 0, tags: 0 },
    };
  },
};

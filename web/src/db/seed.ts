// CLI wrapper around the seed-pack registry. `npm run db:seed` runs the
// default pack (weekend-morning); `npm run db:seed -- <pack-name>` runs a
// named pack. The same packs are surfaced in /dev-tools.
//
// All real seeding logic lives in src/db/seed-packs/. This file only
// translates argv → pack, opens a postgres-js handle, calls run(), and
// closes the connection. [LAW:one-source-of-truth]

import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { getPack, PACKS } from "./seed-packs/registry";

const DEFAULT_PACK = "weekend-morning";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const requested = process.argv[2] ?? DEFAULT_PACK;
  const pack = getPack(requested);
  if (!pack) {
    const known = PACKS.map((p) => p.name).join(", ");
    throw new Error(`Unknown pack '${requested}'. Known: ${known}`);
  }

  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });

  console.log(`[seed] running pack '${pack.name}' — ${pack.displayName}`);
  const result = await pack.run({ db, log: (m) => console.log(m) });
  console.log(`[seed] ${result.message}`);

  await client.end();
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});

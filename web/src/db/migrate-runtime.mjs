// Production-image migration entrypoint. Standalone Next builds strip
// devDependencies, which kills `tsx` (used by the dev-side `npm run
// db:migrate`). This script runs from the runtime image with only
// `drizzle-orm` + `postgres` (both production deps), and reads the SQL
// files we explicitly COPY into /app/drizzle in the Dockerfile.
//
// Invoke from the runtime image:
//   node src/db/migrate-runtime.mjs
//
// Used by the `breadly-migrate` Cloud Run Job. Locally we still use
// `npm run db:migrate` (tsx) — both call into the same drizzle migrator
// against the same drizzle/ folder, so they stay in lock-step.
// [LAW:one-source-of-truth]

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// Same Cloud SQL socket parse as src/db/client.ts. [LAW:single-enforcer]
const parsed = new URL(url);
const socketHost = parsed.searchParams.get("host");
parsed.search = "";
const sql = postgres(parsed.toString(), {
  max: 1,
  prepare: false,
  ...(socketHost && socketHost.startsWith("/") ? { host: socketHost } : {}),
});

const here = dirname(fileURLToPath(import.meta.url));
// Where drizzle/ lands varies:
//   dev / `npm run db:migrate`:  web/drizzle/        — 3 levels up from src/db/
//   standalone runtime image:    /app/drizzle        — explicit COPY in Dockerfile
const candidates = [
  resolve(here, "../../drizzle"),
  "/app/drizzle",
];
const migrationsFolder = candidates.find((p) => existsSync(p));
if (!migrationsFolder) {
  throw new Error(
    `[migrate-runtime] no migrations folder found. Tried: ${candidates.join(", ")}`,
  );
}

console.log(`[migrate-runtime] applying migrations from ${migrationsFolder}`);
const db = drizzle(sql);
await migrate(db, { migrationsFolder });
console.log("[migrate-runtime] done");
await sql.end();

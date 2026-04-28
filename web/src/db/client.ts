// Singleton Drizzle client. On Cloud Run the DATABASE_URL points at the
// Cloud SQL Auth Proxy unix socket (`host=/cloudsql/<connection>`); locally
// it points at docker-compose Postgres on tcp.

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __breadly_pg__: postgres.Sql | undefined;
}

function makeClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return postgres(url, {
    // Cloud Run's container concurrency is high; keep pool small per instance.
    max: 5,
    idle_timeout: 20,
    prepare: false, // avoid pgbouncer-style prepared-statement issues if we ever front with one
  });
}

// Reuse a single connection across hot reloads in dev.
const sql = global.__breadly_pg__ ?? makeClient();
if (process.env.NODE_ENV !== "production") {
  global.__breadly_pg__ = sql;
}

export const db = drizzle(sql, { schema });
export { sql };
export type DB = typeof db;

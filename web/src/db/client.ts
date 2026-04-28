// Singleton Drizzle client. On Cloud Run the DATABASE_URL points at the
// Cloud SQL Auth Proxy unix socket (`host=/cloudsql/<connection>`); locally
// it points at docker-compose Postgres on tcp.
//
// Lazy: we don't read DATABASE_URL until the first query. This lets the
// container build (`next build`) succeed without a live DATABASE_URL.

import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __breadly_pg__: Sql | undefined;
}

let _sql: Sql | undefined;
function getSql(): Sql {
  if (_sql) return _sql;
  if (global.__breadly_pg__) {
    _sql = global.__breadly_pg__;
    return _sql;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  // Cloud SQL unix socket URLs encode the socket path as `?host=/cloudsql/...`.
  // postgres-js connects to the URL's authority (localhost:5432) and ignores
  // the query param, so we promote `?host=` to an explicit option.
  // [LAW:dataflow-not-control-flow] one parse path; the data (presence of
  // socket host) decides which connection target wins.
  const parsed = new URL(url);
  const socketHost = parsed.searchParams.get("host");
  // postgres-js forwards remaining query params to Postgres as GUC settings;
  // strip them after we've harvested what we need so server doesn't reject.
  parsed.search = "";
  const opts: Parameters<typeof postgres>[1] = {
    max: 5,
    idle_timeout: 20,
    prepare: false,
    ...(socketHost && socketHost.startsWith("/") ? { host: socketHost } : {}),
  };
  _sql = postgres(parsed.toString(), opts);
  if (process.env.NODE_ENV !== "production") {
    global.__breadly_pg__ = _sql;
  }
  return _sql;
}

// Lazy proxy — calls into the underlying drizzle instance only on first
// access. Build-time module evaluation can import `db` without triggering
// a connection.
function getDb() {
  return drizzle(getSql(), { schema });
}

export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop as string];
  },
});

export { getSql as sql };
export type DB = ReturnType<typeof getDb>;

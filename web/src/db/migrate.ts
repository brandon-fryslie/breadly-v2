// Apply pending Drizzle migrations against DATABASE_URL.
// Ensures PostGIS is installed before any table-creation migration runs.

import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const sql = postgres(url, { max: 1 });
  // PostGIS must exist before any geography column is created. Idempotent.
  await sql`CREATE EXTENSION IF NOT EXISTS postgis`;
  console.log("[migrate] postgis ready");

  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[migrate] migrations applied");

  await sql.end();
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});

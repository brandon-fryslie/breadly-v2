// Drop and recreate the public schema, then re-apply all migrations.
// Local-dev convenience; never run against prod.

import "dotenv/config";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (process.env.BREADLY_ENV === "prod") {
    throw new Error("[reset] refusing to run against BREADLY_ENV=prod");
  }

  const sql = postgres(url, { max: 1 });
  console.log("[reset] dropping public schema");
  await sql`DROP SCHEMA IF EXISTS public CASCADE`;
  await sql`CREATE SCHEMA public`;
  await sql`GRANT ALL ON SCHEMA public TO public`;
  await sql.end();

  console.log("[reset] re-running migrations");
  await import("./migrate.js"); // tsx will resolve as .ts
}

main().catch((err) => {
  console.error("[reset] failed:", err);
  process.exit(1);
});

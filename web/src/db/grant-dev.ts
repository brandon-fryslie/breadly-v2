// Operational tool: flip users.can_dev=true for a user by email.
//
// Used to bootstrap the very first dev-tools admin (after that, admins
// promote each other through the panel). Also serves as the emergency
// lever if every admin is somehow revoked. The "auth" for this tool is
// the same auth as the database itself: you need DATABASE_URL and the
// network reach to use it.
//
//   npm run db:grant-dev -- <email>           # grant
//   npm run db:grant-dev -- --revoke <email>  # revoke
//
// Idempotent. Exits non-zero if the email isn't a known user — they must
// have signed up via Clerk + been mirrored via the user.created webhook
// before the row exists.

import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

function usage(): never {
  console.error(
    "usage: npm run db:grant-dev -- <email>\n" +
      "       npm run db:grant-dev -- --revoke <email>",
  );
  process.exit(2);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const args = process.argv.slice(2);
  let revoke = false;
  let email: string | undefined;
  for (const a of args) {
    if (a === "--revoke") revoke = true;
    else if (!email) email = a;
    else usage();
  }
  if (!email) usage();
  const target = email.trim().toLowerCase();
  if (!target.includes("@")) usage();

  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    const row = await db.query.users.findFirst({
      where: eq(schema.users.email, target),
      columns: { id: true, displayName: true, canDev: true },
    });
    if (!row) {
      console.error(
        `[grant-dev] no user with email '${target}'. They must sign up first.`,
      );
      process.exit(1);
    }

    const desired = !revoke;
    if (row.canDev === desired) {
      console.log(
        `[grant-dev] ${row.displayName} <${target}> already can_dev=${desired}; nothing to do.`,
      );
      return;
    }

    await db
      .update(schema.users)
      .set({ canDev: desired, updatedAt: new Date() })
      .where(eq(schema.users.id, row.id));

    console.log(
      `[grant-dev] ${row.displayName} <${target}> can_dev=${desired}.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[grant-dev] failed:", err);
  process.exit(1);
});

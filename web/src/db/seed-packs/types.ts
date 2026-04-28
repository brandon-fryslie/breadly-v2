// Seed-pack contract. Every demo state in /dev-tools is a Pack. The pack
// machinery owns the *interface* — packs themselves are pure data + a
// run function. There is one registry, one runner, one server action;
// adding a pack is one file under this directory plus one line in
// registry.ts. [LAW:one-type-per-behavior]

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../schema";

export type DbHandle = PostgresJsDatabase<typeof schema>;

export type PackContext = {
  db: DbHandle;
  log: (msg: string) => void;
};

export type PackResult = {
  message: string;
  counts: Record<string, number>;
};

export type Pack = {
  // Machine slug. Doubles as the typed-in confirmation token for
  // destructive packs — keep it short and memorable.
  name: string;
  displayName: string;
  description: string;
  // Destructive packs delete rows. The dev-tools UI requires the user to
  // type `name` into a confirm input before the action will run.
  destructive: boolean;
  run(ctx: PackContext): Promise<PackResult>;
};

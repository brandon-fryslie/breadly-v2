"use server";

// Server actions for /dev-tools. Every action goes through one of the
// single-enforcer gates in src/lib/dev-tools-gate.ts.

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireDevBootstrap } from "@/lib/dev-tools-gate";

// ED4-1 bootstrap: signed-in user grants themselves canDev. Allowed only
// when BREADLY_DEV_MODE=true (enforced by requireDevBootstrap). In prod the
// env gate is off, so this action 404s before touching the DB.
export async function enableSelfDev(): Promise<void> {
  const { userId } = await requireDevBootstrap();
  await db
    .update(users)
    .set({ canDev: true, updatedAt: new Date() })
    .where(eq(users.id, userId));
  revalidatePath("/dev-tools");
}

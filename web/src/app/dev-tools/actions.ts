"use server";

// Server actions for /dev-tools. Every action goes through one of the
// single-enforcer gates in src/lib/dev-tools-gate.ts.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireDevBootstrap, requireDevTools } from "@/lib/dev-tools-gate";
import { getPack } from "@/db/seed-packs/registry";

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

// ED4-2: run a named seed pack against the live DB. Two gates have already
// fired by the time this runs (env + canDev via requireDevTools). For
// destructive packs we additionally require the user to type the pack name
// into a confirm input — that token is the third gate, here.
export async function runSeedPack(formData: FormData): Promise<void> {
  await requireDevTools();

  const name = String(formData.get("name") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const pack = getPack(name);
  if (!pack) {
    redirect(`/dev-tools?status=unknown-pack&pack=${encodeURIComponent(name)}`);
  }

  if (pack.destructive && confirm !== pack.name) {
    redirect(
      `/dev-tools?status=confirm-required&pack=${encodeURIComponent(pack.name)}`,
    );
  }

  const logs: string[] = [];
  // The `db` proxy is the same handle the rest of the app uses — packs
  // get the production connection, not a one-shot. Fine: the dev-tools
  // panel only runs in dev/staging. [LAW:one-source-of-truth]
  const result = await pack.run({
    db: db as unknown as Parameters<typeof pack.run>[0]["db"],
    log: (m) => logs.push(m),
  });

  // Light logging so the user sees what happened in dev terminals.
  for (const line of logs) console.log(line);
  console.log(`[dev-tools] pack='${pack.name}' ${result.message}`);

  revalidatePath("/dev-tools");
  redirect(
    `/dev-tools?status=ok&pack=${encodeURIComponent(pack.name)}&msg=${encodeURIComponent(result.message)}`,
  );
}

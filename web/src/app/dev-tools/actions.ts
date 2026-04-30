"use server";

// Server actions for /dev-tools. Every action goes through the single
// gate in src/lib/dev-tools-gate.ts. [LAW:single-enforcer]

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireDevTools } from "@/lib/dev-tools-gate";
import { getPack } from "@/db/seed-packs/registry";

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
  const result = await pack.run({
    db: db as unknown as Parameters<typeof pack.run>[0]["db"],
    log: (m) => logs.push(m),
  });

  for (const line of logs) console.log(line);
  console.log(`[dev-tools] pack='${pack.name}' ${result.message}`);

  revalidatePath("/dev-tools");
  redirect(
    `/dev-tools?status=ok&pack=${encodeURIComponent(pack.name)}&msg=${encodeURIComponent(result.message)}`,
  );
}

// Admin management. Only existing canDev admins can grant or revoke. The
// first admin is bootstrapped out-of-band via `npm run db:grant-dev`.
//
// All grants/revokes funnel through these two actions — no other code
// path writes to users.can_dev. [LAW:single-enforcer]

function devToolsRedirect(params: Record<string, string>): never {
  const qs = new URLSearchParams(params).toString();
  redirect(`/dev-tools?${qs}`);
}

export async function promoteToDev(formData: FormData): Promise<void> {
  const viewer = await requireDevTools();

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) {
    devToolsRedirect({ admin_status: "missing-email" });
  }

  const target = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true, canDev: true },
  });
  if (!target) {
    devToolsRedirect({ admin_status: "no-user", admin_email: email });
  }

  if (target.canDev) {
    devToolsRedirect({ admin_status: "already-admin", admin_email: email });
  }

  await db
    .update(users)
    .set({ canDev: true, updatedAt: new Date() })
    .where(eq(users.id, target.id));

  console.log(
    `[dev-tools] promote can_dev=true email=${email} by=${viewer.userId}`,
  );
  revalidatePath("/dev-tools");
  devToolsRedirect({ admin_status: "promoted", admin_email: email });
}

export async function revokeDev(formData: FormData): Promise<void> {
  const viewer = await requireDevTools();

  const targetId = String(formData.get("userId") ?? "");
  if (!targetId) {
    devToolsRedirect({ admin_status: "missing-user" });
  }

  // Hard rule: an admin can't revoke themselves. Prevents the panel from
  // accidentally locking out its last operator. The bootstrap CLI is the
  // emergency lever if every admin is gone. [LAW:dataflow-not-control-flow]
  // — same code path always runs; the data (target == self) decides.
  if (targetId === viewer.userId) {
    devToolsRedirect({ admin_status: "cannot-self-revoke" });
  }

  await db
    .update(users)
    .set({ canDev: false, updatedAt: new Date() })
    .where(eq(users.id, targetId));

  console.log(
    `[dev-tools] revoke can_dev=false userId=${targetId} by=${viewer.userId}`,
  );
  revalidatePath("/dev-tools");
  devToolsRedirect({ admin_status: "revoked" });
}

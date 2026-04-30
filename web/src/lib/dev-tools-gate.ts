// [LAW:single-enforcer] One gate for /dev-tools access. Every page, server
// action, and API route under /dev-tools calls requireDevTools() — there is
// no second check anywhere. Two checks must both pass:
//
//   1. Env gate: BREADLY_DEV_MODE === "true". Single flag for the whole
//      dev/test surface; prod doesn't set it and 404s here regardless of
//      capability.
//
//   2. Capability gate: the user must have canDev=true in the local users
//      row. The capability is data: granted by an existing canDev admin
//      through the dev-tools UI, or by an operator running
//      `npm run db:grant-dev <email>` against the DB to bootstrap the
//      first admin. There is no in-app self-grant — that would defeat the
//      gate on a public deployment.
//
// On any failure we call notFound() — never redirect, never show a "you
// can't see this" message. Existence of the panel is not advertised.

import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export function isDevModeEnabled(): boolean {
  return process.env.BREADLY_DEV_MODE === "true";
}

export type DevToolsViewer = {
  userId: string;
  canDev: true;
};

export async function requireDevTools(): Promise<DevToolsViewer> {
  if (!isDevModeEnabled()) notFound();

  const { userId } = await auth();
  if (!userId) notFound();

  const me = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { canDev: true },
  });
  if (!me?.canDev) notFound();

  return { userId, canDev: true };
}

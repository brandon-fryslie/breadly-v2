// [LAW:single-enforcer] One gate for /dev-tools access. Every page, server
// action, and API route under /dev-tools calls one of these helpers — there
// is no second check anywhere. Two checks must both pass:
//
//   1. Env gate: the deployment must opt in via BREADLY_ENABLE_DEV_TOOLS=true.
//      Production Cloud Run revisions don't set it; dev/staging do. This
//      means even a logged-in canDev user gets a 404 in prod.
//
//   2. Capability gate: the user must have canDev=true in the local users
//      row. Mirrors the canBake/canOperate pattern.
//
// On any failure we call notFound() — never redirect, never show a "you
// can't see this" message. Existence of the panel is not advertised.

import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export function isDevToolsEnvEnabled(): boolean {
  return process.env.BREADLY_ENABLE_DEV_TOOLS === "true";
}

export type DevToolsViewer = {
  userId: string;
  canDev: true;
};

// Server-component / server-action gate. Returns the viewer when allowed,
// triggers Next's notFound() otherwise. Never returns null — callers can
// treat the return value as "definitely allowed."
export async function requireDevTools(): Promise<DevToolsViewer> {
  if (!isDevToolsEnvEnabled()) notFound();

  const { userId } = await auth();
  if (!userId) notFound();

  const me = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { canDev: true },
  });
  if (!me?.canDev) notFound();

  return { userId, canDev: true };
}

// For the bootstrap path: a signed-in user wants to grant themselves canDev
// the first time. Allowed only when the env gate is on. Distinct from
// requireDevTools because the user *doesn't yet* have the capability.
export async function requireDevBootstrap(): Promise<{ userId: string }> {
  if (!isDevToolsEnvEnabled()) notFound();
  const { userId } = await auth();
  if (!userId) notFound();
  return { userId };
}

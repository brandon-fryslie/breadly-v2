// Clerk webhook → local users table mirror.
//
// Configure in Clerk Dashboard → Webhooks:
//   Endpoint URL: https://<your-cloud-run-url>/api/webhooks/clerk
//   Subscribe to: user.created, user.updated, user.deleted
//   Save the signing secret as `CLERK_WEBHOOK_SECRET` (Secret Manager).

import { Webhook } from "svix";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ClerkEvent =
  | {
      type: "user.created" | "user.updated";
      data: {
        id: string;
        email_addresses: { id: string; email_address: string }[];
        primary_email_address_id: string | null;
        first_name: string | null;
        last_name: string | null;
        image_url: string | null;
      };
    }
  | { type: "user.deleted"; data: { id: string; deleted: boolean } };

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return new Response("CLERK_WEBHOOK_SECRET not set", { status: 500 });

  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));

  const requiredHeaders = ["svix-id", "svix-timestamp", "svix-signature"];
  for (const h of requiredHeaders) {
    if (!headers[h]) return new Response(`missing ${h}`, { status: 400 });
  }

  const body = await req.text();

  let evt: ClerkEvent;
  try {
    evt = new Webhook(secret).verify(body, {
      "svix-id": headers["svix-id"],
      "svix-timestamp": headers["svix-timestamp"],
      "svix-signature": headers["svix-signature"],
    }) as ClerkEvent;
  } catch (e) {
    console.error("[clerk webhook] verification failed:", e);
    return new Response("invalid signature", { status: 400 });
  }

  switch (evt.type) {
    case "user.created":
    case "user.updated": {
      const u = evt.data;
      const primary = u.email_addresses.find((e) => e.id === u.primary_email_address_id);
      const email = primary?.email_address ?? u.email_addresses[0]?.email_address;
      if (!email) return new Response("user has no email", { status: 400 });
      const displayName = [u.first_name, u.last_name].filter(Boolean).join(" ") || email;

      await db
        .insert(users)
        .values({
          id: u.id,
          email,
          displayName,
          avatarUrl: u.image_url ?? null,
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email,
            displayName,
            avatarUrl: u.image_url ?? null,
            updatedAt: sql`now()`,
          },
        });
      return Response.json({ ok: true, action: evt.type });
    }
    case "user.deleted": {
      // Cascade-deletes baker_profiles, eater_preferences, etc. via FKs.
      // restrict on listings/claims is intentional — preserve transaction
      // history; we mark email + name to "[deleted]" instead of full delete
      // when there are referenced rows.
      const id = evt.data.id;
      await db
        .delete(users)
        .where(eq(users.id, id))
        .catch(async (err: unknown) => {
          // FK restriction (listings/claims). Soft-delete instead.
          console.warn("[clerk webhook] delete blocked, soft-deleting:", err);
          await db
            .update(users)
            .set({
              email: `deleted-${id}@breadly.local`,
              displayName: "[deleted]",
              avatarUrl: null,
              updatedAt: sql`now()`,
            })
            .where(eq(users.id, id));
        });
      return Response.json({ ok: true, action: "user.deleted" });
    }
    default:
      return Response.json({ ok: true, action: "ignored" });
  }
}

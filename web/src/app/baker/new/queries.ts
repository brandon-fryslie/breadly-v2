// Server-only data helpers for /baker/new. Kept out of actions.ts so a
// "use server" boundary doesn't accidentally expose this as a callable RPC.

import "server-only";
import { db } from "@/db/client";
import { tags } from "@/db/schema";

export async function listTags() {
  return db
    .select({
      id: tags.id,
      slug: tags.slug,
      label: tags.label,
      kind: tags.kind,
    })
    .from(tags)
    .orderBy(tags.kind, tags.label);
}

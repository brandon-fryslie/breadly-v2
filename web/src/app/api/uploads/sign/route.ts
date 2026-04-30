// Issues a v4 signed PUT URL for a listing photo upload.
//
// Single enforcer for "who is allowed to drop bytes in the photos bucket":
// auth → canBake capability → content-type allow-list. Everything in the
// bucket below `listings/<userId>/` was let through this route.
// [LAW:single-enforcer]
//
// Variability lives in the request body (contentType), not control flow:
// the same code path runs every call — invalid input becomes a typed
// error response, not a skipped operation. [LAW:dataflow-not-control-flow]

import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  isAllowedPhotoContentType,
  signListingPhotoPut,
} from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = { contentType?: unknown };

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const me = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { canBake: true },
  });
  if (!me?.canBake) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const ct = typeof body.contentType === "string" ? body.contentType : "";
  if (!isAllowedPhotoContentType(ct)) {
    return Response.json(
      {
        error: "unsupported_content_type",
        message: "Photo must be JPEG, PNG, or WebP.",
      },
      { status: 400 },
    );
  }

  const signed = await signListingPhotoPut({ userId, contentType: ct });
  return Response.json(signed);
}

// Baker landing. Visible only to users with canBake. Stub for E2;
// E3 wires the post-a-loaf form + listing list.

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db/client";
import { users, bakerProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function BakerHome() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/baker");

  const me = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { canBake: true },
  });
  if (!me?.canBake) redirect("/me");

  const profile = await db.query.bakerProfiles.findFirst({
    where: eq(bakerProfiles.userId, userId),
  });

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
          Baker mode
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {profile?.bakeryName ?? "Your bakery"}
        </h1>
        {profile?.slug ? (
          <p className="text-sm text-stone-500 mt-1">/b/{profile.slug}</p>
        ) : null}
      </header>

      <section className="rounded-xl border border-stone-200 bg-white px-6 py-5">
        <h2 className="text-lg font-semibold mb-1">No listings yet</h2>
        <p className="text-sm text-stone-600 mb-4">
          The post-a-loaf form ships with E3 — coming next. For now your bakery
          page is reserved at <code className="text-xs">{profile?.slug}</code>.
        </p>
        <Link
          href="/me"
          className="text-sm text-stone-700 underline hover:text-stone-900"
        >
          Back to profile
        </Link>
      </section>
    </main>
  );
}

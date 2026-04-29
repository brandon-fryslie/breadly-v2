// Post-a-loaf form. Hot path: experienced baker should be able to land
// here, fill the form, and submit in well under 30s.
//
// Auth + capability gate happens here in the page (so users without canBake
// are bounced before we even render the form). The action redoes the gate
// itself — single enforcer for capability flips & writes still lives there.

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { listTags } from "./queries";
import { PostLoafForm } from "./post-loaf-form";

export const dynamic = "force-dynamic";

export default async function PostLoafPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/baker/new");

  const me = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { canBake: true },
  });
  if (!me?.canBake) redirect("/me");

  const tags = await listTags();

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
          Post a loaf
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          What did you bake?
        </h1>
        <p className="text-sm text-stone-500 mt-2">
          One page. Photo, name, ready time, qty, price. Done.
        </p>
      </header>

      <section className="rounded-xl border border-stone-200 bg-white px-6 py-6">
        <PostLoafForm allTags={tags} />
      </section>

      <Link
        href="/baker"
        className="text-sm text-stone-500 underline hover:text-stone-900"
      >
        Cancel
      </Link>
    </main>
  );
}

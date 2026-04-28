// Profile page: shows mirrored Clerk identity + local capabilities, with
// a one-step affordance to claim baker capability.
//
// Auth is enforced by `proxy.ts` which wraps `/me(.*)` in `auth.protect()`.

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { users, bakerProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { claimBaker } from "./actions";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/me");

  const me = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  // Webhook race: Clerk just signed the user up but our webhook hasn't
  // mirrored them yet. Show a placeholder; the page will pick them up on
  // refresh (typically <2s after Clerk fires user.created).
  if (!me) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold mb-3">Welcome to Breadly</h1>
        <p className="text-stone-600">
          Setting up your account. Refresh in a few seconds.
        </p>
      </main>
    );
  }

  const baker = me.canBake
    ? await db.query.bakerProfiles.findFirst({
        where: eq(bakerProfiles.userId, userId),
      })
    : null;

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <header className="flex items-center gap-4">
        {me.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={me.avatarUrl}
            alt=""
            className="w-12 h-12 rounded-full bg-stone-200"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-stone-200" />
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {me.displayName}
          </h1>
          <p className="text-sm text-stone-500">{me.email}</p>
        </div>
      </header>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-2">
          Capabilities
        </h2>
        <ul className="text-sm space-y-1">
          <li>
            <span className="text-stone-500">Eater</span>
            <span className="ml-3 text-emerald-600">✓ active</span>
          </li>
          <li>
            <span className="text-stone-500">Baker</span>
            <span
              className={`ml-3 ${
                me.canBake ? "text-emerald-600" : "text-stone-400"
              }`}
            >
              {me.canBake ? `✓ ${baker?.bakeryName ?? "claimed"}` : "not claimed"}
            </span>
          </li>
          <li>
            <span className="text-stone-500">Operator</span>
            <span
              className={`ml-3 ${
                me.canOperate ? "text-emerald-600" : "text-stone-400"
              }`}
            >
              {me.canOperate ? "✓ active" : "not granted"}
            </span>
          </li>
        </ul>
      </section>

      {me.canBake ? null : (
        <section className="rounded-xl border border-stone-200 bg-white px-6 py-5">
          <h2 className="text-lg font-semibold mb-1">Become a baker</h2>
          <p className="text-sm text-stone-600 mb-4">
            Bakers can post loaves on Breadly. You can do this and still browse
            as an eater — they're the same account.
          </p>
          <form action={claimBaker} className="flex flex-col gap-3">
            <label className="text-sm">
              <span className="block text-stone-700 mb-1">Bakery name</span>
              <input
                name="bakeryName"
                type="text"
                required
                placeholder="e.g. Boulder Hearth"
                className="w-full border border-stone-300 rounded-md px-3 py-2 focus:outline-none focus:border-stone-500"
              />
            </label>
            <button
              type="submit"
              className="self-start bg-stone-900 text-white rounded-md px-4 py-2 hover:bg-stone-700"
            >
              Claim baker capability
            </button>
          </form>
        </section>
      )}
    </main>
  );
}

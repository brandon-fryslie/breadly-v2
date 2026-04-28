// /dev-tools — gated panel for seeding, time-travel, impersonation, and
// DB inspection. ED4 ships sub-features one ticket at a time; this is the
// foundational shell + capability bootstrap.
//
// Gate: src/lib/dev-tools-gate.ts (single-enforcer). Page and any future
// server actions/API routes under /dev-tools must call requireDevTools()
// or requireDevBootstrap().

import {
  isDevModeEnabled,
  requireDevBootstrap,
} from "@/lib/dev-tools-gate";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { enableSelfDev } from "./actions";

export const dynamic = "force-dynamic";

export default async function DevToolsHome() {
  // Env gate (single-enforcer) — but we render the bootstrap UI for
  // signed-in users without canDev, so we don't use requireDevTools() here.
  if (!isDevModeEnabled()) notFound();
  const { userId } = await requireDevBootstrap();

  const me = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { displayName: true, email: true, canDev: true },
  });
  if (!me) notFound();

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <header>
        <p className="text-xs uppercase tracking-widest text-amber-700 mb-2">
          Dev tools · BREADLY_DEV_MODE=true
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Seeded reality on demand
        </h1>
        <p className="mt-3 text-stone-600 max-w-xl text-sm leading-relaxed">
          Seed packs, time-travel, impersonation, DB inspector. Hard-disabled
          in production by an env gate; further gated by your <code>canDev</code>{" "}
          capability.
        </p>
      </header>

      {me.canDev ? <DevToolsShell viewer={me} /> : <BootstrapShell viewer={me} />}
    </main>
  );
}

function BootstrapShell({
  viewer,
}: {
  viewer: { displayName: string; email: string };
}) {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-5">
      <h2 className="text-lg font-semibold mb-1">Enable dev tools for yourself</h2>
      <p className="text-sm text-stone-700 mb-4">
        Signed in as <strong>{viewer.displayName}</strong> ({viewer.email}). Dev
        tools is opt-in per user. Granting it to yourself works only when{" "}
        <code>BREADLY_DEV_MODE=true</code> on this deployment. Production
        doesn't set it, so this page 404s there regardless of capability.
      </p>
      <form action={enableSelfDev}>
        <button
          type="submit"
          className="bg-stone-900 text-white text-sm rounded-md px-4 py-2 hover:bg-stone-700"
        >
          Grant me canDev
        </button>
      </form>
    </section>
  );
}

function DevToolsShell({ viewer }: { viewer: { displayName: string } }) {
  const sections: Array<{
    title: string;
    desc: string;
    status: "shipping" | "next" | "later";
    ticket: string;
  }> = [
    {
      title: "Seed packs",
      desc: "Idempotent named DB states (weekend-morning, sparse-tuesday, bounty-pressure, reset).",
      status: "next",
      ticket: "ED4-2",
    },
    {
      title: "Time-travel",
      desc: "Set the system clock forward/back; scheduled bakes materialize on demand.",
      status: "next",
      ticket: "ED4-3",
    },
    {
      title: "Impersonation",
      desc: "Jump into any seeded user's session. Audit-logged.",
      status: "later",
      ticket: "ED4-4",
    },
    {
      title: "DB inspector",
      desc: "Read-only table + row-count view. Catches stale-seed demos.",
      status: "later",
      ticket: "ED4-5",
    },
  ];
  return (
    <>
      <p className="text-sm text-stone-600">
        Welcome, {viewer.displayName}. Sub-panels land one ticket at a time.
      </p>
      <ul className="grid sm:grid-cols-2 gap-3">
        {sections.map((s) => (
          <li
            key={s.title}
            className="rounded-xl border border-stone-200 bg-white px-5 py-4"
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-stone-900">{s.title}</h3>
              <span
                className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${
                  s.status === "shipping"
                    ? "bg-emerald-100 text-emerald-700"
                    : s.status === "next"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-stone-100 text-stone-500"
                }`}
              >
                {s.status === "shipping"
                  ? "live"
                  : s.status === "next"
                    ? `next · ${s.ticket}`
                    : s.ticket}
              </span>
            </div>
            <p className="text-sm text-stone-600 leading-relaxed">{s.desc}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

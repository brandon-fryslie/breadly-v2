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
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { enableSelfDev, runSeedPack } from "./actions";
import { PACKS } from "@/db/seed-packs/registry";

export const dynamic = "force-dynamic";

type SearchParams = {
  status?: string;
  pack?: string;
  msg?: string;
};

export default async function DevToolsHome({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Env gate (single-enforcer) — but we render the bootstrap UI for
  // signed-in users without canDev, so we don't use requireDevTools() here.
  if (!isDevModeEnabled()) notFound();
  const { userId } = await requireDevBootstrap();

  const me = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { displayName: true, email: true, canDev: true },
  });
  if (!me) notFound();

  const sp = await searchParams;

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

      {me.canDev ? (
        <DevToolsShell viewer={me} status={sp} />
      ) : (
        <BootstrapShell viewer={me} />
      )}
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

function DevToolsShell({
  viewer,
  status,
}: {
  viewer: { displayName: string };
  status: { status?: string; pack?: string; msg?: string };
}) {
  const upcoming: Array<{ title: string; desc: string; ticket: string }> = [
    {
      title: "Time-travel",
      desc: "Set the system clock forward/back; scheduled bakes materialize on demand.",
      ticket: "ED4-3",
    },
    {
      title: "Impersonation",
      desc: "Jump into any seeded user's session. Audit-logged.",
      ticket: "ED4-4",
    },
    {
      title: "DB inspector",
      desc: "Read-only table + row-count view. Catches stale-seed demos.",
      ticket: "ED4-5",
    },
  ];
  return (
    <div className="space-y-8">
      <p className="text-sm text-stone-600">
        Welcome, {viewer.displayName}. Sub-panels land one ticket at a time.
      </p>

      <SeedPacksSection status={status} />

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-500 mb-3">
          Coming next
        </h2>
        <ul className="grid sm:grid-cols-3 gap-3">
          {upcoming.map((s) => (
            <li
              key={s.title}
              className="rounded-xl border border-stone-200 bg-white px-5 py-4"
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-stone-900 text-sm">{s.title}</h3>
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-stone-100 text-stone-500">
                  {s.ticket}
                </span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">{s.desc}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SeedPacksSection({
  status,
}: {
  status: { status?: string; pack?: string; msg?: string };
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-500">
          Seed packs
        </h2>
        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
          ED4-2 · live
        </span>
      </div>

      <StatusBanner status={status} />

      <ul className="space-y-3">
        {PACKS.map((p) => (
          <li
            key={p.name}
            className="rounded-xl border border-stone-200 bg-white px-5 py-4"
          >
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <h3 className="font-semibold text-stone-900">
                {p.displayName}{" "}
                <code className="text-xs font-normal text-stone-500">
                  {p.name}
                </code>
              </h3>
              {p.destructive ? (
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-red-100 text-red-700">
                  destructive
                </span>
              ) : null}
            </div>
            <p className="text-sm text-stone-600 leading-relaxed mb-3">
              {p.description}
            </p>
            <form action={runSeedPack} className="flex flex-wrap gap-2 items-center">
              <input type="hidden" name="name" value={p.name} />
              {p.destructive ? (
                <input
                  type="text"
                  name="confirm"
                  required
                  placeholder={`type "${p.name}" to confirm`}
                  className="text-sm border border-stone-300 rounded-md px-3 py-1.5 flex-1 min-w-[14rem]"
                  autoComplete="off"
                />
              ) : (
                <input type="hidden" name="confirm" value={p.name} />
              )}
              <button
                type="submit"
                className="bg-stone-900 text-white text-sm rounded-md px-4 py-1.5 hover:bg-stone-700"
              >
                Run pack
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusBanner({
  status,
}: {
  status: { status?: string; pack?: string; msg?: string };
}) {
  if (!status.status) return null;
  if (status.status === "ok") {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <strong>{status.pack}</strong>: {status.msg}
      </div>
    );
  }
  if (status.status === "confirm-required") {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Type the pack name into the confirm field to run <code>{status.pack}</code>.
      </div>
    );
  }
  if (status.status === "unknown-pack") {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        Unknown pack: <code>{status.pack}</code>.
      </div>
    );
  }
  return null;
}

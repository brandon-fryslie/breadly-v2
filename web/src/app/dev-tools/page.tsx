// /dev-tools — gated panel. Requires BREADLY_DEV_MODE=true *and*
// users.can_dev=true on the viewer's row. The first admin is bootstrapped
// out-of-band via `npm run db:grant-dev`; subsequent admins are managed
// through the Admins section here. There is no in-app self-grant.
//
// Gate: src/lib/dev-tools-gate.ts (single-enforcer). Page and every
// server action under /dev-tools call requireDevTools().

import { requireDevTools } from "@/lib/dev-tools-gate";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { promoteToDev, revokeDev, runSeedPack } from "./actions";
import { PACKS } from "@/db/seed-packs/registry";

export const dynamic = "force-dynamic";

type SearchParams = {
  status?: string;
  pack?: string;
  msg?: string;
  admin_status?: string;
  admin_email?: string;
};

export default async function DevToolsHome({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requireDevTools();
  const me = await db.query.users.findFirst({
    where: eq(users.id, viewer.userId),
    columns: { displayName: true, email: true },
  });
  const admins = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
    })
    .from(users)
    .where(eq(users.canDev, true))
    .orderBy(users.email);

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
          in production by an env gate; further gated by the{" "}
          <code>can_dev</code> capability on your user row.
        </p>
        {me ? (
          <p className="mt-2 text-xs text-stone-500">
            Signed in as <strong>{me.displayName}</strong> ({me.email}).
          </p>
        ) : null}
      </header>

      <SeedPacksSection status={sp} />

      <AdminsSection
        admins={admins}
        viewerId={viewer.userId}
        status={sp}
      />

      <ComingNextSection />
    </main>
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

      <SeedStatusBanner status={status} />

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

function SeedStatusBanner({
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

function AdminsSection({
  admins,
  viewerId,
  status,
}: {
  admins: Array<{ id: string; email: string; displayName: string }>;
  viewerId: string;
  status: { admin_status?: string; admin_email?: string };
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-500">
          Admins
        </h2>
        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
          can_dev
        </span>
      </div>

      <AdminStatusBanner status={status} />

      <div className="rounded-xl border border-stone-200 bg-white px-5 py-4 space-y-4">
        <p className="text-sm text-stone-600">
          Anyone listed below has full access to dev-tools — including
          impersonation and the DB inspector once those ship. Promote
          carefully; revoke when no longer needed. The first admin is
          bootstrapped via{" "}
          <code className="text-xs">npm run db:grant-dev &lt;email&gt;</code>{" "}
          against the database directly.
        </p>

        <ul className="divide-y divide-stone-100 border-y border-stone-100">
          {admins.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <div>
                <span className="text-stone-900">{a.displayName}</span>{" "}
                <span className="text-stone-500">({a.email})</span>
                {a.id === viewerId ? (
                  <span className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">
                    you
                  </span>
                ) : null}
              </div>
              {a.id === viewerId ? (
                <span className="text-xs text-stone-400">cannot self-revoke</span>
              ) : (
                <form action={revokeDev}>
                  <input type="hidden" name="userId" value={a.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-700 hover:text-red-900 underline"
                  >
                    Revoke
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>

        <form
          action={promoteToDev}
          className="flex flex-wrap gap-2 items-center"
        >
          <label className="text-xs text-stone-600 sr-only" htmlFor="promote-email">
            Email
          </label>
          <input
            id="promote-email"
            type="email"
            name="email"
            required
            placeholder="email@example.com"
            className="text-sm border border-stone-300 rounded-md px-3 py-1.5 flex-1 min-w-[16rem]"
            autoComplete="off"
          />
          <button
            type="submit"
            className="bg-stone-900 text-white text-sm rounded-md px-4 py-1.5 hover:bg-stone-700"
          >
            Promote
          </button>
        </form>
      </div>
    </section>
  );
}

function AdminStatusBanner({
  status,
}: {
  status: { admin_status?: string; admin_email?: string };
}) {
  const s = status.admin_status;
  if (!s) return null;
  const email = status.admin_email;
  if (s === "promoted") {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        Promoted <strong>{email}</strong> to admin.
      </div>
    );
  }
  if (s === "revoked") {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        Admin access revoked.
      </div>
    );
  }
  if (s === "no-user") {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        No user found for <code>{email}</code>. They must sign up first.
      </div>
    );
  }
  if (s === "already-admin") {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <code>{email}</code> already has admin access.
      </div>
    );
  }
  if (s === "missing-email") {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        Email is required.
      </div>
    );
  }
  if (s === "cannot-self-revoke") {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        You can&apos;t revoke your own admin access from the panel. Use the
        bootstrap CLI if you need to.
      </div>
    );
  }
  return null;
}

function ComingNextSection() {
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
  );
}

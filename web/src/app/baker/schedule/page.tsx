// /baker/schedule — list of recurring + one-off schedules. Each row links
// to its editor. Deactivated schedules sort to the bottom.

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { listSchedules } from "./queries";
import { deactivateSchedule, reactivateSchedule } from "./actions";

export const dynamic = "force-dynamic";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const fmtPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function fmtDays(days: number[]): string {
  if (days.length === 0) return "—";
  return [...days].sort().map((d) => DAY_SHORT[d]).join(" · ");
}

function fmtOneOff(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function SchedulePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/baker/schedule");

  const me = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { canBake: true },
  });
  if (!me?.canBake) redirect("/me");

  const rows = await listSchedules(userId);
  const active = rows.filter((r) => r.active);
  const archived = rows.filter((r) => !r.active);

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.25em] text-stone-500 mb-2">
          Baker · schedule
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
          Bake schedule
        </h1>
        <p className="text-sm text-stone-500 mt-2">
          Plan your week. Recurring entries repeat every week; one-offs are
          single planned bakes. Listings are materialized from these by a
          separate job (later epic).
        </p>
      </header>

      <Link
        href="/baker/schedule/new"
        className="inline-flex items-center gap-2 bg-stone-900 text-white text-sm rounded-md px-4 py-2 hover:bg-stone-700"
      >
        + New schedule entry
      </Link>

      <Section
        title="Active"
        empty="No active schedule yet. Add a recurring weekly bake or a one-off."
        count={active.length}
      >
        {active.map((r) => (
          <ScheduleRow key={r.id} row={r} archived={false} />
        ))}
      </Section>

      <Section
        title="Archived"
        empty="No archived schedules."
        count={archived.length}
      >
        {archived.map((r) => (
          <ScheduleRow key={r.id} row={r} archived />
        ))}
      </Section>

      <Link
        href="/baker"
        className="text-sm text-stone-500 underline hover:text-stone-900"
      >
        ← Back to today
      </Link>
    </main>
  );
}

function Section({
  title,
  empty,
  count,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  const slug = title.toLowerCase();
  return (
    <section data-testid={`section-${slug}`}>
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="text-lg font-semibold tracking-tight text-stone-900">
          {title}
        </h2>
        <span className="ml-auto text-sm text-stone-400 tabular-nums">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p className="text-sm text-stone-500 italic border-l-2 border-stone-200 pl-3">
          {empty}
        </p>
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
    </section>
  );
}

function ScheduleRow({
  row,
  archived,
}: {
  row: import("@/db/schema").Schedule;
  archived: boolean;
}) {
  const cadence =
    row.kind === "recurring"
      ? `${fmtDays(row.daysOfWeek)} · ${row.timeOfDay ?? "—"}`
      : `One-off · ${fmtOneOff(row.firstReadyAt)}`;
  return (
    <li
      className={`flex items-center gap-4 rounded-lg border px-4 py-3 ${
        archived
          ? "border-stone-200 bg-stone-50 text-stone-500"
          : "border-stone-200 bg-white"
      }`}
      data-testid="schedule-row"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <Link
            href={`/baker/schedule/${row.id}`}
            className="font-semibold text-stone-900 truncate hover:underline"
          >
            {row.name}
          </Link>
          <span className="text-[10px] uppercase tracking-widest text-stone-400">
            {row.kind === "recurring" ? "weekly" : "once"}
          </span>
        </div>
        <p className="text-xs text-stone-500 mt-0.5">
          {cadence} · {row.defaultQty} loaves · {fmtPrice(row.priceCents)}
        </p>
      </div>
      <form action={archived ? reactivateSchedule : deactivateSchedule}>
        <input type="hidden" name="id" value={row.id} />
        <button
          type="submit"
          className="text-xs underline text-stone-500 hover:text-stone-900"
        >
          {archived ? "Reactivate" : "Deactivate"}
        </button>
      </form>
    </li>
  );
}

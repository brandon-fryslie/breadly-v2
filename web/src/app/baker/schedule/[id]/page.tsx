import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { tags, users } from "@/db/schema";
import { listTags } from "@/app/baker/new/queries";
import { ScheduleForm } from "../schedule-form";
import {
  updateSchedule,
  type ScheduleFormState,
} from "../actions";
import { getSchedule } from "../queries";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditSchedulePage({ params }: PageProps) {
  const { id } = await params;

  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/baker/schedule/${id}`);

  const me = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { canBake: true },
  });
  if (!me?.canBake) redirect("/me");

  const row = await getSchedule(userId, id);
  if (!row) notFound();

  const allTags = await listTags();
  // Translate persisted tag slugs back to ids for the form.
  // [LAW:dataflow-not-control-flow] same path runs whether tagSlugs is
  // empty or not — the lookup just returns an empty result.
  const tagRows = row.tagSlugs.length
    ? await db
        .select({ id: tags.id, slug: tags.slug })
        .from(tags)
        .where(inArray(tags.slug, row.tagSlugs))
    : [];
  const tagIds = tagRows.map((t) => t.id);

  const initialState: ScheduleFormState = {
    fieldErrors: {},
    values: {
      name: row.name,
      blurb: row.blurb ?? "",
      photoUrl: row.photoUrl ?? "",
      priceDollars: (row.priceCents / 100).toFixed(2),
      defaultQty: String(row.defaultQty),
      kind: row.kind,
      daysOfWeek: row.daysOfWeek,
      timeOfDay: row.timeOfDay ?? "",
      firstReadyAt: row.firstReadyAt ? row.firstReadyAt.toISOString() : "",
      tagIds,
    },
  };

  const boundUpdate = updateSchedule.bind(null, id);

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
          Edit schedule entry
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{row.name}</h1>
        <p className="text-sm text-stone-500 mt-2">
          {row.active ? "Active." : "Archived — reactivate from the list."}
        </p>
      </header>

      <section className="rounded-xl border border-stone-200 bg-white px-6 py-6">
        <ScheduleForm
          action={boundUpdate}
          initialState={initialState}
          allTags={allTags}
          submitLabel="Save changes"
          pendingLabel="Saving…"
        />
      </section>

      <Link
        href="/baker/schedule"
        className="text-sm text-stone-500 underline hover:text-stone-900"
      >
        Cancel
      </Link>
    </main>
  );
}

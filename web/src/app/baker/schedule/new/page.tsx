import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { listTags } from "@/app/baker/new/queries";
import { ScheduleForm } from "../schedule-form";
import { createSchedule, type ScheduleFormState } from "../actions";

export const dynamic = "force-dynamic";

const initialState: ScheduleFormState = {
  fieldErrors: {},
  values: {
    name: "",
    blurb: "",
    photoUrl: "",
    priceDollars: "",
    defaultQty: "6",
    kind: "recurring",
    daysOfWeek: [],
    timeOfDay: "",
    firstReadyAt: "",
    tagIds: [],
  },
};

export default async function NewSchedulePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/baker/schedule/new");

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
          New schedule entry
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Plan a bake
        </h1>
        <p className="text-sm text-stone-500 mt-2">
          Recurring or one-off. You can edit or deactivate any entry later.
        </p>
      </header>

      <section className="rounded-xl border border-stone-200 bg-white px-6 py-6">
        <ScheduleForm
          action={createSchedule}
          initialState={initialState}
          allTags={tags}
          submitLabel="Create schedule"
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

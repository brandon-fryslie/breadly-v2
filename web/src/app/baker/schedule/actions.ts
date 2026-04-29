"use server";

// Schedule create / update / deactivate. Single enforcer for schedule
// writes — UI never inserts/updates schedules directly. [LAW:single-enforcer]
//
// `tagIds` come in from the form (matches /baker/new's UX), but the
// schedules row stores tag *slugs* (jsonb<string[]>) because the
// materialization job uses slugs as stable ids when minting listings.
// We translate at this boundary (anti-corruption layer).

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { bakerProfiles, schedules, tags, users } from "@/db/schema";

export type ScheduleFormFields =
  | "name"
  | "blurb"
  | "photoUrl"
  | "priceDollars"
  | "defaultQty"
  | "kind"
  | "daysOfWeek"
  | "timeOfDay"
  | "firstReadyAt"
  | "tagIds";

export type ScheduleFormState = {
  fieldErrors: Partial<Record<ScheduleFormFields, string>>;
  values: {
    name: string;
    blurb: string;
    photoUrl: string;
    priceDollars: string;
    defaultQty: string;
    kind: "recurring" | "one_off";
    daysOfWeek: number[];
    timeOfDay: string;
    firstReadyAt: string;
    tagIds: string[];
  };
  generalError?: string;
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function parseInteger(input: string, opts: { min?: number; max?: number } = {}): number | null {
  if (input.trim() === "") return null;
  const n = Number(input);
  if (!Number.isInteger(n)) return null;
  if (opts.min !== undefined && n < opts.min) return null;
  if (opts.max !== undefined && n > opts.max) return null;
  return n;
}

type Validated = {
  name: string;
  blurb: string | null;
  photoUrl: string | null;
  priceCents: number;
  defaultQty: number;
  kind: "recurring" | "one_off";
  daysOfWeek: number[];
  timeOfDay: string | null;
  firstReadyAt: Date | null;
  tagSlugs: string[];
};

async function readForm(formData: FormData): Promise<{
  values: ScheduleFormState["values"];
  fieldErrors: ScheduleFormState["fieldErrors"];
  parsed: Validated | null;
  generalError?: string;
}> {
  const tagIdsRaw = formData.getAll("tagIds").map(String);
  const daysRaw = formData.getAll("daysOfWeek").map(String);
  const kindRaw = ((formData.get("kind") as string) ?? "recurring").trim();
  const kind: "recurring" | "one_off" =
    kindRaw === "one_off" ? "one_off" : "recurring";

  const values: ScheduleFormState["values"] = {
    name: ((formData.get("name") as string) ?? "").trim(),
    blurb: ((formData.get("blurb") as string) ?? "").trim(),
    photoUrl: ((formData.get("photoUrl") as string) ?? "").trim(),
    priceDollars: ((formData.get("priceDollars") as string) ?? "").trim(),
    defaultQty: ((formData.get("defaultQty") as string) ?? "").trim(),
    kind,
    daysOfWeek: daysRaw
      .map((d) => Number(d))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
    timeOfDay: ((formData.get("timeOfDay") as string) ?? "").trim(),
    firstReadyAt: ((formData.get("firstReadyAt") as string) ?? "").trim(),
    tagIds: tagIdsRaw,
  };

  const fieldErrors: ScheduleFormState["fieldErrors"] = {};

  if (!values.name) fieldErrors.name = "Required";
  else if (values.name.length > 80) fieldErrors.name = "Max 80 characters";

  if (values.blurb.length > 400) fieldErrors.blurb = "Max 400 characters";

  if (values.photoUrl) {
    try {
      const u = new URL(values.photoUrl);
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        fieldErrors.photoUrl = "Must be an http(s) URL";
      }
    } catch {
      fieldErrors.photoUrl = "Not a valid URL";
    }
  }

  let priceCents: number | null = null;
  if (values.priceDollars === "") {
    fieldErrors.priceDollars = "Required";
  } else {
    const dollars = Number(values.priceDollars);
    if (!Number.isFinite(dollars) || dollars < 0) {
      fieldErrors.priceDollars = "Enter a non-negative number";
    } else {
      priceCents = Math.round(dollars * 100);
      if (priceCents > 100_000_00) fieldErrors.priceDollars = "Too high";
    }
  }

  const defaultQty = parseInteger(values.defaultQty, { min: 1, max: 999 });
  if (defaultQty === null) fieldErrors.defaultQty = "Whole number, 1 or more";

  let firstReadyAt: Date | null = null;
  let timeOfDay: string | null = null;
  let daysOfWeek: number[] = [];

  if (kind === "recurring") {
    daysOfWeek = Array.from(new Set(values.daysOfWeek)).sort();
    if (daysOfWeek.length === 0) {
      fieldErrors.daysOfWeek = "Pick at least one day";
    }
    if (!TIME_RE.test(values.timeOfDay)) {
      fieldErrors.timeOfDay = "Use HH:MM (24h)";
    } else {
      timeOfDay = values.timeOfDay;
    }
  } else {
    if (!values.firstReadyAt) {
      fieldErrors.firstReadyAt = "Required";
    } else {
      const d = new Date(values.firstReadyAt);
      if (Number.isNaN(d.getTime())) {
        fieldErrors.firstReadyAt = "Invalid date";
      } else {
        firstReadyAt = d;
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { values, fieldErrors, parsed: null };
  }

  // Translate tag ids → slugs. Reject the whole submission on any unknown id
  // (tampering or deleted tag). [LAW:dataflow-not-control-flow]: variability
  // lives in the data — same lookup runs every time.
  let tagSlugs: string[] = [];
  if (values.tagIds.length > 0) {
    const known = await db
      .select({ id: tags.id, slug: tags.slug })
      .from(tags)
      .where(inArray(tags.id, values.tagIds));
    if (known.length !== values.tagIds.length) {
      return {
        values,
        fieldErrors: { tagIds: "One or more tags are no longer valid" },
        parsed: null,
      };
    }
    tagSlugs = known.map((t) => t.slug).sort();
  }

  return {
    values,
    fieldErrors: {},
    parsed: {
      name: values.name,
      blurb: values.blurb || null,
      photoUrl: values.photoUrl || null,
      priceCents: priceCents!,
      defaultQty: defaultQty!,
      kind,
      daysOfWeek,
      timeOfDay,
      firstReadyAt,
      tagSlugs,
    },
  };
}

async function requireBakerProfile(userId: string) {
  const me = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { canBake: true },
  });
  const profile = await db.query.bakerProfiles.findFirst({
    where: eq(bakerProfiles.userId, userId),
  });
  return { canBake: me?.canBake ?? false, profile };
}

export async function createSchedule(
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/baker/schedule/new");

  const { values, fieldErrors, parsed } = await readForm(formData);
  if (!parsed) return { values, fieldErrors };

  const { canBake, profile } = await requireBakerProfile(userId);
  if (!canBake || !profile) {
    return {
      values,
      fieldErrors: {},
      generalError:
        "You need to claim baker capability before creating a schedule.",
    };
  }

  await db.insert(schedules).values({
    bakerId: userId,
    kind: parsed.kind,
    name: parsed.name,
    blurb: parsed.blurb,
    photoUrl: parsed.photoUrl,
    priceCents: parsed.priceCents,
    defaultQty: parsed.defaultQty,
    daysOfWeek: parsed.daysOfWeek,
    timeOfDay: parsed.timeOfDay,
    firstReadyAt: parsed.firstReadyAt,
    tagSlugs: parsed.tagSlugs,
    active: true,
  });

  revalidatePath("/baker/schedule");
  revalidatePath("/baker");
  redirect("/baker/schedule");
}

export async function updateSchedule(
  id: string,
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/baker/schedule/${id}`);

  const { values, fieldErrors, parsed } = await readForm(formData);
  if (!parsed) return { values, fieldErrors };

  const { canBake } = await requireBakerProfile(userId);
  if (!canBake) {
    return {
      values,
      fieldErrors: {},
      generalError:
        "You need to claim baker capability before editing a schedule.",
    };
  }

  // Scope the update by both id AND bakerId so a user can't mutate someone
  // else's schedule by guessing the uuid. [LAW:single-enforcer]
  const result = await db
    .update(schedules)
    .set({
      kind: parsed.kind,
      name: parsed.name,
      blurb: parsed.blurb,
      photoUrl: parsed.photoUrl,
      priceCents: parsed.priceCents,
      defaultQty: parsed.defaultQty,
      daysOfWeek: parsed.daysOfWeek,
      timeOfDay: parsed.timeOfDay,
      firstReadyAt: parsed.firstReadyAt,
      tagSlugs: parsed.tagSlugs,
      updatedAt: new Date(),
    })
    .where(and(eq(schedules.id, id), eq(schedules.bakerId, userId)))
    .returning({ id: schedules.id });

  if (result.length === 0) {
    return {
      values,
      fieldErrors: {},
      generalError: "Schedule not found.",
    };
  }

  revalidatePath("/baker/schedule");
  revalidatePath(`/baker/schedule/${id}`);
  revalidatePath("/baker");
  redirect("/baker/schedule");
}

// Toggle active state. Takes the schedule id from the form's hidden input
// rather than via .bind(), which mirrors the runSeedPack pattern used in
// /dev-tools and avoids a flaky bind-vs-server-action interaction.
async function setActive(id: string, active: boolean): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/baker/schedule");

  await db
    .update(schedules)
    .set({ active, updatedAt: new Date() })
    .where(and(eq(schedules.id, id), eq(schedules.bakerId, userId)));

  revalidatePath("/baker/schedule");
  revalidatePath("/baker");
  redirect("/baker/schedule");
}

export async function deactivateSchedule(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/baker/schedule");
  await setActive(id, false);
}

export async function reactivateSchedule(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/baker/schedule");
  await setActive(id, true);
}

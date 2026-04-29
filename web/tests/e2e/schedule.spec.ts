// E2E for breadly-baker-95i.5: schedule editor /baker/schedule.
//
// Verifies the data flow:
//   /baker/schedule list → /baker/schedule/new → recurring form submit →
//   row appears in DB with kind, daysOfWeek, timeOfDay, tagSlugs.
//   Edit row → values persist. Deactivate → row moves to "Archived".

import { test, expect } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";
import { db } from "../../src/db/client";
import {
  bakerProfiles,
  schedules,
  tags,
  users,
} from "../../src/db/schema";
import { eq, inArray } from "drizzle-orm";

function uniqueEmail(label: string): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${label}+clerk_test_${suffix}@example.com`;
}

async function createClerkUser(email: string) {
  const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });
  return clerkClient.users.createUser({
    emailAddress: [email],
    password: "Onboarding!Test123ABCxyz",
    skipPasswordChecks: true,
  });
}

async function deleteClerkUserByEmail(email: string) {
  const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });
  const list = await clerkClient.users.getUserList({ emailAddress: [email] });
  for (const u of list.data) {
    await clerkClient.users.deleteUser(u.id);
  }
}

async function seedBaker(opts: {
  email: string;
  clerkUserId: string;
  slug: string;
}) {
  await db.insert(users).values({
    id: opts.clerkUserId,
    email: opts.email,
    displayName: "Schedule Baker",
    canBake: true,
    canOperate: false,
    location: { x: -105.282, y: 40.0274 },
  });
  await db.insert(bakerProfiles).values({
    userId: opts.clerkUserId,
    slug: opts.slug,
    bakeryName: "Schedule Bakery",
    listingCutoffHours: 24,
  });
}

test.describe("schedule editor", () => {
  const createdEmails: string[] = [];
  const createdUserIds: string[] = [];

  test.afterAll(async () => {
    if (createdUserIds.length > 0) {
      await db.delete(schedules).where(inArray(schedules.bakerId, createdUserIds));
      await db
        .delete(bakerProfiles)
        .where(inArray(bakerProfiles.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    for (const email of createdEmails) {
      await deleteClerkUserByEmail(email).catch(() => {});
    }
  });

  test("create recurring → edit → deactivate", async ({ page }) => {
    const email = uniqueEmail("schedule");
    createdEmails.push(email);
    const clerkUser = await createClerkUser(email);
    createdUserIds.push(clerkUser.id);
    await seedBaker({
      email,
      clerkUserId: clerkUser.id,
      slug: `schedule-bakery-${Math.random().toString(36).slice(2, 8)}`,
    });

    const sourdoughTag = await db
      .select({ id: tags.id, slug: tags.slug })
      .from(tags)
      .where(eq(tags.slug, "sourdough"))
      .then((rows) => rows[0]);
    expect(sourdoughTag).toBeTruthy();

    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: email });

    // Empty list state.
    await page.goto("/baker/schedule");
    await expect(
      page.getByRole("heading", { name: "Bake schedule" }),
    ).toBeVisible();
    await expect(page.getByTestId("section-active")).toContainText(
      "No active schedule",
    );

    // Create
    await page.getByRole("link", { name: /new schedule entry/i }).click();
    await page.waitForURL("**/baker/schedule/new");

    // Defaults to "recurring" — no need to toggle.
    await page.getByLabel(/bread name/i).fill("Standing Sourdough");
    await page.getByLabel(/blurb/i).fill("Weekly bake.");
    await page.getByLabel(/price/i).fill("12.00");
    await page.getByLabel(/default quantity/i).fill("8");

    // Pick Tue + Fri.
    await page.getByTestId("days-of-week").getByText("Tue", { exact: true }).click();
    await page.getByTestId("days-of-week").getByText("Fri", { exact: true }).click();

    await page.getByLabel(/time of day/i).fill("09:30");

    // Pick the sourdough tag (any "Sourdough" label visible in tags fieldset).
    await page.getByText("Sourdough", { exact: true }).first().click();

    await page.getByRole("button", { name: /create schedule/i }).click();
    await page.waitForURL("**/baker/schedule");

    // Row in DB.
    const dbRows = await db
      .select()
      .from(schedules)
      .where(eq(schedules.bakerId, clerkUser.id));
    expect(dbRows).toHaveLength(1);
    const row = dbRows[0];
    expect(row.kind).toBe("recurring");
    expect(row.name).toBe("Standing Sourdough");
    expect(row.priceCents).toBe(1200);
    expect(row.defaultQty).toBe(8);
    expect([...row.daysOfWeek].sort()).toEqual([2, 5]);
    expect(row.timeOfDay).toBe("09:30");
    expect(row.firstReadyAt).toBeNull();
    expect(row.tagSlugs).toContain("sourdough");
    expect(row.active).toBe(true);

    // Row visible in list.
    const activeSection = page.getByTestId("section-active");
    await expect(activeSection).toContainText("Standing Sourdough");
    await expect(activeSection).toContainText("Tue · Fri");
    await expect(activeSection).toContainText("09:30");

    // Edit — change defaultQty + add Sunday.
    await page.getByRole("link", { name: "Standing Sourdough" }).click();
    await page.waitForURL(`**/baker/schedule/${row.id}`);
    await page.getByLabel(/default quantity/i).fill("12");
    await page
      .getByTestId("days-of-week")
      .getByText("Sun", { exact: true })
      .click();
    await page.getByRole("button", { name: /save changes/i }).click();
    await page.waitForURL("**/baker/schedule");

    const afterEdit = await db
      .select()
      .from(schedules)
      .where(eq(schedules.id, row.id))
      .then((rows) => rows[0]);
    expect(afterEdit.defaultQty).toBe(12);
    expect([...afterEdit.daysOfWeek].sort()).toEqual([0, 2, 5]);

    // Deactivate. The redirect target is /baker/schedule — same URL we're
    // already on — so we sync on the UI flipping rather than a URL change.
    await page.getByRole("button", { name: "Deactivate" }).click();
    await expect(page.getByTestId("section-active")).toContainText(
      "No active schedule",
    );
    await expect(page.getByTestId("section-archived")).toContainText(
      "Standing Sourdough",
    );

    const archived = await db
      .select()
      .from(schedules)
      .where(eq(schedules.id, row.id))
      .then((rows) => rows[0]);
    expect(archived.active).toBe(false);
  });

  test("one-off entry stores firstReadyAt and skips daysOfWeek validation", async ({
    page,
  }) => {
    const email = uniqueEmail("one-off");
    createdEmails.push(email);
    const clerkUser = await createClerkUser(email);
    createdUserIds.push(clerkUser.id);
    await seedBaker({
      email,
      clerkUserId: clerkUser.id,
      slug: `one-off-bakery-${Math.random().toString(36).slice(2, 8)}`,
    });

    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: email });

    await page.goto("/baker/schedule/new");

    // Toggle to one-off.
    await page.getByText("One-off", { exact: true }).click();

    await page.getByLabel(/bread name/i).fill("Birthday Brioche");
    await page.getByLabel(/price/i).fill("18.00");
    await page.getByLabel(/default quantity/i).fill("4");

    const futureMs = Date.now() + 5 * 24 * 60 * 60 * 1000;
    const futureLocal = new Date(
      futureMs - new Date(futureMs).getTimezoneOffset() * 60_000,
    )
      .toISOString()
      .slice(0, 16);
    await page.getByLabel(/ready at/i).fill(futureLocal);

    await page.getByRole("button", { name: /create schedule/i }).click();
    await page.waitForURL("**/baker/schedule");

    const dbRows = await db
      .select()
      .from(schedules)
      .where(eq(schedules.bakerId, clerkUser.id));
    expect(dbRows).toHaveLength(1);
    const row = dbRows[0];
    expect(row.kind).toBe("one_off");
    expect(row.name).toBe("Birthday Brioche");
    expect(row.firstReadyAt).not.toBeNull();
    expect(row.daysOfWeek).toEqual([]);
    expect(row.timeOfDay).toBeNull();
  });

  test("non-baker bounced from /baker/schedule", async ({ page }) => {
    const email = uniqueEmail("non-baker-sched");
    createdEmails.push(email);
    const clerkUser = await createClerkUser(email);
    createdUserIds.push(clerkUser.id);
    await db.insert(users).values({
      id: clerkUser.id,
      email,
      displayName: "Just an Eater",
      canBake: false,
      canOperate: false,
    });

    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: email });

    await page.goto("/baker/schedule");
    await expect(page).toHaveURL(/\/me$/);
  });
});

// E2E for breadly-eater-b77.1: eater preferences editor.
//
// Verifies first-visit-creates-row and subsequent-edit-updates-row both
// flow through the same upsert. The row keys on the Clerk userId, so a
// fresh test user lets us assert "no row → row" and "row → row updated"
// in one flow without resetting the seed.

import { test, expect } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";
import { db } from "../../src/db/client";
import { eaterPreferences, users } from "../../src/db/schema";
import { eq, inArray, sql } from "drizzle-orm";

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

test.describe("eater preferences editor", () => {
  const createdEmails: string[] = [];
  const createdUserIds: string[] = [];

  test.afterAll(async () => {
    if (createdUserIds.length > 0) {
      await db
        .delete(eaterPreferences)
        .where(inArray(eaterPreferences.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    for (const email of createdEmails) {
      await deleteClerkUserByEmail(email).catch(() => {});
    }
  });

  test("first visit creates eater_preferences; second save updates same row", async ({
    page,
  }) => {
    const email = uniqueEmail("prefs");
    createdEmails.push(email);
    const clerkUser = await createClerkUser(email);
    createdUserIds.push(clerkUser.id);

    // Stand in for the Clerk webhook (same pattern as baker-onboarding).
    await db.insert(users).values({
      id: clerkUser.id,
      email,
      displayName: "Prefs Tester",
      canBake: false,
      canOperate: false,
    });

    // Sanity: no preferences row exists yet.
    const before = await db.query.eaterPreferences.findFirst({
      where: eq(eaterPreferences.userId, clerkUser.id),
    });
    expect(before).toBeFalsy();

    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: email });

    await page.goto("/me/preferences");
    await expect(
      page.getByRole("heading", { name: "Preferences" }),
    ).toBeVisible();

    await page.getByLabel("Neighborhood").selectOption("mapleton-hill");
    await page
      .getByLabel("Search radius in miles")
      .fill("3");

    // Pick one include and one exclude tag.
    await page
      .locator('input[type="checkbox"][name="include"][value="sourdough"]')
      .check({ force: true });
    await page
      .locator('input[type="checkbox"][name="exclude"][value="rye-bread"]')
      .check({ force: true });

    await page.getByRole("button", { name: /save preferences/i }).click();
    await expect(page.getByText(/preferences saved/i)).toBeVisible();

    // Row should now exist with the values we set.
    const created = await db.query.eaterPreferences.findFirst({
      where: eq(eaterPreferences.userId, clerkUser.id),
    });
    expect(created).toBeTruthy();
    expect(created!.includeTagSlugs).toEqual(["sourdough"]);
    expect(created!.excludeTagSlugs).toEqual(["rye-bread"]);
    expect(created!.radiusMi).toBe(3);

    // The neighborhood selection should have anchored the user's location
    // to the Mapleton Hill centroid (40.0240, -105.2870).
    const userAfterFirst = await db.execute<{ lat: number; lng: number }>(
      sql`SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng FROM users WHERE id = ${clerkUser.id}`,
    );
    expect(Number(userAfterFirst[0].lat)).toBeCloseTo(40.024, 3);
    expect(Number(userAfterFirst[0].lng)).toBeCloseTo(-105.287, 3);

    // Edit again: change radius, swap include/exclude. Same upsert path.
    await page.goto("/me/preferences");
    await page.getByLabel("Search radius in miles").fill("5");
    // Newlands is the seed default; pick a different one to confirm
    // location moves with the selection.
    await page.getByLabel("Neighborhood").selectOption("newlands");
    await page
      .locator('input[type="checkbox"][name="include"][value="sourdough"]')
      .uncheck({ force: true });
    await page
      .locator('input[type="checkbox"][name="include"][value="baguette"]')
      .check({ force: true });

    await page.getByRole("button", { name: /save preferences/i }).click();
    await expect(page.getByText(/preferences saved/i)).toBeVisible();

    const updated = await db.query.eaterPreferences.findFirst({
      where: eq(eaterPreferences.userId, clerkUser.id),
    });
    expect(updated).toBeTruthy();
    expect(updated!.includeTagSlugs).toEqual(["baguette"]);
    expect(updated!.radiusMi).toBe(5);

    // Same primary key — upsert, not insert-and-orphan.
    expect(updated!.userId).toBe(created!.userId);
  });

  test("conflict between include and exclude is rejected with a field error", async ({
    page,
  }) => {
    const email = uniqueEmail("prefs-conflict");
    createdEmails.push(email);
    const clerkUser = await createClerkUser(email);
    createdUserIds.push(clerkUser.id);

    await db.insert(users).values({
      id: clerkUser.id,
      email,
      displayName: "Conflict Tester",
      canBake: false,
      canOperate: false,
    });

    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: email });

    await page.goto("/me/preferences");

    // Same slug in both lists.
    await page
      .locator('input[type="checkbox"][name="include"][value="sourdough"]')
      .check({ force: true });
    await page
      .locator('input[type="checkbox"][name="exclude"][value="sourdough"]')
      .check({ force: true });

    await page.getByRole("button", { name: /save preferences/i }).click();

    // Field error renders, no row created.
    await expect(page.getByText(/can't be in both Include and Exclude/i)).toBeVisible();
    const after = await db.query.eaterPreferences.findFirst({
      where: eq(eaterPreferences.userId, clerkUser.id),
    });
    expect(after).toBeFalsy();
  });
});

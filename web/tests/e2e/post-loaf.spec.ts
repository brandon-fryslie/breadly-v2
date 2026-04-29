// E2E for breadly-baker-95i.2: post-a-loaf form.
//
// Verifies the data flow:
//   /baker/new → fill form → submit → redirect to /baker
//   listings row inserted with correct status, location snapshot, expiresAt
//   listing_tags rows inserted for selected tags

import { test, expect } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";
import { db } from "../../src/db/client";
import {
  bakerProfiles,
  listings,
  listingTags,
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
    displayName: "E2E Baker",
    canBake: true,
    canOperate: false,
    location: { x: -105.282, y: 40.0274 }, // Newlands, Boulder
  });
  await db.insert(bakerProfiles).values({
    userId: opts.clerkUserId,
    slug: opts.slug,
    bakeryName: "E2E Bakery",
    listingCutoffHours: 24,
  });
}

test.describe("post-a-loaf", () => {
  const createdEmails: string[] = [];
  const createdUserIds: string[] = [];

  test.afterAll(async () => {
    if (createdUserIds.length > 0) {
      // listings cascade-delete via baker_profiles → listings FK; delete
      // explicitly anyway to be safe across test orderings.
      await db.delete(listings).where(inArray(listings.bakerId, createdUserIds));
      await db
        .delete(bakerProfiles)
        .where(inArray(bakerProfiles.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    for (const email of createdEmails) {
      await deleteClerkUserByEmail(email).catch(() => {});
    }
  });

  test("happy path: future readyAt → status='scheduled', tags linked", async ({
    page,
  }) => {
    const email = uniqueEmail("happy-loaf");
    createdEmails.push(email);
    const clerkUser = await createClerkUser(email);
    createdUserIds.push(clerkUser.id);
    await seedBaker({
      email,
      clerkUserId: clerkUser.id,
      slug: `e2e-bakery-${Math.random().toString(36).slice(2, 8)}`,
    });

    const allTags = await db
      .select({ id: tags.id, slug: tags.slug })
      .from(tags);
    const sourdough = allTags.find((t) => t.slug === "sourdough");
    const longFerment = allTags.find((t) => t.slug === "long-ferment");
    expect(sourdough).toBeTruthy();
    expect(longFerment).toBeTruthy();

    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: email });

    await page.goto("/baker/new");
    await expect(page.getByRole("heading", { name: "What did you bake?" })).toBeVisible();

    // Choose a future time.
    const futureMs = Date.now() + 3 * 60 * 60 * 1000; // +3h
    const futureLocal = new Date(futureMs - new Date(futureMs).getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    await page.getByLabel(/bread name/i).fill("Country sourdough");
    await page.getByLabel(/blurb/i).fill("Just out — still warm.");
    await page.getByLabel(/photo url/i).fill("https://example.com/loaf.jpg");
    await page.getByLabel(/price/i).fill("9.50");
    await page.getByLabel(/quantity/i).fill("6");
    await page.getByLabel(/ready at/i).fill(futureLocal);

    await page.getByText("Sourdough", { exact: true }).click();
    await page.getByText("Long ferment", { exact: true }).click();

    await page.getByRole("button", { name: /post loaf/i }).click();
    await page.waitForURL("**/baker");

    const rows = await db
      .select()
      .from(listings)
      .where(eq(listings.bakerId, clerkUser.id));
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.name).toBe("Country sourdough");
    expect(row.blurb).toBe("Just out — still warm.");
    expect(row.photoUrl).toBe("https://example.com/loaf.jpg");
    expect(row.priceCents).toBe(950);
    expect(row.qtyTotal).toBe(6);
    expect(row.qtyAvailable).toBe(6);
    expect(row.status).toBe("scheduled");
    expect(row.outOfOvenAt).toBeNull();
    // expiresAt = readyAt + 24h
    expect(row.expiresAt!.getTime() - row.readyAt.getTime()).toBe(
      24 * 60 * 60 * 1000,
    );
    // location snapshot from baker
    expect(row.location).toEqual({ x: -105.282, y: 40.0274 });

    const linkedTagIds = await db
      .select({ tagId: listingTags.tagId })
      .from(listingTags)
      .where(eq(listingTags.listingId, row.id));
    const ids = linkedTagIds.map((r) => r.tagId).sort();
    expect(ids).toEqual([sourdough!.id, longFerment!.id].sort());
  });

  test("past readyAt → status='ready', outOfOvenAt set", async ({ page }) => {
    const email = uniqueEmail("past-loaf");
    createdEmails.push(email);
    const clerkUser = await createClerkUser(email);
    createdUserIds.push(clerkUser.id);
    await seedBaker({
      email,
      clerkUserId: clerkUser.id,
      slug: `e2e-bakery-${Math.random().toString(36).slice(2, 8)}`,
    });

    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: email });

    await page.goto("/baker/new");

    const pastMs = Date.now() - 30 * 60 * 1000; // -30 min
    const pastLocal = new Date(pastMs - new Date(pastMs).getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    await page.getByLabel(/bread name/i).fill("Just-out miche");
    await page.getByLabel(/price/i).fill("12");
    await page.getByLabel(/quantity/i).fill("2");
    await page.getByLabel(/ready at/i).fill(pastLocal);

    await page.getByRole("button", { name: /post loaf/i }).click();
    await page.waitForURL("**/baker");

    const row = await db.query.listings.findFirst({
      where: eq(listings.bakerId, clerkUser.id),
    });
    expect(row).toBeTruthy();
    expect(row!.status).toBe("ready");
    expect(row!.outOfOvenAt).not.toBeNull();
    expect(row!.outOfOvenAt!.getTime()).toBe(row!.readyAt.getTime());
  });

  test("non-baker is bounced from /baker/new", async ({ page }) => {
    const email = uniqueEmail("non-baker");
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

    await page.goto("/baker/new");
    // Page redirects to /me when canBake is false.
    await expect(page).toHaveURL(/\/me$/);
  });
});

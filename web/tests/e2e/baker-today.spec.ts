// E2E for breadly-baker-95i.3: baker today screen.
//
// Verifies the data flow:
//   /baker → renders all four sections from a single getBakerToday() call
//   listings bucketed correctly by status + readyAt window
//   active claims render under "Claimed seats" with the pickup code visible
//
// Each test seeds its own baker (with profile + listings + an eater + a
// claim) so runs are independent. Cleanup removes everything in afterAll.

import { test, expect } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";
import { db } from "../../src/db/client";
import {
  bakerProfiles,
  claims,
  listings,
  users,
} from "../../src/db/schema";
import { inArray } from "drizzle-orm";

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
  bakeryName: string;
}) {
  await db.insert(users).values({
    id: opts.clerkUserId,
    email: opts.email,
    displayName: "Today Baker",
    canBake: true,
    canOperate: false,
    location: { x: -105.282, y: 40.0274 },
  });
  await db.insert(bakerProfiles).values({
    userId: opts.clerkUserId,
    slug: opts.slug,
    bakeryName: opts.bakeryName,
    neighborhood: "Newlands",
    bio: "Test bakery",
    pickupWindowText: "9–11am Saturdays",
    listingCutoffHours: 24,
  });
}

type SeedListing = {
  name: string;
  status: "ready" | "scheduled" | "picked_up";
  readyMinutesFromNow: number;
  qtyTotal: number;
  qtyAvailable: number;
};

async function seedListings(bakerId: string, rows: SeedListing[]) {
  const now = Date.now();
  return db
    .insert(listings)
    .values(
      rows.map((r) => {
        const readyAt = new Date(now + r.readyMinutesFromNow * 60_000);
        return {
          bakerId,
          name: r.name,
          blurb: null,
          photoUrl: null,
          priceCents: 1200,
          qtyTotal: r.qtyTotal,
          qtyAvailable: r.qtyAvailable,
          status: r.status,
          readyAt,
          outOfOvenAt:
            r.status === "ready" || r.status === "picked_up" ? readyAt : null,
          expiresAt: new Date(readyAt.getTime() + 24 * 60 * 60_000),
          location: { x: -105.282, y: 40.0274 },
        };
      }),
    )
    .returning({ id: listings.id, name: listings.name });
}

test.describe("baker today screen", () => {
  const createdEmails: string[] = [];
  const createdUserIds: string[] = [];

  test.afterAll(async () => {
    if (createdUserIds.length > 0) {
      await db.delete(claims).where(inArray(claims.eaterId, createdUserIds));
      // Listings cascade with bakerProfiles, but be explicit so the test is
      // robust to FK changes.
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

  test("renders every section with seeded data in the right buckets", async ({
    page,
  }) => {
    const email = uniqueEmail("today-baker");
    createdEmails.push(email);
    const clerkUser = await createClerkUser(email);
    createdUserIds.push(clerkUser.id);

    const slug = `today-bakery-${Math.random().toString(36).slice(2, 8)}`;
    await seedBaker({
      email,
      clerkUserId: clerkUser.id,
      slug,
      bakeryName: "Today Bakery",
    });

    // Eater for the claim row.
    const eaterEmail = uniqueEmail("today-eater");
    createdEmails.push(eaterEmail);
    const eaterClerk = await createClerkUser(eaterEmail);
    createdUserIds.push(eaterClerk.id);
    await db.insert(users).values({
      id: eaterClerk.id,
      email: eaterEmail,
      displayName: "Hungry Eater",
      canBake: false,
      canOperate: false,
    });

    const seeded = await seedListings(clerkUser.id, [
      // in_oven
      { name: "Oven Miche", status: "ready", readyMinutesFromNow: -30, qtyTotal: 4, qtyAvailable: 3 },
      // coming_up (within 12h)
      { name: "Imminent Sourdough", status: "scheduled", readyMinutesFromNow: 90, qtyTotal: 6, qtyAvailable: 6 },
      // NOT coming_up: scheduled too far out
      { name: "Tomorrow's Rye", status: "scheduled", readyMinutesFromNow: 60 * 24, qtyTotal: 4, qtyAvailable: 4 },
      // recently_picked
      { name: "Picked-up Country", status: "picked_up", readyMinutesFromNow: -60 * 3, qtyTotal: 2, qtyAvailable: 0 },
    ]);

    // A claim against the in-oven listing → "Claimed seats".
    const ovenListingId = seeded.find((l) => l.name === "Oven Miche")!.id;
    await db.insert(claims).values({
      listingId: ovenListingId,
      eaterId: eaterClerk.id,
      qty: 1,
      status: "active",
      pickupCode: "4271",
    });

    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: email });

    await page.goto("/baker");

    await expect(
      page.getByRole("heading", { name: "Today Bakery" }),
    ).toBeVisible();
    await expect(page.getByTestId("storefront-link")).toHaveText(`/b/${slug}`);

    // Counter strip reflects the four sections.
    await expect(page.getByTestId("stat-in-oven")).toContainText("1");
    await expect(page.getByTestId("stat-coming-up")).toContainText("1");
    await expect(page.getByTestId("stat-claimed")).toContainText("1");
    await expect(page.getByTestId("stat-picked-up")).toContainText("1");

    // In the oven now: shows the ready listing, not the scheduled one.
    const inOven = page.getByTestId("section-in-the-oven-now");
    await expect(inOven).toContainText("Oven Miche");
    await expect(inOven).not.toContainText("Imminent Sourdough");

    // Coming up today: imminent only, not tomorrow's.
    const comingUp = page.getByTestId("section-coming-up-today");
    await expect(comingUp).toContainText("Imminent Sourdough");
    await expect(comingUp).not.toContainText("Tomorrow's Rye");
    await expect(comingUp).not.toContainText("Oven Miche");

    // Claimed seats: code + eater name visible.
    const claimed = page.getByTestId("section-claimed-seats");
    await expect(claimed).toContainText("4271");
    await expect(claimed).toContainText("Hungry Eater");
    await expect(claimed).toContainText("Oven Miche");

    // Recently picked up.
    const pickedUp = page.getByTestId("section-recently-picked-up");
    await expect(pickedUp).toContainText("Picked-up Country");
  });

  test("non-baker is bounced from /baker", async ({ page }) => {
    const email = uniqueEmail("eater-only");
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

    await page.goto("/baker");
    await expect(page).toHaveURL(/\/me$/);
  });

  test("brand-new baker with no listings: every section shows its empty state", async ({
    page,
  }) => {
    const email = uniqueEmail("empty-baker");
    createdEmails.push(email);
    const clerkUser = await createClerkUser(email);
    createdUserIds.push(clerkUser.id);

    await seedBaker({
      email,
      clerkUserId: clerkUser.id,
      slug: `empty-bakery-${Math.random().toString(36).slice(2, 8)}`,
      bakeryName: "Empty Bakery",
    });

    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: email });

    await page.goto("/baker");

    await expect(
      page.getByRole("heading", { name: "Empty Bakery" }),
    ).toBeVisible();

    for (const id of [
      "stat-in-oven",
      "stat-coming-up",
      "stat-claimed",
      "stat-picked-up",
    ]) {
      await expect(page.getByTestId(id)).toContainText("0");
    }

    await expect(
      page.getByTestId("section-in-the-oven-now"),
    ).toContainText("Nothing ready right this minute.");
    await expect(
      page.getByTestId("section-coming-up-today"),
    ).toContainText("No bakes scheduled for the next 12 hours.");
    await expect(page.getByTestId("section-claimed-seats")).toContainText(
      "Nothing claimed yet.",
    );
    await expect(
      page.getByTestId("section-recently-picked-up"),
    ).toContainText("No handoffs in the last 24 hours.");
  });
});

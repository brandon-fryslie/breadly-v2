// E2E for breadly-baker-95i.6: listing detail page baker actions.
//
// Verifies the data flow:
//   GET /listings/<id>   → renders facts; owner sees toolbar, eater sees CTA
//   POST mark out of oven → status flips to 'ready', outOfOvenAt set
//   POST mark sold out    → status='expired', qtyAvailable=0
//   POST pull listing     → status='cancelled'
//
// Each test owns its own baker / listing so runs are independent.

import { test, expect } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";
import { db } from "../../src/db/client";
import { bakerProfiles, listings, users } from "../../src/db/schema";
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
    displayName: "Detail Baker",
    canBake: true,
    canOperate: false,
    addressLine: "100 Pearl St",
    city: "Boulder",
    region: "CO",
    postalCode: "80302",
    location: { x: -105.282, y: 40.0274 },
  });
  await db.insert(bakerProfiles).values({
    userId: opts.clerkUserId,
    slug: opts.slug,
    bakeryName: "Detail Bakery",
    neighborhood: "Newlands",
    pickupWindowText: "9–11am Saturdays",
    listingCutoffHours: 24,
  });
}

async function seedListing(opts: {
  bakerId: string;
  name: string;
  status: "ready" | "scheduled";
  readyMinutesFromNow: number;
}) {
  const readyAt = new Date(Date.now() + opts.readyMinutesFromNow * 60_000);
  const [row] = await db
    .insert(listings)
    .values({
      bakerId: opts.bakerId,
      name: opts.name,
      blurb: "Test loaf",
      photoUrl: null,
      priceCents: 1200,
      qtyTotal: 6,
      qtyAvailable: 6,
      status: opts.status,
      readyAt,
      outOfOvenAt: opts.status === "ready" ? readyAt : null,
      expiresAt: new Date(readyAt.getTime() + 24 * 60 * 60_000),
      location: { x: -105.282, y: 40.0274 },
    })
    .returning({ id: listings.id });
  return row.id;
}

test.describe("listing detail", () => {
  const createdEmails: string[] = [];
  const createdUserIds: string[] = [];

  test.afterAll(async () => {
    if (createdUserIds.length > 0) {
      await db
        .delete(listings)
        .where(inArray(listings.bakerId, createdUserIds));
      await db
        .delete(bakerProfiles)
        .where(inArray(bakerProfiles.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    for (const email of createdEmails) {
      await deleteClerkUserByEmail(email).catch(() => {});
    }
  });

  test("anonymous viewer sees facts + sign-in CTA, no toolbar", async ({
    page,
  }) => {
    const email = uniqueEmail("anon-detail");
    createdEmails.push(email);
    const baker = await createClerkUser(email);
    createdUserIds.push(baker.id);
    await seedBaker({
      email,
      clerkUserId: baker.id,
      slug: `anon-detail-${Math.random().toString(36).slice(2, 8)}`,
    });
    const listingId = await seedListing({
      bakerId: baker.id,
      name: "Anon Country Sourdough",
      status: "ready",
      readyMinutesFromNow: -10,
    });

    await page.goto(`/listings/${listingId}`);

    await expect(
      page.getByRole("heading", { name: "Anon Country Sourdough" }),
    ).toBeVisible();
    await expect(page.getByTestId("listing-status")).toContainText(/oven/i);
    await expect(page.getByTestId("listing-facts")).toContainText("$12.00");
    await expect(page.getByTestId("owner-toolbar")).toHaveCount(0);
    await expect(page.getByTestId("eater-cta")).toBeVisible();
    await expect(page.getByTestId("listing-address-fuzzed")).toBeVisible();
    await expect(page.getByTestId("listing-address-exact")).toHaveCount(0);
    await expect(page.getByTestId("claim-cta")).toContainText(/sign in/i);
  });

  test("owner sees toolbar; mark out of oven flips status='ready'", async ({
    page,
  }) => {
    const email = uniqueEmail("owner-mark-ready");
    createdEmails.push(email);
    const baker = await createClerkUser(email);
    createdUserIds.push(baker.id);
    await seedBaker({
      email,
      clerkUserId: baker.id,
      slug: `owner-ready-${Math.random().toString(36).slice(2, 8)}`,
    });
    const listingId = await seedListing({
      bakerId: baker.id,
      name: "Future Miche",
      status: "scheduled",
      readyMinutesFromNow: 120,
    });

    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: email });

    await page.goto(`/listings/${listingId}`);

    await expect(page.getByTestId("owner-toolbar")).toBeVisible();
    await expect(page.getByTestId("listing-address-exact")).toBeVisible();

    const before = await db.query.listings.findFirst({
      where: eq(listings.id, listingId),
    });
    expect(before!.status).toBe("scheduled");
    expect(before!.outOfOvenAt).toBeNull();

    await page.getByTestId("action-out-of-oven").click();
    await expect(page.getByTestId("listing-status")).toContainText(/oven/i);

    const after = await db.query.listings.findFirst({
      where: eq(listings.id, listingId),
    });
    expect(after!.status).toBe("ready");
    expect(after!.outOfOvenAt).not.toBeNull();
  });

  test("owner: mark sold out sets status='expired' and qtyAvailable=0", async ({
    page,
  }) => {
    const email = uniqueEmail("owner-sold-out");
    createdEmails.push(email);
    const baker = await createClerkUser(email);
    createdUserIds.push(baker.id);
    await seedBaker({
      email,
      clerkUserId: baker.id,
      slug: `owner-soldout-${Math.random().toString(36).slice(2, 8)}`,
    });
    const listingId = await seedListing({
      bakerId: baker.id,
      name: "Last Loaf",
      status: "ready",
      readyMinutesFromNow: -30,
    });

    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: email });

    await page.goto(`/listings/${listingId}`);

    await page.getByTestId("action-sold-out").click();
    await expect(page.getByTestId("listing-status")).toContainText(/sold out/i);

    const after = await db.query.listings.findFirst({
      where: eq(listings.id, listingId),
    });
    expect(after!.status).toBe("expired");
    expect(after!.qtyAvailable).toBe(0);
  });

  test("owner: pull listing sets status='cancelled'", async ({ page }) => {
    const email = uniqueEmail("owner-pull");
    createdEmails.push(email);
    const baker = await createClerkUser(email);
    createdUserIds.push(baker.id);
    await seedBaker({
      email,
      clerkUserId: baker.id,
      slug: `owner-pull-${Math.random().toString(36).slice(2, 8)}`,
    });
    const listingId = await seedListing({
      bakerId: baker.id,
      name: "Pulled Pita",
      status: "scheduled",
      readyMinutesFromNow: 60,
    });

    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: email });

    await page.goto(`/listings/${listingId}`);

    await page.getByTestId("action-pull").click();
    await expect(page.getByTestId("listing-status")).toContainText(/pulled/i);

    const after = await db.query.listings.findFirst({
      where: eq(listings.id, listingId),
    });
    expect(after!.status).toBe("cancelled");
  });

  test("non-owner eater sees CTA, not the toolbar", async ({ page }) => {
    const bakerEmail = uniqueEmail("non-owner-baker");
    const eaterEmail = uniqueEmail("non-owner-eater");
    createdEmails.push(bakerEmail, eaterEmail);
    const baker = await createClerkUser(bakerEmail);
    const eater = await createClerkUser(eaterEmail);
    createdUserIds.push(baker.id, eater.id);

    await seedBaker({
      email: bakerEmail,
      clerkUserId: baker.id,
      slug: `non-owner-${Math.random().toString(36).slice(2, 8)}`,
    });
    await db.insert(users).values({
      id: eater.id,
      email: eaterEmail,
      displayName: "Hungry Person",
      canBake: false,
      canOperate: false,
    });

    const listingId = await seedListing({
      bakerId: baker.id,
      name: "Eater-View Loaf",
      status: "ready",
      readyMinutesFromNow: -5,
    });

    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: eaterEmail });

    await page.goto(`/listings/${listingId}`);

    await expect(page.getByTestId("eater-cta")).toBeVisible();
    await expect(page.getByTestId("owner-toolbar")).toHaveCount(0);
    await expect(page.getByTestId("listing-address-fuzzed")).toBeVisible();
    await expect(page.getByTestId("listing-address-exact")).toHaveCount(0);
  });

  test("404 for unknown id", async ({ page }) => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const response = await page.goto(`/listings/${fakeId}`);
    expect(response?.status()).toBe(404);
  });
});

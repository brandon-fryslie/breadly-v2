// E2E for breadly-eater-b77.3: pickup-code handoff UX.
//
// Verifies the data flow:
//   eater claims → pickup code visible on /listings/<id>
//   baker on /baker enters that code → both screens flip to picked_up
//   listing status consolidates to picked_up when last seat is filled
//   self-mark fallbacks (eater + baker) bypass the code path but reach
//   the same final state

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
import { and, eq, inArray } from "drizzle-orm";

function uniqueEmail(label: string): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${label}+clerk_test_${suffix}@example.com`;
}

async function createClerkUser(email: string) {
  const c = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });
  return c.users.createUser({
    emailAddress: [email],
    password: "Onboarding!Test123ABCxyz",
    skipPasswordChecks: true,
  });
}

async function deleteClerkUserByEmail(email: string) {
  const c = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });
  const list = await c.users.getUserList({ emailAddress: [email] });
  for (const u of list.data) {
    await c.users.deleteUser(u.id);
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
    displayName: "Handoff Baker",
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
    bakeryName: "Handoff Bakery",
    neighborhood: "Newlands",
    pickupWindowText: "9–11am Saturdays",
    listingCutoffHours: 24,
  });
}

async function seedEater(opts: { email: string; clerkUserId: string }) {
  await db.insert(users).values({
    id: opts.clerkUserId,
    email: opts.email,
    displayName: "Hungry Person",
    canBake: false,
    canOperate: false,
  });
}

async function seedReadyListing(bakerId: string, name: string, qty: number) {
  const readyAt = new Date(Date.now() - 5 * 60_000);
  const [row] = await db
    .insert(listings)
    .values({
      bakerId,
      name,
      priceCents: 1500,
      qtyTotal: qty,
      qtyAvailable: qty,
      status: "ready",
      readyAt,
      outOfOvenAt: readyAt,
      location: { x: -105.282, y: 40.0274 },
    })
    .returning({ id: listings.id });
  return row.id;
}

test.describe("pickup-code handoff", () => {
  const createdEmails: string[] = [];
  const createdUserIds: string[] = [];

  test.afterAll(async () => {
    if (createdUserIds.length > 0) {
      await db
        .delete(claims)
        .where(inArray(claims.eaterId, createdUserIds));
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

  test("happy path: eater claims, baker enters code, both screens flip to picked up", async ({
    page,
  }) => {
    const bakerEmail = uniqueEmail("handoff-baker");
    const eaterEmail = uniqueEmail("handoff-eater");
    createdEmails.push(bakerEmail, eaterEmail);
    const baker = await createClerkUser(bakerEmail);
    const eater = await createClerkUser(eaterEmail);
    createdUserIds.push(baker.id, eater.id);

    await seedBaker({
      email: bakerEmail,
      clerkUserId: baker.id,
      slug: `handoff-${Math.random().toString(36).slice(2, 8)}`,
    });
    await seedEater({ email: eaterEmail, clerkUserId: eater.id });

    // Single seat so the listing flips to picked_up after the handoff.
    const listingId = await seedReadyListing(baker.id, "Handoff Loaf", 1);

    // Eater claims and grabs their pickup code.
    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: eaterEmail });
    await page.goto(`/listings/${listingId}`);
    await page.getByTestId("claim-cta").click();
    await expect(page.getByTestId("claim-pickup-code")).toBeVisible();
    const code = (await page
      .getByTestId("claim-pickup-code")
      .textContent())!.trim();
    expect(code).toMatch(/^\d{4}$/);
    await clerk.signOut({ page });

    // Baker enters the code on /baker.
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: bakerEmail });
    await page.goto("/baker");
    const seatRow = page.getByTestId("claimed-seat-row");
    await expect(seatRow).toBeVisible();
    await seatRow.getByTestId("handoff-code-input").fill(code);
    await seatRow.getByTestId("handoff-confirm").click();

    // After revalidation: row leaves the claimed-seats section, listing
    // flips to picked_up.
    await expect(page.getByTestId("claimed-seat-row")).toHaveCount(0);

    const claim = await db.query.claims.findFirst({
      where: and(
        eq(claims.listingId, listingId),
        eq(claims.eaterId, eater.id),
      ),
    });
    expect(claim!.status).toBe("picked_up");
    expect(claim!.pickedUpAt).not.toBeNull();

    const after = await db.query.listings.findFirst({
      where: eq(listings.id, listingId),
    });
    expect(after!.status).toBe("picked_up");
    await clerk.signOut({ page });

    // Eater's view also reads "picked up" (revalidated cache).
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: eaterEmail });
    await page.goto(`/listings/${listingId}`);
    await expect(page.getByTestId("claim-state")).toContainText(/picked up/i);
    await expect(page.getByTestId("listing-status")).toContainText(/picked/i);
    // Pickup code is still rendered (receipt) but actions are gone.
    await expect(page.getByTestId("claim-cancel")).toHaveCount(0);
    await expect(page.getByTestId("claim-self-pickup")).toHaveCount(0);
  });

  test("happy path with extra inventory: claim flips, listing stays 'ready'", async ({
    page,
  }) => {
    const bakerEmail = uniqueEmail("handoff-multi-baker");
    const eaterEmail = uniqueEmail("handoff-multi-eater");
    createdEmails.push(bakerEmail, eaterEmail);
    const baker = await createClerkUser(bakerEmail);
    const eater = await createClerkUser(eaterEmail);
    createdUserIds.push(baker.id, eater.id);

    await seedBaker({
      email: bakerEmail,
      clerkUserId: baker.id,
      slug: `handoff-multi-${Math.random().toString(36).slice(2, 8)}`,
    });
    await seedEater({ email: eaterEmail, clerkUserId: eater.id });

    const listingId = await seedReadyListing(baker.id, "Plenty", 6);

    // Eater claims (qty drops 6 → 5; listing stays 'ready').
    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: eaterEmail });
    await page.goto(`/listings/${listingId}`);
    await page.getByTestId("claim-cta").click();
    const code = (await page
      .getByTestId("claim-pickup-code")
      .textContent())!.trim();
    await clerk.signOut({ page });

    // Baker confirms.
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: bakerEmail });
    await page.goto("/baker");
    const seat = page.getByTestId("claimed-seat-row");
    await seat.getByTestId("handoff-code-input").fill(code);
    await seat.getByTestId("handoff-confirm").click();
    await expect(page.getByTestId("claimed-seat-row")).toHaveCount(0);

    // Listing should NOT be flipped to picked_up — there's still inventory.
    const after = await db.query.listings.findFirst({
      where: eq(listings.id, listingId),
    });
    expect(after!.status).toBe("ready");
    expect(after!.qtyAvailable).toBe(5);
  });

  test("eater self-mark fallback flips claim to picked_up", async ({
    page,
  }) => {
    const bakerEmail = uniqueEmail("self-eater-baker");
    const eaterEmail = uniqueEmail("self-eater-eater");
    createdEmails.push(bakerEmail, eaterEmail);
    const baker = await createClerkUser(bakerEmail);
    const eater = await createClerkUser(eaterEmail);
    createdUserIds.push(baker.id, eater.id);

    await seedBaker({
      email: bakerEmail,
      clerkUserId: baker.id,
      slug: `self-eater-${Math.random().toString(36).slice(2, 8)}`,
    });
    await seedEater({ email: eaterEmail, clerkUserId: eater.id });

    const listingId = await seedReadyListing(baker.id, "Self-Mark Loaf", 1);

    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: eaterEmail });
    await page.goto(`/listings/${listingId}`);
    await page.getByTestId("claim-cta").click();
    await page.getByTestId("claim-self-pickup").click();

    await expect(page.getByTestId("claim-state")).toContainText(/picked up/i);

    const claim = await db.query.claims.findFirst({
      where: and(
        eq(claims.listingId, listingId),
        eq(claims.eaterId, eater.id),
      ),
    });
    expect(claim!.status).toBe("picked_up");

    const after = await db.query.listings.findFirst({
      where: eq(listings.id, listingId),
    });
    expect(after!.status).toBe("picked_up");
  });

  test("baker self-mark fallback flips claim to picked_up", async ({
    page,
  }) => {
    const bakerEmail = uniqueEmail("self-baker-baker");
    const eaterEmail = uniqueEmail("self-baker-eater");
    createdEmails.push(bakerEmail, eaterEmail);
    const baker = await createClerkUser(bakerEmail);
    const eater = await createClerkUser(eaterEmail);
    createdUserIds.push(baker.id, eater.id);

    await seedBaker({
      email: bakerEmail,
      clerkUserId: baker.id,
      slug: `self-baker-${Math.random().toString(36).slice(2, 8)}`,
    });
    await seedEater({ email: eaterEmail, clerkUserId: eater.id });

    const listingId = await seedReadyListing(baker.id, "Self-Baker Loaf", 1);

    // Eater claims first (so there's a row for the baker to mark).
    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: eaterEmail });
    await page.goto(`/listings/${listingId}`);
    await page.getByTestId("claim-cta").click();
    await expect(page.getByTestId("claim-pickup-code")).toBeVisible();
    await clerk.signOut({ page });

    // Baker self-marks via the fallback button.
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: bakerEmail });
    await page.goto("/baker");
    await page.getByTestId("handoff-self-pickup").click();
    await expect(page.getByTestId("claimed-seat-row")).toHaveCount(0);

    const claim = await db.query.claims.findFirst({
      where: and(
        eq(claims.listingId, listingId),
        eq(claims.eaterId, eater.id),
      ),
    });
    expect(claim!.status).toBe("picked_up");

    const after = await db.query.listings.findFirst({
      where: eq(listings.id, listingId),
    });
    expect(after!.status).toBe("picked_up");
  });
});

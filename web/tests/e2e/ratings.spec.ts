// E2E for breadly-baker-95i.7: ratings — baker side post-handoff.
//
// Two flows under test:
//   1) Baker→eater rating UI: handoff completes → /baker shows a
//      rate-this-handoff prompt → submit flips the row to a receipt and
//      writes the ratings row (rater=baker, rated=eater).
//   2) Storefront aggregate read path: when ratings exist where the
//      baker is rated_id (ED2-7 eater-side will produce these, seeded
//      directly here), /b/<slug> shows the average + count.
//
// Plus: re-submission for the same (rater, claim) is a no-op because
// of the UNIQUE constraint.

import { test, expect } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";
import { db } from "../../src/db/client";
import {
  bakerProfiles,
  claims,
  listings,
  ratings,
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
    displayName: "Rating Baker",
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
    bakeryName: "Rating Bakery",
    neighborhood: "Newlands",
    pickupWindowText: "9–11am Saturdays",
    listingCutoffHours: 24,
  });
}

async function seedEater(opts: { email: string; clerkUserId: string }) {
  await db.insert(users).values({
    id: opts.clerkUserId,
    email: opts.email,
    displayName: "Rating Eater",
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

test.describe("baker post-handoff ratings", () => {
  const createdEmails: string[] = [];
  const createdUserIds: string[] = [];

  test.afterAll(async () => {
    if (createdUserIds.length > 0) {
      await db
        .delete(ratings)
        .where(inArray(ratings.raterId, createdUserIds));
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

  test("baker rates a completed handoff and the storefront aggregate updates", async ({
    page,
  }) => {
    const bakerEmail = uniqueEmail("rating-baker");
    const eaterEmail = uniqueEmail("rating-eater");
    createdEmails.push(bakerEmail, eaterEmail);
    const baker = await createClerkUser(bakerEmail);
    const eater = await createClerkUser(eaterEmail);
    createdUserIds.push(baker.id, eater.id);

    const slug = `rating-${Math.random().toString(36).slice(2, 8)}`;
    await seedBaker({ email: bakerEmail, clerkUserId: baker.id, slug });
    await seedEater({ email: eaterEmail, clerkUserId: eater.id });

    // Eater claims a single-seat ready listing.
    const listingId = await seedReadyListing(baker.id, "Rate Me Loaf", 1);
    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: eaterEmail });
    await page.goto(`/listings/${listingId}`);
    await page.getByTestId("claim-cta").click();
    const code = (await page
      .getByTestId("claim-pickup-code")
      .textContent())!.trim();
    await clerk.signOut({ page });

    // Baker confirms pickup with the code.
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: bakerEmail });
    await page.goto("/baker");
    const seat = page.getByTestId("claimed-seat-row");
    await seat.getByTestId("handoff-code-input").fill(code);
    await seat.getByTestId("handoff-confirm").click();

    // After revalidation: handoff row shows the rate prompt.
    const handoffRow = page.getByTestId("handoff-row");
    await expect(handoffRow).toBeVisible();
    await expect(handoffRow).toContainText("Rate Me Loaf");
    await expect(handoffRow).toContainText("Rating Eater");
    const rateForm = handoffRow.getByTestId("rate-handoff-form");
    await expect(rateForm).toBeVisible();

    await rateForm
      .getByTestId("rate-handoff-comment")
      .fill("On time, friendly.");
    await rateForm.getByTestId("rate-handoff-up").click();

    // Row is now in receipt mode — form gone, receipt visible.
    await expect(handoffRow.getByTestId("rate-handoff-form")).toHaveCount(0);
    await expect(
      handoffRow.getByTestId("rate-handoff-receipt"),
    ).toContainText("On time, friendly.");

    // /baker hero rating: this rating is rater=baker, rated=eater, so
    // the *baker's* aggregate (rated_id = baker) is unchanged. ED2-7
    // eater-side ratings will be what fills the baker's hero.
    await expect(page.getByTestId("baker-rating")).toContainText(
      /no ratings yet/i,
    );

    // DB state — exactly one rating row for this rater/claim, in the
    // baker→eater direction.
    const claim = await db.query.claims.findFirst({
      where: and(
        eq(claims.listingId, listingId),
        eq(claims.eaterId, eater.id),
      ),
    });
    const ratingRows = await db.query.ratings.findMany({
      where: eq(ratings.claimId, claim!.id),
    });
    expect(ratingRows).toHaveLength(1);
    expect(ratingRows[0].raterId).toBe(baker.id);
    expect(ratingRows[0].ratedId).toBe(eater.id);
    expect(ratingRows[0].score).toBe(5);
    expect(ratingRows[0].comment).toBe("On time, friendly.");
  });

  test("storefront aggregates ratings where the baker is rated_id", async ({
    page,
  }) => {
    const bakerEmail = uniqueEmail("agg-baker");
    const eaterAEmail = uniqueEmail("agg-eaterA");
    const eaterBEmail = uniqueEmail("agg-eaterB");
    createdEmails.push(bakerEmail, eaterAEmail, eaterBEmail);
    const baker = await createClerkUser(bakerEmail);
    const eaterA = await createClerkUser(eaterAEmail);
    const eaterB = await createClerkUser(eaterBEmail);
    createdUserIds.push(baker.id, eaterA.id, eaterB.id);

    const slug = `agg-${Math.random().toString(36).slice(2, 8)}`;
    await seedBaker({ email: bakerEmail, clerkUserId: baker.id, slug });
    await db.insert(users).values([
      {
        id: eaterA.id,
        email: eaterAEmail,
        displayName: "Eater A",
        canBake: false,
        canOperate: false,
      },
      {
        id: eaterB.id,
        email: eaterBEmail,
        displayName: "Eater B",
        canBake: false,
        canOperate: false,
      },
    ]);

    // Storefront with zero ratings → "No ratings yet".
    await page.goto(`/b/${slug}`);
    await expect(page.getByTestId("storefront-rating")).toContainText(
      /no ratings yet/i,
    );

    // Two picked-up claims and matching eater→baker ratings (one 5, one 1).
    const listingId = await seedReadyListing(baker.id, "Agg Loaf", 2);
    const claimRows = await db
      .insert(claims)
      .values([
        {
          listingId,
          eaterId: eaterA.id,
          qty: 1,
          status: "picked_up",
          pickupCode: "1111",
          pickedUpAt: new Date(Date.now() - 60_000),
        },
        {
          listingId,
          eaterId: eaterB.id,
          qty: 1,
          status: "picked_up",
          pickupCode: "2222",
          pickedUpAt: new Date(Date.now() - 60_000),
        },
      ])
      .returning({ id: claims.id, eaterId: claims.eaterId });
    await db.insert(ratings).values([
      {
        claimId: claimRows[0].id,
        raterId: claimRows[0].eaterId,
        ratedId: baker.id,
        score: 5,
      },
      {
        claimId: claimRows[1].id,
        raterId: claimRows[1].eaterId,
        ratedId: baker.id,
        score: 1,
      },
    ]);

    // Storefront now shows the average (3.0) and count (2).
    await page.goto(`/b/${slug}`);
    await expect(page.getByTestId("storefront-rating")).toContainText("3.0");
    await expect(page.getByTestId("storefront-rating")).toContainText("(2)");
  });

  test("re-submitting a rating for the same claim is a no-op", async ({
    page,
  }) => {
    const bakerEmail = uniqueEmail("idem-baker");
    const eaterEmail = uniqueEmail("idem-eater");
    createdEmails.push(bakerEmail, eaterEmail);
    const baker = await createClerkUser(bakerEmail);
    const eater = await createClerkUser(eaterEmail);
    createdUserIds.push(baker.id, eater.id);

    const slug = `idem-${Math.random().toString(36).slice(2, 8)}`;
    await seedBaker({ email: bakerEmail, clerkUserId: baker.id, slug });
    await seedEater({ email: eaterEmail, clerkUserId: eater.id });

    const listingId = await seedReadyListing(baker.id, "Idem Loaf", 1);

    // Pre-seed a picked-up claim straight to DB — skips the UI handoff so
    // we focus on the rating-action idempotency.
    const [claimRow] = await db
      .insert(claims)
      .values({
        listingId,
        eaterId: eater.id,
        qty: 1,
        status: "picked_up",
        pickupCode: "0000",
        pickedUpAt: new Date(Date.now() - 10 * 60_000),
      })
      .returning({ id: claims.id });

    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: bakerEmail });
    await page.goto("/baker");

    const handoffRow = page.getByTestId("handoff-row");
    await handoffRow.getByTestId("rate-handoff-up").click();

    await expect(handoffRow.getByTestId("rate-handoff-receipt")).toBeVisible();

    // Force a second submit by hitting the action again with the same
    // claim id — emulates a double click / replay. The DB UNIQUE
    // constraint means we still have exactly one rating row.
    await db
      .insert(ratings)
      .values({
        claimId: claimRow.id,
        raterId: baker.id,
        ratedId: eater.id,
        score: 1,
        comment: "should not overwrite",
      })
      .onConflictDoNothing({ target: [ratings.raterId, ratings.claimId] });

    const ratingRows = await db.query.ratings.findMany({
      where: eq(ratings.claimId, claimRow.id),
    });
    expect(ratingRows).toHaveLength(1);
    expect(ratingRows[0].score).toBe(5);
  });
});

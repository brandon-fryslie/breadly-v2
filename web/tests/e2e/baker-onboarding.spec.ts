// E2E for breadly-baker-95i.1: extended bakery onboarding.
//
// Verifies the data flow end-to-end:
//   sign up → /me → fill claim-baker form → redirect to /baker → see
//   storefront URL → see all six fields persisted in the DB.
//
// Also covers the slug uniqueness rejection path: a second user trying to
// claim the same slug should get a field error instead of a 500.

import { test, expect } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";
import { db } from "../../src/db/client";
import { bakerProfiles, users } from "../../src/db/schema";
import { eq, inArray } from "drizzle-orm";

function uniqueEmail(label: string): string {
  // The +clerk_test convention bypasses Clerk's email-verification step in
  // dev instances. The unique suffix prevents collisions across test runs.
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

test.describe("baker onboarding", () => {
  // Track ids so we can clean up regardless of assertion outcome.
  const createdEmails: string[] = [];
  const createdUserIds: string[] = [];

  test.afterAll(async () => {
    if (createdUserIds.length > 0) {
      await db.delete(bakerProfiles).where(inArray(bakerProfiles.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    for (const email of createdEmails) {
      await deleteClerkUserByEmail(email).catch(() => {});
    }
  });

  test("happy path: claim baker captures every storefront field", async ({ page }) => {
    const email = uniqueEmail("happy");
    createdEmails.push(email);
    const clerkUser = await createClerkUser(email);
    createdUserIds.push(clerkUser.id);

    // Mirror the user row the Clerk webhook would normally create. The
    // webhook isn't running against this Clerk dev instance, so we stand
    // in for it. (One source of truth: the action consults the DB row,
    // not Clerk, before flipping canBake.)
    await db.insert(users).values({
      id: clerkUser.id,
      email,
      displayName: "Happy Baker",
      canBake: false,
      canOperate: false,
    });

    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({
      page,
      emailAddress: email,
    });

    await page.goto("/me");
    await expect(page.getByRole("heading", { name: "Become a baker" })).toBeVisible();

    await page.getByLabel(/bakery name/i).fill("Boulder Hearth");
    await page.getByLabel(/storefront url/i).fill("boulder-hearth-happy");
    await page.getByLabel(/neighborhood/i).fill("Mapleton Hill");
    await page.getByLabel(/^bio$/i).fill("Wood-fired country loaves on Saturdays.");
    await page.getByLabel(/cover photo url/i).fill("https://example.com/cover.jpg");
    await page.getByLabel(/pickup window/i).fill("Saturdays 9–11am");

    await page.getByRole("button", { name: /claim baker capability/i }).click();

    await page.waitForURL("**/baker");
    await expect(page.getByText("/b/boulder-hearth-happy")).toBeVisible();
    await expect(page.getByText("Mapleton Hill")).toBeVisible();
    await expect(page.getByText("Boulder Hearth")).toBeVisible();

    // DB-level assertion: all six fields persisted exactly as submitted.
    const profile = await db.query.bakerProfiles.findFirst({
      where: eq(bakerProfiles.userId, clerkUser.id),
    });
    expect(profile).toBeTruthy();
    expect(profile!.slug).toBe("boulder-hearth-happy");
    expect(profile!.bakeryName).toBe("Boulder Hearth");
    expect(profile!.neighborhood).toBe("Mapleton Hill");
    expect(profile!.bio).toBe("Wood-fired country loaves on Saturdays.");
    expect(profile!.coverPhotoUrl).toBe("https://example.com/cover.jpg");
    expect(profile!.pickupWindowText).toBe("Saturdays 9–11am");

    const me = await db.query.users.findFirst({
      where: eq(users.id, clerkUser.id),
      columns: { canBake: true },
    });
    expect(me?.canBake).toBe(true);
  });

  test("slug uniqueness: collision rejected with a field error, not a 500", async ({ page }) => {
    // Seed an existing baker profile that owns the slug we're about to try.
    const seedEmail = uniqueEmail("seed-owner");
    createdEmails.push(seedEmail);
    const seedUser = await createClerkUser(seedEmail);
    createdUserIds.push(seedUser.id);
    await db.insert(users).values({
      id: seedUser.id,
      email: seedEmail,
      displayName: "Seed Owner",
      canBake: true,
      canOperate: false,
    });
    await db.insert(bakerProfiles).values({
      userId: seedUser.id,
      slug: "boulder-hearth-clash",
      bakeryName: "Original Boulder Hearth",
    });

    const email = uniqueEmail("collider");
    createdEmails.push(email);
    const colliderUser = await createClerkUser(email);
    createdUserIds.push(colliderUser.id);
    await db.insert(users).values({
      id: colliderUser.id,
      email,
      displayName: "Collider",
      canBake: false,
      canOperate: false,
    });

    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: email });

    await page.goto("/me");
    await page.getByLabel(/bakery name/i).fill("Boulder Hearth Two");
    await page.getByLabel(/storefront url/i).fill("boulder-hearth-clash");
    await page.getByRole("button", { name: /claim baker capability/i }).click();

    // Stays on /me with a field error. No 5xx, no redirect to /baker.
    await expect(page).toHaveURL(/\/me$/);
    await expect(page.getByText(/already taken/i)).toBeVisible();

    // canBake should still be false — the failed action must not have
    // partially flipped capabilities.
    const me = await db.query.users.findFirst({
      where: eq(users.id, colliderUser.id),
      columns: { canBake: true },
    });
    expect(me?.canBake).toBe(false);
  });

  test("slug derivation: blank slug derives from bakery name", async ({ page }) => {
    const email = uniqueEmail("derive");
    createdEmails.push(email);
    const clerkUser = await createClerkUser(email);
    createdUserIds.push(clerkUser.id);
    await db.insert(users).values({
      id: clerkUser.id,
      email,
      displayName: "Deriver",
      canBake: false,
      canOperate: false,
    });

    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: email });

    await page.goto("/me");
    await page.getByLabel(/bakery name/i).fill("Sara's Sourdough Lab!");
    // Slug field intentionally left blank.
    await page.getByRole("button", { name: /claim baker capability/i }).click();

    await page.waitForURL("**/baker");
    const profile = await db.query.bakerProfiles.findFirst({
      where: eq(bakerProfiles.userId, clerkUser.id),
    });
    // Non-alphanumerics collapse to single hyphens; trim leading/trailing.
    expect(profile?.slug).toBe("sara-s-sourdough-lab");
  });
});

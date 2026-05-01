// Smoke tests for /api/uploads/sign — auth + capability + validation
// gates, plus a live-signing assertion. ADC is required; the suite-wide
// gate in tests/global-setup.ts fails the run if it's missing, so this
// file does not branch on credential presence. [LAW:single-enforcer]

import { test, expect } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";
import { db } from "../../src/db/client";
import { bakerProfiles, users } from "../../src/db/schema";
import { eq, inArray } from "drizzle-orm";

function uniqueEmail(label: string) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${label}+clerk_test_${suffix}@example.com`;
}

async function createClerkUser(email: string) {
  const c = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  return c.users.createUser({
    emailAddress: [email],
    password: "Onboarding!Test123ABCxyz",
    skipPasswordChecks: true,
  });
}

async function deleteClerkUserByEmail(email: string) {
  const c = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  const list = await c.users.getUserList({ emailAddress: [email] });
  for (const u of list.data) await c.users.deleteUser(u.id);
}

test.describe("/api/uploads/sign", () => {
  const createdEmails: string[] = [];
  const createdUserIds: string[] = [];

  test.afterAll(async () => {
    if (createdUserIds.length > 0) {
      await db
        .delete(bakerProfiles)
        .where(inArray(bakerProfiles.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    for (const email of createdEmails) {
      await deleteClerkUserByEmail(email).catch(() => {});
    }
  });

  test("rejects unauthenticated callers with 401", async ({ request }) => {
    const res = await request.post("/api/uploads/sign", {
      data: { contentType: "image/jpeg" },
    });
    expect(res.status()).toBe(401);
  });

  test("rejects non-baker callers with 403", async ({ page }) => {
    const email = uniqueEmail("sign-nonbaker");
    createdEmails.push(email);
    const cu = await createClerkUser(email);
    createdUserIds.push(cu.id);
    await db.insert(users).values({
      id: cu.id,
      email,
      displayName: "Just an Eater",
      canBake: false,
    });

    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: email });

    // page.request shares the BrowserContext that clerk.signIn populated;
    // the bare `request` fixture does not, so it would arrive without a
    // session cookie and 401 before reaching the canBake check.
    const res = await page.request.post("/api/uploads/sign", {
      data: { contentType: "image/jpeg" },
    });
    expect(res.status()).toBe(403);
  });

  test("rejects unsupported content types with 400", async ({ page }) => {
    const email = uniqueEmail("sign-baker-bad-ct");
    createdEmails.push(email);
    const cu = await createClerkUser(email);
    createdUserIds.push(cu.id);
    await db.insert(users).values({
      id: cu.id,
      email,
      displayName: "Sign Baker",
      canBake: true,
      location: { x: -105.282, y: 40.0274 },
    });
    await db.insert(bakerProfiles).values({
      userId: cu.id,
      slug: `sign-bakery-${Math.random().toString(36).slice(2, 8)}`,
      bakeryName: "Sign Bakery",
    });

    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: email });

    const res = await page.request.post("/api/uploads/sign", {
      data: { contentType: "application/pdf" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("unsupported_content_type");
  });

  test("returns a signed URL for a baker with a valid content type", async ({
    page,
  }) => {
    const email = uniqueEmail("sign-baker-ok");
    createdEmails.push(email);
    const cu = await createClerkUser(email);
    createdUserIds.push(cu.id);
    await db.insert(users).values({
      id: cu.id,
      email,
      displayName: "Sign Baker",
      canBake: true,
      location: { x: -105.282, y: 40.0274 },
    });
    await db.insert(bakerProfiles).values({
      userId: cu.id,
      slug: `sign-bakery-${Math.random().toString(36).slice(2, 8)}`,
      bakeryName: "Sign Bakery",
    });

    await page.goto("/");
    await setupClerkTestingToken({ page });
    await clerk.signIn({ page, emailAddress: email });

    const res = await page.request.post("/api/uploads/sign", {
      data: { contentType: "image/jpeg" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.uploadUrl).toMatch(/^https:\/\/storage\.googleapis\.com\//);
    expect(body.uploadUrl).toContain("X-Goog-Signature");
    expect(body.publicUrl).toMatch(
      new RegExp(`^https://storage\\.googleapis\\.com/.+/listings/${cu.id}/.+\\.jpg$`),
    );
    expect(body.contentType).toBe("image/jpeg");
  });
});

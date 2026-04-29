// E2E for breadly-baker-95i.4: public storefront /b/<slug>.
//
// Verifies:
//   - Anonymous (no Clerk sign-in) request renders the page
//   - All four content sections appear with their seeded data
//   - 404 for an unknown slug
//   - OG/Twitter meta tags reflect the storefront — the "Instagram preview"
//     requirement comes down to og:title, og:description, og:image being set

import { test, expect } from "@playwright/test";
import { db } from "../../src/db/client";
import {
  bakerProfiles,
  listings,
  schedules,
  users,
} from "../../src/db/schema";
import { inArray } from "drizzle-orm";

async function seedStorefront(opts: {
  userId: string;
  email: string;
  slug: string;
  bakeryName: string;
  bio?: string;
  coverPhotoUrl?: string;
  pickupWindowText?: string;
  neighborhood?: string;
}) {
  await db.insert(users).values({
    id: opts.userId,
    email: opts.email,
    displayName: "Storefront Owner",
    canBake: true,
    canOperate: false,
    location: { x: -105.282, y: 40.0274 },
  });
  await db.insert(bakerProfiles).values({
    userId: opts.userId,
    slug: opts.slug,
    bakeryName: opts.bakeryName,
    neighborhood: opts.neighborhood ?? "Newlands",
    bio: opts.bio ?? "Sourdough since 2019.",
    coverPhotoUrl: opts.coverPhotoUrl ?? null,
    pickupWindowText: opts.pickupWindowText ?? "Saturdays 9–11am",
    listingCutoffHours: 24,
  });
}

test.describe("public storefront /b/<slug>", () => {
  const createdUserIds: string[] = [];

  test.afterAll(async () => {
    if (createdUserIds.length > 0) {
      await db.delete(schedules).where(inArray(schedules.bakerId, createdUserIds));
      await db.delete(listings).where(inArray(listings.bakerId, createdUserIds));
      await db
        .delete(bakerProfiles)
        .where(inArray(bakerProfiles.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  });

  test("anonymous browser sees hero, ready loaves, scheduled bakes, weekly rhythm", async ({
    page,
  }) => {
    const userId = `user_seed_storefront_${Math.random().toString(36).slice(2, 8)}`;
    createdUserIds.push(userId);
    const slug = `storefront-${Math.random().toString(36).slice(2, 8)}`;

    await seedStorefront({
      userId,
      email: `${slug}@seed.test`,
      slug,
      bakeryName: "Test Storefront Bakery",
      bio: "Slow-fermented sourdough out of a small Boulder kitchen.",
      coverPhotoUrl: "https://example.com/cover.jpg",
    });

    const now = Date.now();
    await db.insert(listings).values([
      // Ready
      {
        bakerId: userId,
        name: "Storefront Country",
        blurb: "Out of the oven this morning.",
        photoUrl: "https://example.com/country.jpg",
        priceCents: 1100,
        qtyTotal: 6,
        qtyAvailable: 4,
        status: "ready",
        readyAt: new Date(now - 30 * 60_000),
        outOfOvenAt: new Date(now - 30 * 60_000),
        expiresAt: new Date(now + 23 * 60 * 60_000),
        location: { x: -105.282, y: 40.0274 },
      },
      // Scheduled (within 7 days)
      {
        bakerId: userId,
        name: "Storefront Sourdough",
        blurb: "Friday's bake.",
        photoUrl: null,
        priceCents: 950,
        qtyTotal: 8,
        qtyAvailable: 8,
        status: "scheduled",
        readyAt: new Date(now + 36 * 60 * 60_000),
        outOfOvenAt: null,
        expiresAt: new Date(now + 60 * 60 * 60_000),
        location: { x: -105.282, y: 40.0274 },
      },
      // Hidden — too far out
      {
        bakerId: userId,
        name: "Far Future Loaf",
        blurb: null,
        photoUrl: null,
        priceCents: 1200,
        qtyTotal: 4,
        qtyAvailable: 4,
        status: "scheduled",
        readyAt: new Date(now + 14 * 24 * 60 * 60_000),
        outOfOvenAt: null,
        expiresAt: new Date(now + 15 * 24 * 60 * 60_000),
        location: { x: -105.282, y: 40.0274 },
      },
    ]);

    // Recurring schedule — every Tue + Fri at 09:00
    await db.insert(schedules).values({
      bakerId: userId,
      kind: "recurring",
      name: "Standing Sourdough",
      blurb: "Weekly bake.",
      photoUrl: null,
      priceCents: 1000,
      defaultQty: 6,
      daysOfWeek: [2, 5],
      timeOfDay: "09:00",
      firstReadyAt: null,
      tagSlugs: ["sourdough", "long-ferment"],
      active: true,
    });

    // One-off in the next week
    await db.insert(schedules).values({
      bakerId: userId,
      kind: "one_off",
      name: "Birthday Brioche",
      blurb: "Special bake.",
      photoUrl: null,
      priceCents: 1800,
      defaultQty: 4,
      daysOfWeek: [],
      timeOfDay: null,
      firstReadyAt: new Date(now + 4 * 24 * 60 * 60_000),
      tagSlugs: ["brioche"],
      active: true,
    });

    // Anonymous (no signIn) — page should render directly.
    await page.goto(`/b/${slug}`);

    await expect(
      page.getByRole("heading", { name: "Test Storefront Bakery" }),
    ).toBeVisible();
    await expect(page.getByTestId("storefront-hero")).toContainText(
      "Slow-fermented sourdough",
    );
    await expect(page.getByTestId("storefront-hero")).toContainText("Newlands");
    await expect(page.getByTestId("storefront-hero")).toContainText(
      "Saturdays 9–11am",
    );

    // Section 01 — ready
    const readyEl = page.getByTestId("section-ready-right-now");
    await expect(readyEl).toContainText("Storefront Country");
    await expect(readyEl).toContainText("4/6 left");
    await expect(readyEl).not.toContainText("Far Future Loaf");

    // Section 02 — scheduled within window only
    const scheduledEl = page.getByTestId("section-coming-up");
    await expect(scheduledEl).toContainText("Storefront Sourdough");
    await expect(scheduledEl).not.toContainText("Far Future Loaf");

    // Section 03 — recurring schedule projection
    const rhythmEl = page.getByTestId("section-the-weekly-rhythm");
    await expect(rhythmEl).toContainText("Standing Sourdough");
    await expect(rhythmEl).toContainText("Birthday Brioche");

    // OG/Twitter meta — the "Instagram preview" criterion.
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute(
      "content",
      "Test Storefront Bakery · Breadly",
    );
    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute(
      "content",
      "https://example.com/cover.jpg",
    );
    const ogDesc = page.locator('meta[property="og:description"]');
    await expect(ogDesc).toHaveAttribute("content", /Newlands|ready/);
    const twitterCard = page.locator('meta[name="twitter:card"]');
    await expect(twitterCard).toHaveAttribute("content", "summary_large_image");
  });

  test("unknown slug renders a 404", async ({ page }) => {
    const slug = `does-not-exist-${Math.random().toString(36).slice(2, 10)}`;
    const res = await page.goto(`/b/${slug}`);
    expect(res?.status()).toBe(404);
  });
});

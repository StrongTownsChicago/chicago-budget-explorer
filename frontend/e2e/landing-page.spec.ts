import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("has correct title and meta tags", async ({ page }) => {
    await expect(page).toHaveTitle(/Chicago Budget Explorer/i);
  });

  test("displays hero section with call-to-action", async ({ page }) => {
    // Check for hero heading
    const heroHeading = page.getByRole("heading", { level: 1 });
    await expect(heroHeading).toBeVisible();
    await expect(heroHeading).toContainText(/chicago|spend/i);

    // Check for CTA button (be specific to avoid matching logo)
    const exploreButton = page.getByRole("link", { name: /explore.*budget/i });
    await expect(exploreButton).toBeVisible();
  });

  test("displays entity cards", async ({ page }) => {
    // Check for City of Chicago card heading
    const cityCard = page.getByRole("heading", { name: /City of Chicago/i });
    await expect(cityCard).toBeVisible();

    // Check for Chicago Public Schools card heading
    const cpsCard = page.getByRole("heading", { name: /Chicago Public Schools/i });
    await expect(cpsCard).toBeVisible();
  });

  test("has working navigation", async ({ page }) => {
    // Check header navigation exists
    const nav = page.getByRole("navigation");
    await expect(nav).toBeVisible();

    // Check for About link in navigation (exact match to avoid multiple matches)
    const aboutLink = nav.getByRole("link", { name: "About" });
    await expect(aboutLink).toBeVisible();
  });

  test("has footer with attribution", async ({ page }) => {
    // Scroll to footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Check for data source attribution
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer).toContainText(/data/i);
  });

  test("has skip to main content link for accessibility", async ({ page }) => {
    // Focus on skip link (it should be the first focusable element)
    await page.keyboard.press("Tab");

    const skipLink = page.getByText(/skip to main content/i);
    await expect(skipLink).toBeFocused();
  });

  test("is responsive on mobile", async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
    }

    // Check that page renders without horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width || 0;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);

    // Check that hero text is readable
    const heroHeading = page.getByRole("heading", { level: 1 });
    await expect(heroHeading).toBeVisible();
  });
});

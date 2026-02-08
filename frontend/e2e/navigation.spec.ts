import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test.skip("navigates from home to about page", async ({ page }) => {
    // This test will be enabled when about page is created
    await page.goto("/");

    // Click About link in navigation
    const nav = page.getByRole("navigation");
    await nav.getByRole("link", { name: "About" }).click();

    // Wait for navigation
    await page.waitForURL("**/about");

    // Verify we're on the about page
    await expect(page).toHaveURL(/\/about/);

    // Check for about page content
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
  });

  test("navigates to entity page from landing page", async ({ page }) => {
    await page.goto("/");

    // Click on City of Chicago entity card
    // This assumes there's a link or button to explore the City budget
    const exploreButton = page.getByRole("link", { name: /explore.*city/i }).first();

    if (await exploreButton.isVisible()) {
      await exploreButton.click();

      // Wait for navigation to entity page
      await page.waitForURL("**/entity/**");

      // Verify we're on an entity page
      await expect(page).toHaveURL(/\/entity\//);
    } else {
      // Entity page not yet implemented, skip test
      test.skip();
    }
  });

  test.skip("can navigate back using browser back button", async ({ page }) => {
    // This test will be enabled when about page is created
    await page.goto("/");

    // Go to about page
    const nav = page.getByRole("navigation");
    await nav.getByRole("link", { name: "About" }).click();
    await page.waitForURL("**/about");

    // Go back
    await page.goBack();

    // Should be back on home page
    await expect(page).toHaveURL("/");
  });

  test.skip("logo links back to home page", async ({ page }) => {
    // This test will be enabled when there are multiple pages to navigate between
    await page.goto("/");

    // For now, just verify logo link exists and points to home
    const homeLink = page.getByRole("link", { name: /Chicago Budget Explorer/i }).first();
    await expect(homeLink).toHaveAttribute("href", "/");
  });

  test("navigation exists on homepage", async ({ page }) => {
    await page.goto("/");

    // Check that navigation exists
    const nav = page.getByRole("navigation");
    await expect(nav).toBeVisible();

    // Check that About link is present in navigation
    const aboutLink = nav.getByRole("link", { name: "About" });
    await expect(aboutLink).toBeVisible();
  });
});

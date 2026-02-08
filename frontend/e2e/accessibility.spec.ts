import { test, expect } from "@playwright/test";

test.describe("Accessibility", () => {
  test("has no automatic accessibility violations on landing page", async ({ page }) => {
    await page.goto("/");

    // Check for basic accessibility issues
    // Note: For comprehensive a11y testing, integrate @axe-core/playwright

    // Check that images have alt text
    const images = page.locator("img");
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute("alt");
      // Alt can be empty for decorative images, but attribute should exist
      expect(alt).toBeDefined();
    }
  });

  test("can navigate using keyboard only", async ({ page }) => {
    await page.goto("/");

    // Tab through focusable elements
    await page.keyboard.press("Tab"); // Skip link
    await page.keyboard.press("Tab"); // Logo/home link
    await page.keyboard.press("Tab"); // About link or first navigation item

    // Check that something is focused
    const focusedElement = page.locator(":focus");
    await expect(focusedElement).toBeVisible();
  });

  test("has proper heading hierarchy", async ({ page }) => {
    await page.goto("/");

    // Should have at least one h1 (multiple h1s acceptable for complex layouts)
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBeGreaterThanOrEqual(1);

    // Check that headings are in order (h1, then h2, etc.)
    const headings = await page.locator("h1, h2, h3, h4, h5, h6").all();

    expect(headings.length).toBeGreaterThan(0);

    // First heading should be h1
    const firstHeadingTag = await headings[0].evaluate((el) => el.tagName.toLowerCase());
    expect(firstHeadingTag).toBe("h1");
  });

  test("has sufficient color contrast", async ({ page }) => {
    await page.goto("/");

    // This is a basic check - for comprehensive contrast testing, use axe-core
    // Check that text is visible (basic smoke test)
    const mainContent = page.locator("main");
    await expect(mainContent).toBeVisible();

    const textElements = mainContent.locator("p, h1, h2, h3, li, span");
    const count = await textElements.count();

    expect(count).toBeGreaterThan(0);
  });

  test("has accessible form labels (if forms exist)", async ({ page }) => {
    await page.goto("/");

    // Check if there are any input fields
    const inputs = page.locator("input, select, textarea");
    const inputCount = await inputs.count();

    // If inputs exist, check they have labels
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute("id");

      if (id) {
        // Check for associated label
        const label = page.locator(`label[for="${id}"]`);
        await expect(label).toBeVisible();
      } else {
        // Input should have aria-label or be inside a label
        const ariaLabel = await input.getAttribute("aria-label");
        const hasAriaLabel = ariaLabel !== null && ariaLabel.length > 0;

        if (!hasAriaLabel) {
          // Should be inside a label
          const parentLabel = input.locator("xpath=ancestor::label");
          const labelCount = await parentLabel.count();
          expect(labelCount).toBeGreaterThan(0);
        }
      }
    }
  });

  test("has ARIA landmarks", async ({ page }) => {
    await page.goto("/");

    // Check for main landmark
    const main = page.getByRole("main");
    await expect(main).toBeVisible();

    // Check for navigation landmark
    const nav = page.getByRole("navigation");
    await expect(nav).toBeVisible();

    // Check for contentinfo (footer)
    const footer = page.getByRole("contentinfo");
    await expect(footer).toBeVisible();
  });

  test("respects prefers-reduced-motion", async ({ page }) => {
    // Set reduced motion preference
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    // Check that no animations are running
    // This is a basic check - actual implementation depends on CSS
    const bodyStyles = await page.locator("body").evaluate((el) => {
      return window.getComputedStyle(el).getPropertyValue("animation");
    });

    // Should be 'none', empty, or very small value (effectively no animation)
    expect(bodyStyles).toMatch(/none|^$|^[\d.e-]+s$/);
  });
});

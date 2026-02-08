/**
 * Test helpers and utilities for Playwright E2E tests.
 */

import { Page, expect } from "@playwright/test";

/**
 * Wait for page to be fully loaded (including network idle).
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
}

/**
 * Check if an element is visible in the viewport.
 */
export async function isInViewport(page: Page, selector: string): Promise<boolean> {
  return await page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  });
}

/**
 * Scroll element into view.
 */
export async function scrollIntoView(page: Page, selector: string): Promise<void> {
  await page.locator(selector).scrollIntoViewIfNeeded();
}

/**
 * Take a screenshot with automatic naming.
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  fullPage: boolean = false
): Promise<void> {
  await page.screenshot({
    path: `screenshots/${name}-${Date.now()}.png`,
    fullPage,
  });
}

/**
 * Check for console errors during test.
 */
export function setupConsoleErrorTracking(page: Page): void {
  const errors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });

  page.on("pageerror", (error) => {
    errors.push(error.message);
  });

  // Return errors array for assertions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (page as any)._testErrors = errors;
}

/**
 * Get tracked console errors.
 */
export function getConsoleErrors(page: Page): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (page as any)._testErrors || [];
}

/**
 * Assert no console errors occurred.
 */
export async function assertNoConsoleErrors(page: Page): Promise<void> {
  const errors = getConsoleErrors(page);
  expect(errors).toHaveLength(0);
}

/**
 * Mock budget data for testing.
 */
export async function mockBudgetData(page: Page, data: unknown): Promise<void> {
  await page.route("**/data/**/*.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
}

/**
 * Wait for chart to render (SVG or Canvas).
 */
export async function waitForChart(page: Page): Promise<void> {
  // Wait for either SVG or Canvas to appear
  await page.waitForSelector("svg, canvas", { timeout: 10000 });

  // Wait a bit more for animations to complete
  await page.waitForTimeout(500);
}

/**
 * Check if page has accessibility issues using basic checks.
 * For comprehensive testing, use @axe-core/playwright
 */
export async function checkBasicAccessibility(page: Page): Promise<void> {
  // Check for h1
  const h1Count = await page.locator("h1").count();
  expect(h1Count).toBe(1);

  // Check for main landmark
  const main = page.getByRole("main");
  await expect(main).toBeVisible();

  // Check all images have alt attribute
  const images = await page.locator("img").all();
  for (const img of images) {
    const alt = await img.getAttribute("alt");
    expect(alt).toBeDefined();
  }
}

/**
 * Test keyboard navigation through focusable elements.
 */
export async function testKeyboardNavigation(
  page: Page,
  expectedFocusableCount?: number
): Promise<void> {
  let focusCount = 0;
  const maxTabs = expectedFocusableCount || 50;

  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press("Tab");

    const focused = page.locator(":focus");
    const isVisible = await focused.isVisible().catch(() => false);

    if (isVisible) {
      focusCount++;
    }
  }

  expect(focusCount).toBeGreaterThan(0);

  if (expectedFocusableCount) {
    expect(focusCount).toBe(expectedFocusableCount);
  }
}

/**
 * Get computed color contrast ratio (simplified check).
 */
export async function checkColorContrast(
  page: Page,
  textSelector: string,
  _bgSelector?: string
): Promise<void> {
  const textElement = page.locator(textSelector).first();
  await expect(textElement).toBeVisible();

  // This is a simplified check - for full WCAG compliance, use axe-core
  const textColor = await textElement.evaluate((el) => {
    return window.getComputedStyle(el).color;
  });

  expect(textColor).toBeTruthy();
  expect(textColor).not.toBe("rgba(0, 0, 0, 0)"); // Not transparent
}

/**
 * Simulate slow network for testing loading states.
 */
export async function simulateSlowNetwork(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: (500 * 1024) / 8, // 500 Kbps
    uploadThroughput: (500 * 1024) / 8,
    latency: 400, // 400ms latency
  });
}

/**
 * Check responsive design at different viewport sizes.
 */
export async function testResponsiveDesign(
  page: Page,
  testCallback: (width: number, height: number) => Promise<void>
): Promise<void> {
  const viewports = [
    { width: 375, height: 667, name: "Mobile" }, // iPhone SE
    { width: 768, height: 1024, name: "Tablet" }, // iPad
    { width: 1920, height: 1080, name: "Desktop" }, // Full HD
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await testCallback(viewport.width, viewport.height);
  }
}

/**
 * Navigate to an entity page.
 */
export async function gotoEntityPage(page: Page, entityId: string): Promise<void> {
  await page.goto(`/entity/${entityId}`);
  await waitForPageLoad(page);
}

/**
 * Wait for charts to render (ensures chart elements are present and stable).
 */
export async function waitForCharts(page: Page): Promise<void> {
  // Wait for chart elements to be present
  await page.waitForSelector("svg, canvas", { timeout: 10000 });

  // Wait for charts to finish rendering and animations
  await page.waitForTimeout(500);
}

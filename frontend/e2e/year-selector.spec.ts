import { test, expect } from "@playwright/test";
import { gotoEntityPage, waitForCharts } from "./helpers";

test.describe("Year Selector", () => {
  test("displays year selector on entity page", async ({ page }) => {
    await gotoEntityPage(page, "city-of-chicago");

    // Year selector should be visible
    const yearSelector = page.locator('select#year-selector');
    await expect(yearSelector).toBeVisible();

    // Should have a label
    const label = page.locator('label[for="year-selector"]');
    await expect(label).toBeVisible();
    await expect(label).toContainText("Fiscal Year");
  });

  test("shows all available years in dropdown", async ({ page }) => {
    await gotoEntityPage(page, "city-of-chicago");

    const yearSelector = page.locator('select#year-selector');

    // Get all options
    const options = await yearSelector.locator('option').allTextContents();

    // Should have FY2025 and FY2024
    expect(options).toContain("FY2025");
    expect(options).toContain("FY2024");
    expect(options.length).toBeGreaterThanOrEqual(2);
  });

  test("defaults to most recent year (FY2026)", async ({ page }) => {
    await gotoEntityPage(page, "city-of-chicago");

    const yearSelector = page.locator('select#year-selector');
    const selectedValue = await yearSelector.inputValue();

    expect(selectedValue).toBe("fy2026");
  });

  test("switches data when year is changed", async ({ page }) => {
    await gotoEntityPage(page, "city-of-chicago");
    await waitForCharts(page);

    // Get initial budget total (FY2026)
    const initialBudgetText = await page.locator('p.text-xl.text-gray-600').first().textContent();
    expect(initialBudgetText).toContain("FY2026 Operating Budget");

    // Select FY2024
    const yearSelector = page.locator('select#year-selector');
    await yearSelector.selectOption("fy2024");

    // Wait for content to update
    await page.waitForTimeout(500);

    // Budget total should now show FY2024
    const updatedBudgetText = await page.locator('p.text-xl.text-gray-600').first().textContent();
    expect(updatedBudgetText).toContain("FY2024 Operating Budget");
  });

  test("updates all charts when year changes", async ({ page }) => {
    await gotoEntityPage(page, "city-of-chicago");
    await waitForCharts(page);

    // Verify charts are loaded for initial year
    await expect(page.locator('[class*="recharts"]').first()).toBeVisible();

    // Switch to FY2024
    const yearSelector = page.locator('select#year-selector');
    await yearSelector.selectOption("fy2024");

    // Wait for charts to re-render
    await page.waitForTimeout(1000);

    // Charts should still be visible (verifies they updated without breaking)
    await expect(page.locator('[class*="recharts"]').first()).toBeVisible();
  });

  test("maintains year selection when scrolling", async ({ page }) => {
    await gotoEntityPage(page, "city-of-chicago");

    // Select FY2024
    const yearSelector = page.locator('select#year-selector');
    await yearSelector.selectOption("fy2024");

    // Scroll down the page
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(300);

    // Year selector should still show FY2024
    const selectedValue = await yearSelector.inputValue();
    expect(selectedValue).toBe("fy2024");
  });

  test("year selector is keyboard accessible", async ({ page }) => {
    await gotoEntityPage(page, "city-of-chicago");

    const yearSelector = page.locator('select#year-selector');

    // Focus the year selector directly
    await yearSelector.focus();
    await expect(yearSelector).toBeFocused();

    // Use arrow keys to change selection
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(300);

    // Should have changed to FY2025
    const selectedValue = await yearSelector.inputValue();
    expect(selectedValue).toBe("fy2025");

    // Verify it can be tabbed to in normal tab order
    await page.goto(`/entity/city-of-chicago`);
    await page.waitForLoadState("networkidle");

    // Tab through elements until we reach the year selector
    let attempts = 0;
    const maxTabs = 10;

    while (attempts < maxTabs) {
      await page.keyboard.press("Tab");
      const isFocused = await yearSelector.evaluate((el) => el === document.activeElement);

      if (isFocused) {
        break;
      }

      attempts++;
    }

    // Verify we found it in the tab order
    expect(attempts).toBeLessThan(maxTabs);
    await expect(yearSelector).toBeFocused();
  });

  test("year selector works on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await gotoEntityPage(page, "city-of-chicago");

    const yearSelector = page.locator('select#year-selector');
    await expect(yearSelector).toBeVisible();

    // Should be functional on mobile
    await yearSelector.selectOption("fy2024");
    await page.waitForTimeout(500);

    const updatedBudgetText = await page.locator('p.text-xl.text-gray-600').first().textContent();
    expect(updatedBudgetText).toContain("FY2024 Operating Budget");
  });

  test("data source attribution updates with year", async ({ page }) => {
    await gotoEntityPage(page, "city-of-chicago");
    await waitForCharts(page);

    // Get initial dataset ID (FY2025)
    const initialDataset = await page.locator('text=/Dataset:.*/')
      .first()
      .textContent();

    // Switch to FY2024
    const yearSelector = page.locator('select#year-selector');
    await yearSelector.selectOption("fy2024");
    await page.waitForTimeout(500);

    // Dataset ID should change
    const updatedDataset = await page.locator('text=/Dataset:.*/')
      .first()
      .textContent();

    // The datasets should be different (different Socrata IDs for different years)
    expect(initialDataset).not.toBe(updatedDataset);
  });

  test("year selector persists correct state across rapid changes", async ({ page }) => {
    await gotoEntityPage(page, "city-of-chicago");

    const yearSelector = page.locator('select#year-selector');

    // Rapidly switch years
    await yearSelector.selectOption("fy2024");
    await yearSelector.selectOption("fy2025");
    await yearSelector.selectOption("fy2024");
    await yearSelector.selectOption("fy2025");

    // Wait for final render
    await page.waitForTimeout(1000);

    // Should settle on FY2025
    const finalValue = await yearSelector.inputValue();
    expect(finalValue).toBe("fy2025");

    const budgetText = await page.locator('p.text-xl.text-gray-600').first().textContent();
    expect(budgetText).toContain("FY2025 Operating Budget");
  });
});

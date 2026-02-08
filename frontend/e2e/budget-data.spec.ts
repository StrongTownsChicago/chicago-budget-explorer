import { test, expect } from "@playwright/test";

test.describe("Budget Data Display", () => {
  test.skip("entity page displays budget data", async ({ page }) => {
    // This test will be enabled when entity pages are implemented
    await page.goto("/entity/city-of-chicago");

    // Check for budget total
    const budgetTotal = page.getByText(/\$\d+\.?\d*[BMK]?/);
    await expect(budgetTotal).toBeVisible();

    // Check for department list
    const departments = page.getByRole("list");
    await expect(departments).toBeVisible();
  });

  test.skip("entity page displays charts", async ({ page }) => {
    // This test will be enabled when charts are implemented
    await page.goto("/entity/city-of-chicago");

    // Check for chart container (using canvas or svg)
    const chart = page.locator("svg, canvas");
    await expect(chart.first()).toBeVisible();
  });

  test.skip("can filter departments by amount", async ({ page }) => {
    // This test will be enabled when filtering is implemented
    await page.goto("/entity/city-of-chicago");

    // Get initial department count
    const departmentItems = page.locator('[data-testid="department-item"]');
    const initialCount = await departmentItems.count();

    // Apply filter (example: only show departments > $100M)
    // Implementation depends on actual UI

    // Check that department count changed
    const filteredCount = await departmentItems.count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test.skip("displays year-over-year comparison", async ({ page }) => {
    // This test will be enabled when YoY comparison is implemented
    await page.goto("/entity/city-of-chicago");

    // Check for change indicators (+/- percentages)
    const changeIndicator = page.getByText(/[+-]\d+\.?\d*%/);
    await expect(changeIndicator.first()).toBeVisible();
  });
});

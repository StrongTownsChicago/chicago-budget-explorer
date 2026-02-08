import { test, expect } from "@playwright/test";

test.describe("Budget Simulator", () => {
  test.skip("simulator page loads with default values", async ({ page }) => {
    // This test will be enabled when simulator is implemented
    await page.goto("/entity/city-of-chicago/simulate");

    // Check for department sliders
    const sliders = page.getByRole("slider");
    expect(await sliders.count()).toBeGreaterThan(0);

    // Check that budget is initially balanced
    const budgetBalance = page.getByText(/balanced|budget delta/i);
    await expect(budgetBalance).toBeVisible();
  });

  test.skip("can adjust department budgets", async ({ page }) => {
    // This test will be enabled when simulator is implemented
    await page.goto("/entity/city-of-chicago/simulate");

    // Find Police department slider
    const policeSlider = page.locator('[data-testid="dept-police-slider"]');
    await expect(policeSlider).toBeVisible();

    // Get initial value
    const initialValue = await policeSlider.getAttribute("aria-valuenow");

    // Adjust slider (increase budget by 10%)
    await policeSlider.fill("110"); // Assuming value is percentage

    // Verify value changed
    const newValue = await policeSlider.getAttribute("aria-valuenow");
    expect(newValue).not.toBe(initialValue);

    // Check that total budget updated
    const totalBudget = page.locator('[data-testid="total-budget"]');
    await expect(totalBudget).toBeVisible();
  });

  test.skip("shows budget imbalance when adjustments don't balance", async ({ page }) => {
    // This test will be enabled when simulator is implemented
    await page.goto("/entity/city-of-chicago/simulate");

    // Increase one department without decreasing others
    const slider = page.getByRole("slider").first();
    await slider.fill("150"); // Increase by 50%

    // Check for imbalance indicator
    const imbalance = page.getByText(/over budget|\+\$/i);
    await expect(imbalance).toBeVisible();
  });

  test.skip("can reset simulator to default values", async ({ page }) => {
    // This test will be enabled when simulator is implemented
    await page.goto("/entity/city-of-chicago/simulate");

    // Make some adjustments
    const slider = page.getByRole("slider").first();
    await slider.fill("120");

    // Click reset button
    const resetButton = page.getByRole("button", { name: /reset/i });
    await resetButton.click();

    // Check that slider is back to 100%
    const value = await slider.getAttribute("aria-valuenow");
    expect(value).toBe("100");
  });

  test.skip("respects department constraints", async ({ page }) => {
    // This test will be enabled when simulator is implemented
    await page.goto("/entity/city-of-chicago/simulate");

    // Try to adjust Finance General (should be non-adjustable)
    const financeSlider = page.locator('[data-testid="dept-finance-general-slider"]');

    // Check if slider is disabled
    await expect(financeSlider).toBeDisabled();
  });

  test.skip("shows impact summary with explanations", async ({ page }) => {
    // This test will be enabled when simulator is implemented
    await page.goto("/entity/city-of-chicago/simulate");

    // Make adjustments
    const policeSlider = page.locator('[data-testid="dept-police-slider"]');
    await policeSlider.fill("80"); // Decrease by 20%

    // Check for impact summary
    const impactSummary = page.getByText(/impact|changes|adjustments/i);
    await expect(impactSummary).toBeVisible();

    // Check that Police department is listed as adjusted
    const adjustedDepts = page.locator('[data-testid="adjusted-departments"]');
    await expect(adjustedDepts).toContainText(/police/i);
  });

  test.skip("keyboard navigation works for sliders", async ({ page }) => {
    // This test will be enabled when simulator is implemented
    await page.goto("/entity/city-of-chicago/simulate");

    // Focus on first slider
    const slider = page.getByRole("slider").first();
    await slider.focus();

    // Get initial value
    const initialValue = await slider.getAttribute("aria-valuenow");

    // Use arrow keys to adjust
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");

    // Value should have changed
    const newValue = await slider.getAttribute("aria-valuenow");
    expect(newValue).not.toBe(initialValue);
  });

  test.skip("simulator works on mobile", async ({ page, isMobile }) => {
    // This test will be enabled when simulator is implemented
    if (!isMobile) {
      test.skip();
    }

    await page.goto("/entity/city-of-chicago/simulate");

    // Check that sliders are touch-friendly
    const slider = page.getByRole("slider").first();
    await expect(slider).toBeVisible();

    // Touch and drag should work
    const box = await slider.boundingBox();
    if (box) {
      await page.touchscreen.tap(box.x + box.width * 0.7, box.y + box.height / 2);

      // Verify value changed
      const value = await slider.getAttribute("aria-valuenow");
      expect(value).toBeDefined();
    }
  });
});

# End-to-End Tests (Playwright)

## Overview

This directory contains Playwright tests for end-to-end testing of the Chicago Budget Explorer frontend.

## Test Structure

### Test Files

- **`landing-page.spec.ts`** - Tests for the home page
  - Hero section rendering
  - Entity cards display
  - Navigation presence
  - Footer attribution
  - Accessibility (skip link)
  - Responsive design

- **`navigation.spec.ts`** - Tests for site navigation
  - Home to About navigation
  - Entity page navigation
  - Browser back button
  - Logo home link
  - Navigation consistency

- **`accessibility.spec.ts`** - Tests for accessibility compliance
  - Image alt text
  - Keyboard navigation
  - Heading hierarchy
  - Color contrast (basic)
  - Form labels
  - ARIA landmarks
  - Reduced motion support

- **`budget-data.spec.ts`** - Tests for budget data display (skipped until implemented)
  - Budget totals
  - Department lists
  - Charts rendering
  - Filtering
  - Year-over-year comparison

- **`simulator.spec.ts`** - Tests for budget simulator (skipped until implemented)
  - Default values
  - Slider adjustments
  - Budget balance
  - Reset functionality
  - Department constraints
  - Impact summary
  - Keyboard navigation
  - Mobile touch support

### Helper Utilities

**`helpers.ts`** - Shared test utilities:
- `waitForPageLoad()` - Wait for full page load
- `isInViewport()` - Check element visibility
- `scrollIntoView()` - Scroll to element
- `takeScreenshot()` - Capture screenshots
- `setupConsoleErrorTracking()` - Track console errors
- `mockBudgetData()` - Mock API responses
- `waitForChart()` - Wait for chart rendering
- `checkBasicAccessibility()` - Basic a11y checks
- `testKeyboardNavigation()` - Keyboard nav testing
- `simulateSlowNetwork()` - Test loading states
- `testResponsiveDesign()` - Multi-viewport testing

## Running Tests

### Install Playwright Browsers

First time only:
```bash
npx playwright install
```

### Run All Tests

```bash
npm run test:e2e
```

### Run Tests in UI Mode

Interactive test runner with time travel debugging:
```bash
npm run test:e2e:ui
```

### Run Tests in Debug Mode

Step through tests with Playwright Inspector:
```bash
npm run test:e2e:debug
```

### Run Specific Test File

```bash
npx playwright test landing-page.spec.ts
```

### Run Tests for Specific Browser

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Run Tests on Mobile

```bash
npx playwright test --project="Mobile Chrome"
npx playwright test --project="Mobile Safari"
```

### View Test Report

After running tests:
```bash
npm run test:e2e:report
```

### Run in Headed Mode

See the browser while tests run:
```bash
npx playwright test --headed
```

## Test Configuration

**`playwright.config.ts`** configures:

- **Base URL**: `http://localhost:4321` (dev server)
- **Browsers**: Chromium, Firefox, WebKit
- **Mobile**: Pixel 5, iPhone 12
- **Retries**: 2 on CI, 0 locally
- **Reporters**: HTML locally, GitHub on CI
- **Screenshots**: On failure only
- **Traces**: On first retry
- **Web Server**: Auto-starts dev server before tests

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from "@playwright/test";

test.describe("Feature Name", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should do something", async ({ page }) => {
    // Arrange
    const button = page.getByRole("button", { name: /click me/i });

    // Act
    await button.click();

    // Assert
    await expect(page).toHaveURL(/\/success/);
  });
});
```

### Using Helpers

```typescript
import { waitForChart, checkBasicAccessibility } from "./helpers";

test("chart renders correctly", async ({ page }) => {
  await page.goto("/entity/city-of-chicago");

  await waitForChart(page);
  await checkBasicAccessibility(page);

  const chart = page.locator("svg");
  await expect(chart).toBeVisible();
});
```

### Skipping Tests

Tests for features not yet implemented are marked with `test.skip()`:

```typescript
test.skip("future feature", async ({ page }) => {
  // This will not run until .skip is removed
});
```

### Mobile-Only Tests

```typescript
test("mobile-specific behavior", async ({ page, isMobile }) => {
  if (!isMobile) {
    test.skip();
  }

  // Mobile-specific test code
});
```

## Best Practices

### 1. Use Semantic Selectors

✅ **Good**: Use role-based selectors
```typescript
page.getByRole("button", { name: /submit/i })
page.getByRole("heading", { level: 1 })
```

❌ **Bad**: Use CSS selectors
```typescript
page.locator(".submit-button")
page.locator("#heading")
```

### 2. Wait for Elements Properly

✅ **Good**: Use auto-waiting
```typescript
await expect(page.getByText("Success")).toBeVisible();
```

❌ **Bad**: Use arbitrary timeouts
```typescript
await page.waitForTimeout(5000);
```

### 3. Test User Behavior

✅ **Good**: Test what users see and do
```typescript
await page.getByRole("button", { name: /explore/i }).click();
await expect(page).toHaveURL(/\/entity/);
```

❌ **Bad**: Test implementation details
```typescript
expect(page.locator(".react-state")).toHaveText("ready");
```

### 4. Use Data Test IDs Sparingly

Only when semantic selectors aren't sufficient:
```typescript
page.locator('[data-testid="dept-police-slider"]')
```

### 5. Clean Test Data

Use `test.beforeEach()` for setup and `test.afterEach()` for cleanup:
```typescript
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test.afterEach(async ({ page }) => {
  await page.close();
});
```

## Debugging

### Debug Specific Test

```bash
npx playwright test landing-page.spec.ts:10 --debug
```

### Pause Test Execution

Add `await page.pause()` in test:
```typescript
test("debug this", async ({ page }) => {
  await page.goto("/");
  await page.pause(); // Opens Playwright Inspector
});
```

### View Traces

After test failure:
```bash
npx playwright show-trace trace.zip
```

### Console Logs

See console output during tests:
```typescript
page.on("console", (msg) => console.log(msg.text()));
```

## CI/CD Integration

Tests run automatically on GitHub Actions:

**.github/workflows/test.yml**:
```yaml
- name: Install Playwright
  run: npx playwright install --with-deps

- name: Run E2E tests
  run: npm run test:e2e

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Coverage

### Areas Covered

- ✅ Landing page rendering
- ✅ Navigation between pages
- ✅ Accessibility basics
- ⏳ Budget data display (pending implementation)
- ⏳ Charts and visualizations (pending implementation)
- ⏳ Simulator functionality (pending implementation)

### Areas Not Covered (Future)

- API error handling
- Network failure recovery
- Browser storage (localStorage)
- Print styles
- Email sharing
- Social media integration

## Troubleshooting

### Issue: "Dev server didn't start"

**Solution**: Increase timeout in `playwright.config.ts`:
```typescript
webServer: {
  timeout: 180 * 1000, // 3 minutes
}
```

### Issue: "Element not visible"

**Solution**: Wait for element or scroll into view:
```typescript
await page.locator("button").scrollIntoViewIfNeeded();
await page.locator("button").click();
```

### Issue: "Tests flaky on CI"

**Solution**: Enable retries:
```typescript
retries: process.env.CI ? 2 : 0,
```

### Issue: "Slow tests"

**Solution**: Run tests in parallel:
```typescript
workers: process.env.CI ? 1 : undefined, // Parallel locally
```

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Writing Tests](https://playwright.dev/docs/writing-tests)
- [Selectors](https://playwright.dev/docs/selectors)
- [Assertions](https://playwright.dev/docs/test-assertions)

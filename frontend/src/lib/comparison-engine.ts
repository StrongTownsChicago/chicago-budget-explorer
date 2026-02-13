/**
 * Pure functions for computing budget comparisons between two fiscal years.
 *
 * All functions are pure (same input = same output) for easy testing.
 * Departments are matched by stable `code` (government department number) across years.
 * Follows the same pure-function pattern as simulation-engine.ts.
 */

import type { BudgetData, Department } from "./types";

/** Result of comparing a single item (department, revenue source, or subcategory). */
export interface ComparisonItem {
  id: string;
  name: string;
  baseAmount: number | null; // null = not present in base year
  targetAmount: number | null; // null = not present in target year
  delta: number | null; // target - base (null if either missing)
  deltaPct: number | null; // percentage change (null if either missing or base is 0)
  status: "common" | "added" | "removed"; // present in both, only in target, only in base
}

/** Top-level comparison summary. */
export interface ComparisonSummary {
  baseYear: string;
  targetYear: string;
  baseYearLabel: string;
  targetYearLabel: string;
  totalAppropriations: ComparisonItem;
  grossAppropriations: ComparisonItem;
  totalRevenue: ComparisonItem | null; // null if revenue missing in either year
  operatingAppropriations: ComparisonItem | null;
  fundCategoryBreakdown: ComparisonItem[];
}

/**
 * Calculate percentage change, handling edge cases.
 *
 * @returns Percentage change, or null if base is zero or either value is null.
 */
function computeDeltaPct(
  baseAmount: number | null,
  targetAmount: number | null,
): number | null {
  if (baseAmount === null || targetAmount === null) return null;
  if (baseAmount === 0) return null;
  return ((targetAmount - baseAmount) / baseAmount) * 100;
}

/**
 * Create a ComparisonItem for two scalar values (not matched by ID).
 */
function createScalarComparison(
  id: string,
  name: string,
  baseAmount: number | null,
  targetAmount: number | null,
): ComparisonItem {
  const bothPresent = baseAmount !== null && targetAmount !== null;
  const delta = bothPresent ? targetAmount - baseAmount : null;
  const deltaPct = computeDeltaPct(baseAmount, targetAmount);

  let status: ComparisonItem["status"] = "common";
  if (baseAmount === null) status = "added";
  if (targetAmount === null) status = "removed";

  return { id, name, baseAmount, targetAmount, delta, deltaPct, status };
}

/**
 * Compare two BudgetData objects, producing a top-level summary.
 *
 * @param base - Base year budget data
 * @param target - Target year budget data
 * @returns ComparisonSummary with deltas for all top-level metrics
 */
export function compareBudgets(
  base: BudgetData,
  target: BudgetData,
): ComparisonSummary {
  const totalAppropriations = createScalarComparison(
    "total-appropriations",
    "Total Appropriations",
    base.metadata.total_appropriations,
    target.metadata.total_appropriations,
  );

  const grossAppropriations = createScalarComparison(
    "gross-appropriations",
    "Gross Appropriations",
    base.metadata.gross_appropriations,
    target.metadata.gross_appropriations,
  );

  // Revenue comparison: null if either year lacks revenue data
  const baseRevenue = base.metadata.total_revenue;
  const targetRevenue = target.metadata.total_revenue;
  const totalRevenue =
    baseRevenue !== null && targetRevenue !== null
      ? createScalarComparison(
          "total-revenue",
          "Total Revenue",
          baseRevenue,
          targetRevenue,
        )
      : null;

  // Operating appropriations: null if either year lacks it
  const baseOperating = base.metadata.operating_appropriations;
  const targetOperating = target.metadata.operating_appropriations;
  const operatingAppropriations =
    baseOperating !== null && targetOperating !== null
      ? createScalarComparison(
          "operating-appropriations",
          "Operating Appropriations",
          baseOperating,
          targetOperating,
        )
      : null;

  // Fund category breakdown comparison (full outer join on category keys)
  const baseCategories = base.metadata.fund_category_breakdown;
  const targetCategories = target.metadata.fund_category_breakdown;
  const allCategoryKeys = new Set([
    ...Object.keys(baseCategories),
    ...Object.keys(targetCategories),
  ]);

  const fundCategoryBreakdown: ComparisonItem[] = Array.from(allCategoryKeys)
    .sort()
    .map((key) => {
      const baseAmt =
        key in baseCategories ? baseCategories[key]! : null;
      const targetAmt =
        key in targetCategories ? targetCategories[key]! : null;
      const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
      return createScalarComparison(`fund-${key}`, label, baseAmt, targetAmt);
    });

  return {
    baseYear: base.metadata.fiscal_year,
    targetYear: target.metadata.fiscal_year,
    baseYearLabel: base.metadata.fiscal_year_label,
    targetYearLabel: target.metadata.fiscal_year_label,
    totalAppropriations,
    grossAppropriations,
    totalRevenue,
    operatingAppropriations,
    fundCategoryBreakdown,
  };
}

/**
 * Compare departments between two years, matched by stable `code` (full outer join).
 *
 * Department names can change across years (e.g. "Fire Department" → "Chicago Fire
 * Department"), but the government department code remains stable. Matching by code
 * ensures renamed departments are correctly identified as the same entity.
 *
 * @param base - Base year budget data
 * @param target - Target year budget data
 * @returns ComparisonItems for all departments across both years, with `id` set to the department code
 */
export function compareDepartments(
  base: BudgetData,
  target: BudgetData,
): ComparisonItem[] {
  const baseDepts = base.appropriations.by_department;
  const targetDepts = target.appropriations.by_department;

  const baseMap = new Map(baseDepts.map((d) => [d.code, d]));
  const targetMap = new Map(targetDepts.map((d) => [d.code, d]));

  const allCodes = new Set([...baseMap.keys(), ...targetMap.keys()]);
  const results: ComparisonItem[] = [];

  for (const code of allCodes) {
    const baseDept = baseMap.get(code);
    const targetDept = targetMap.get(code);

    const baseAmount = baseDept?.amount ?? null;
    const targetAmount = targetDept?.amount ?? null;

    // Prefer target year name (more current), fall back to base year
    const name = targetDept?.name ?? baseDept?.name ?? code;

    const bothPresent = baseAmount !== null && targetAmount !== null;
    const delta = bothPresent ? targetAmount - baseAmount : null;
    const deltaPct = computeDeltaPct(baseAmount, targetAmount);

    let status: ComparisonItem["status"] = "common";
    if (!baseDept) status = "added";
    if (!targetDept) status = "removed";

    results.push({ id: code, name, baseAmount, targetAmount, delta, deltaPct, status });
  }

  return results;
}

/**
 * Compare subcategories within a department between two years.
 *
 * @param baseDept - Base year department (undefined if department is new)
 * @param targetDept - Target year department (undefined if department was removed)
 * @returns ComparisonItems for all subcategories across both departments
 */
export function compareSubcategories(
  baseDept: Department | undefined,
  targetDept: Department | undefined,
): ComparisonItem[] {
  const baseSubs = baseDept?.subcategories ?? [];
  const targetSubs = targetDept?.subcategories ?? [];

  const baseMap = new Map(baseSubs.map((s) => [s.id, s]));
  const targetMap = new Map(targetSubs.map((s) => [s.id, s]));

  const allIds = new Set([...baseMap.keys(), ...targetMap.keys()]);
  const results: ComparisonItem[] = [];

  for (const id of allIds) {
    const baseSub = baseMap.get(id);
    const targetSub = targetMap.get(id);

    const baseAmount = baseSub?.amount ?? null;
    const targetAmount = targetSub?.amount ?? null;
    const name = targetSub?.name ?? baseSub?.name ?? id;

    const bothPresent = baseAmount !== null && targetAmount !== null;
    const delta = bothPresent ? targetAmount - baseAmount : null;
    const deltaPct = computeDeltaPct(baseAmount, targetAmount);

    let status: ComparisonItem["status"] = "common";
    if (!baseSub) status = "added";
    if (!targetSub) status = "removed";

    results.push({ id, name, baseAmount, targetAmount, delta, deltaPct, status });
  }

  return results;
}

/**
 * Compare revenue sources between two years, matched by ID.
 *
 * @param base - Base year budget data
 * @param target - Target year budget data
 * @returns ComparisonItems for all revenue sources, or null if revenue missing in either year
 */
export function compareRevenueSources(
  base: BudgetData,
  target: BudgetData,
): ComparisonItem[] | null {
  if (!base.revenue || !target.revenue) return null;

  const baseSources = base.revenue.by_source;
  const targetSources = target.revenue.by_source;

  const baseMap = new Map(baseSources.map((s) => [s.id, s]));
  const targetMap = new Map(targetSources.map((s) => [s.id, s]));

  const allIds = new Set([...baseMap.keys(), ...targetMap.keys()]);
  const results: ComparisonItem[] = [];

  for (const id of allIds) {
    const baseSrc = baseMap.get(id);
    const targetSrc = targetMap.get(id);

    const baseAmount = baseSrc?.amount ?? null;
    const targetAmount = targetSrc?.amount ?? null;
    const name = targetSrc?.name ?? baseSrc?.name ?? id;

    const bothPresent = baseAmount !== null && targetAmount !== null;
    const delta = bothPresent ? targetAmount - baseAmount : null;
    const deltaPct = computeDeltaPct(baseAmount, targetAmount);

    let status: ComparisonItem["status"] = "common";
    if (!baseSrc) status = "added";
    if (!targetSrc) status = "removed";

    results.push({ id, name, baseAmount, targetAmount, delta, deltaPct, status });
  }

  return results;
}

/**
 * Get the revenue type for a revenue source by looking it up in either year's data.
 * Returns the type from the target year if available, otherwise from the base year.
 *
 * @param sourceId - Revenue source ID
 * @param base - Base year budget data
 * @param target - Target year budget data
 * @returns Revenue type string, or "other" if not found
 */
export function getRevenueSourceType(
  sourceId: string,
  base: BudgetData,
  target: BudgetData,
): string {
  const targetSrc = target.revenue?.by_source.find((s) => s.id === sourceId);
  if (targetSrc) return targetSrc.revenue_type || "other";

  const baseSrc = base.revenue?.by_source.find((s) => s.id === sourceId);
  if (baseSrc) return baseSrc.revenue_type || "other";

  return "other";
}

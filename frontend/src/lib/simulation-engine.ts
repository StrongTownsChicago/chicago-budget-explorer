/**
 * Pure function simulation engine for subcategory-level budget adjustments.
 *
 * All functions are pure (no side effects) for easy testing and reasoning.
 * Adjustments are tracked per subcategory (individual line items within
 * departments and revenue sources). Revenue and expense subcategory IDs
 * are namespaced (dept-* vs revenue-*) so they coexist in one adjustments map.
 */

import type {
  BudgetData,
  Department,
  RevenueSource,
  SimulationState,
  Subcategory,
} from "./types";

/**
 * Find the parent department for a given subcategory ID.
 *
 * @param departments - List of all departments
 * @param subcategoryId - Subcategory ID to find parent for
 * @returns Parent department, or undefined if not found
 */
function findParentDepartment(
  departments: Department[],
  subcategoryId: string
): Department | undefined {
  return departments.find((dept) =>
    dept.subcategories.some((sub) => sub.id === subcategoryId)
  );
}

/**
 * Create initial simulation state with all subcategories at 1.0x (100%).
 * Initializes both expense and revenue subcategory adjustments.
 *
 * @param data - BudgetData to initialize from
 * @returns Initial simulation state
 */
export function createSimulation(data: BudgetData): SimulationState {
  const adjustments: Record<string, number> = {};

  // Initialize expense subcategory adjustments
  for (const dept of data.appropriations.by_department) {
    for (const sub of dept.subcategories) {
      adjustments[sub.id] = 1.0;
    }
  }

  // Initialize revenue subcategory adjustments (if revenue data exists)
  const revenueSources = data.revenue?.by_source ?? [];
  for (const source of revenueSources) {
    for (const sub of source.subcategories) {
      adjustments[sub.id] = 1.0;
    }
  }

  const totalRevenue = data.revenue?.total_revenue ?? 0;
  const untrackedRevenue = data.revenue?.grant_revenue_estimated ?? 0;

  return {
    adjustments,
    totalBudget: data.metadata.total_appropriations,
    originalBudget: data.metadata.total_appropriations,
    totalRevenue,
    originalRevenue: totalRevenue,
    untrackedRevenue,
  };
}

/**
 * Adjust a subcategory's budget multiplier (expense side).
 *
 * Finds the parent department to enforce its simulation constraints (min/max).
 * Returns a new state object (immutable update). Preserves revenue state fields.
 *
 * @param state - Current simulation state
 * @param departments - List of all departments
 * @param subcategoryId - Subcategory ID to adjust
 * @param multiplier - New multiplier (e.g., 1.2 for +20%)
 * @returns New simulation state
 */
export function adjustSubcategory(
  state: SimulationState,
  departments: Department[],
  subcategoryId: string,
  multiplier: number
): SimulationState {
  const parentDept = findParentDepartment(departments, subcategoryId);

  // If subcategory not found or parent not adjustable, return unchanged
  if (!parentDept || !parentDept.simulation.adjustable) {
    return state;
  }

  // Clamp multiplier to parent department's min/max constraints
  const clamped = Math.max(
    parentDept.simulation.min_pct,
    Math.min(parentDept.simulation.max_pct, multiplier)
  );

  // Create new adjustments object with updated multiplier
  const newAdjustments = { ...state.adjustments, [subcategoryId]: clamped };

  // Recalculate total budget by summing all subcategories across all departments
  const newTotal = departments.reduce((sum, dept) => {
    return (
      sum +
      dept.subcategories.reduce((deptSum, sub) => {
        const subMultiplier = newAdjustments[sub.id] ?? 1.0;
        return deptSum + Math.round(sub.amount * subMultiplier);
      }, 0)
    );
  }, 0);

  return {
    ...state,
    adjustments: newAdjustments,
    totalBudget: newTotal,
  };
}

/**
 * Adjust a revenue subcategory's multiplier.
 *
 * Similar to adjustSubcategory but for revenue sources. All revenue sources
 * are adjustable with configurable min/max bounds (defaulting to 0.5-1.5).
 *
 * @param state - Current simulation state
 * @param revenueSources - List of all revenue sources
 * @param subcategoryId - Revenue subcategory ID to adjust
 * @param multiplier - New multiplier
 * @param minPct - Minimum allowed multiplier (default: 0.5)
 * @param maxPct - Maximum allowed multiplier (default: 1.5)
 * @returns New simulation state
 */
export function adjustRevenueSubcategory(
  state: SimulationState,
  revenueSources: RevenueSource[],
  subcategoryId: string,
  multiplier: number,
  minPct: number = 0.5,
  maxPct: number = 1.5
): SimulationState {
  // Find parent revenue source
  const parentSource = revenueSources.find((src) =>
    src.subcategories.some((sub) => sub.id === subcategoryId)
  );
  if (!parentSource) return state;

  const clamped = Math.max(minPct, Math.min(maxPct, multiplier));
  const newAdjustments = { ...state.adjustments, [subcategoryId]: clamped };

  // Recalculate total revenue from all revenue subcategories
  const newTotalRevenue = revenueSources.reduce((sum, src) => {
    return (
      sum +
      src.subcategories.reduce((srcSum, sub) => {
        const subMultiplier = newAdjustments[sub.id] ?? 1.0;
        return srcSum + Math.round(sub.amount * subMultiplier);
      }, 0)
    );
  }, 0);

  return {
    ...state,
    adjustments: newAdjustments,
    totalRevenue: newTotalRevenue,
  };
}

/**
 * Get adjusted amount for a subcategory.
 *
 * @param subcategory - Subcategory to get adjusted amount for
 * @param state - Current simulation state
 * @returns Adjusted dollar amount
 */
export function getAdjustedSubcategoryAmount(
  subcategory: Subcategory,
  state: SimulationState
): number {
  const multiplier = state.adjustments[subcategory.id] ?? 1.0;
  return Math.round(subcategory.amount * multiplier);
}

/**
 * Get adjusted total for an entire department (sum of its adjusted subcategories).
 *
 * @param dept - Department to total
 * @param state - Current simulation state
 * @returns Adjusted dollar total for the department
 */
export function getAdjustedDepartmentTotal(
  dept: Department,
  state: SimulationState
): number {
  return dept.subcategories.reduce((sum, sub) => {
    return sum + getAdjustedSubcategoryAmount(sub, state);
  }, 0);
}

/**
 * Get adjusted total for a revenue source (sum of its adjusted subcategories).
 *
 * @param source - Revenue source to total
 * @param state - Current simulation state
 * @returns Adjusted dollar total for the revenue source
 */
export function getAdjustedRevenueSourceTotal(
  source: RevenueSource,
  state: SimulationState
): number {
  return source.subcategories.reduce((sum, sub) => {
    const multiplier = state.adjustments[sub.id] ?? 1.0;
    return sum + Math.round(sub.amount * multiplier);
  }, 0);
}

/**
 * Get the revenue-vs-expense balance.
 * Positive = surplus, negative = deficit.
 *
 * @param state - Simulation state
 * @returns Dollar balance (revenue + untracked - expenses)
 */
export function getRevenueExpenseBalance(state: SimulationState): number {
  return state.totalRevenue + state.untrackedRevenue - state.totalBudget;
}

/**
 * Get budget delta (difference from original expenses).
 *
 * @param state - Simulation state
 * @returns Dollar amount over/under original budget
 */
export function getBudgetDelta(state: SimulationState): number {
  return state.totalBudget - state.originalBudget;
}

/**
 * Get budget delta as percentage.
 *
 * @param state - Simulation state
 * @returns Percentage over/under original budget
 */
export function getDeltaPercent(state: SimulationState): number {
  if (state.originalBudget === 0) return 0;
  return (
    ((state.totalBudget - state.originalBudget) / state.originalBudget) * 100
  );
}

/**
 * Check if budget is balanced (within tolerance).
 *
 * @param state - Simulation state
 * @param tolerance - Dollar tolerance (default: $1,000)
 * @returns True if balanced, false if over/under by more than tolerance
 */
export function isBalanced(
  state: SimulationState,
  tolerance: number = 1000
): boolean {
  return Math.abs(getBudgetDelta(state)) <= tolerance;
}

/**
 * Get expense subcategories that have been adjusted (not at 1.0x),
 * with their parent department context.
 *
 * @param state - Simulation state
 * @param departments - List of all departments
 * @returns List of adjusted subcategories with department context
 */
export function getAdjustedSubcategories(
  state: SimulationState,
  departments: Department[]
): Array<{ subcategory: Subcategory; department: Department }> {
  const results: Array<{ subcategory: Subcategory; department: Department }> =
    [];

  for (const dept of departments) {
    for (const sub of dept.subcategories) {
      const multiplier = state.adjustments[sub.id] ?? 1.0;
      if (Math.abs(multiplier - 1.0) > 0.001) {
        results.push({ subcategory: sub, department: dept });
      }
    }
  }

  return results;
}

/**
 * Get revenue subcategories that have been adjusted (not at 1.0x),
 * with their parent revenue source context.
 *
 * @param state - Simulation state
 * @param revenueSources - List of all revenue sources
 * @returns List of adjusted subcategories with source context
 */
export function getAdjustedRevenueSources(
  state: SimulationState,
  revenueSources: RevenueSource[]
): Array<{ subcategory: Subcategory; source: RevenueSource }> {
  const results: Array<{ subcategory: Subcategory; source: RevenueSource }> =
    [];

  for (const source of revenueSources) {
    for (const sub of source.subcategories) {
      const multiplier = state.adjustments[sub.id] ?? 1.0;
      if (Math.abs(multiplier - 1.0) > 0.001) {
        results.push({ subcategory: sub, source });
      }
    }
  }

  return results;
}

/**
 * Reset all adjustments to 1.0x.
 *
 * @param data - BudgetData to reset to
 * @returns New simulation state with all multipliers at 1.0
 */
export function resetSimulation(data: BudgetData): SimulationState {
  return createSimulation(data);
}

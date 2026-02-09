/**
 * Pure function simulation engine for subcategory-level budget adjustments.
 *
 * All functions are pure (no side effects) for easy testing and reasoning.
 * Adjustments are tracked per subcategory (individual line items within departments).
 */

import type {
  BudgetData,
  Department,
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
 *
 * @param data - BudgetData to initialize from
 * @returns Initial simulation state
 */
export function createSimulation(data: BudgetData): SimulationState {
  const adjustments: Record<string, number> = {};

  for (const dept of data.appropriations.by_department) {
    for (const sub of dept.subcategories) {
      adjustments[sub.id] = 1.0; // 100% (no change)
    }
  }

  return {
    adjustments,
    totalBudget: data.metadata.total_appropriations,
    originalBudget: data.metadata.total_appropriations,
  };
}

/**
 * Adjust a subcategory's budget multiplier.
 *
 * Finds the parent department to enforce its simulation constraints (min/max).
 * Returns a new state object (immutable update).
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
    adjustments: newAdjustments,
    totalBudget: newTotal,
    originalBudget: state.originalBudget,
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
 * Get budget delta (difference from original).
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
 * Get subcategories that have been adjusted (not at 1.0x), with their parent department context.
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
 * Reset all adjustments to 1.0x.
 *
 * @param data - BudgetData to reset to
 * @returns New simulation state with all multipliers at 1.0
 */
export function resetSimulation(data: BudgetData): SimulationState {
  return createSimulation(data);
}

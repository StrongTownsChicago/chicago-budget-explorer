/**
 * Pure function simulation engine for budget adjustments.
 *
 * All functions are pure (no side effects) for easy testing and reasoning.
 */

import type { BudgetData, Department, SimulationState } from "./types";

/**
 * Create initial simulation state with all departments at 1.0x (100%).
 *
 * @param data - BudgetData to initialize from
 * @returns Initial simulation state
 */
export function createSimulation(data: BudgetData): SimulationState {
  const adjustments: Record<string, number> = {};

  for (const dept of data.appropriations.by_department) {
    adjustments[dept.id] = 1.0; // 100% (no change)
  }

  return {
    adjustments,
    totalBudget: data.metadata.total_appropriations,
    originalBudget: data.metadata.total_appropriations,
  };
}

/**
 * Adjust a department's budget multiplier.
 *
 * Returns a new state object (immutable update).
 *
 * @param state - Current simulation state
 * @param departments - List of all departments
 * @param deptId - Department ID to adjust
 * @param multiplier - New multiplier (e.g., 1.2 for +20%)
 * @returns New simulation state
 */
export function adjustDepartment(
  state: SimulationState,
  departments: Department[],
  deptId: string,
  multiplier: number
): SimulationState {
  const dept = departments.find((d) => d.id === deptId);

  // If department not found or not adjustable, return unchanged
  if (!dept || !dept.simulation.adjustable) {
    return state;
  }

  // Clamp multiplier to min/max constraints
  const clamped = Math.max(
    dept.simulation.min_pct,
    Math.min(dept.simulation.max_pct, multiplier)
  );

  // Create new adjustments object with updated multiplier
  const newAdjustments = { ...state.adjustments, [deptId]: clamped };

  // Recalculate total budget
  const newTotal = departments.reduce((sum, d) => {
    const multiplier = newAdjustments[d.id] ?? 1.0;
    return sum + Math.round(d.amount * multiplier);
  }, 0);

  return {
    adjustments: newAdjustments,
    totalBudget: newTotal,
    originalBudget: state.originalBudget,
  };
}

/**
 * Get adjusted amount for a department.
 *
 * @param dept - Department to get adjusted amount for
 * @param state - Current simulation state
 * @returns Adjusted dollar amount
 */
export function getAdjustedAmount(
  dept: Department,
  state: SimulationState
): number {
  const multiplier = state.adjustments[dept.id] ?? 1.0;
  return Math.round(dept.amount * multiplier);
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
  return ((state.totalBudget - state.originalBudget) / state.originalBudget) * 100;
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
 * Get departments that have been adjusted (not at 1.0x).
 *
 * @param state - Simulation state
 * @param departments - List of all departments
 * @returns List of departments with non-1.0 multipliers
 */
export function getAdjustedDepartments(
  state: SimulationState,
  departments: Department[]
): Department[] {
  return departments.filter((dept) => {
    const multiplier = state.adjustments[dept.id] ?? 1.0;
    return Math.abs(multiplier - 1.0) > 0.001; // Accounting for floating point precision
  });
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

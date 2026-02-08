/**
 * Tests for simulation engine.
 */

import { describe, it, expect } from "vitest";
import {
  createSimulation,
  adjustDepartment,
  getAdjustedAmount,
  getBudgetDelta,
  getDeltaPercent,
  isBalanced,
  getAdjustedDepartments,
  resetSimulation,
} from "../simulation-engine";
import type { BudgetData, Department } from "../types";

// Test data fixtures
const createMockDepartment = (
  id: string,
  amount: number,
  adjustable: boolean = true,
  min_pct: number = 0.5,
  max_pct: number = 1.5
): Department => ({
  id,
  name: id.replace("dept-", ""),
  code: "000",
  amount,
  prior_year_amount: null,
  change_pct: null,
  fund_breakdown: [],
  subcategories: [],
  simulation: {
    adjustable,
    min_pct,
    max_pct,
    step_pct: 0.01,
    constraints: [],
    description: "Test department",
  },
});

const createMockBudgetData = (departments: Department[]): BudgetData => ({
  metadata: {
    entity_id: "test",
    entity_name: "Test Entity",
    fiscal_year: "fy2025",
    fiscal_year_label: "FY2025",
    fiscal_year_start: "2025-01-01",
    fiscal_year_end: "2025-12-31",
    gross_appropriations: departments.reduce((sum, d) => sum + d.amount, 0),
    accounting_adjustments: 0,
    total_appropriations: departments.reduce((sum, d) => sum + d.amount, 0),
    operating_appropriations: null,
    fund_category_breakdown: {},
    total_revenue: null,
    revenue_surplus_deficit: null,
    data_source: "test",
    source_dataset_id: "test",
    extraction_date: "2025-01-01",
    pipeline_version: "1.0.0",
    notes: null,
  },
  appropriations: {
    by_department: departments,
    by_fund: [],
  },
  schema_version: "1.0.0",
});

describe("createSimulation", () => {
  it("initializes all departments at 1.0x multiplier", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_000_000_000),
      createMockDepartment("dept-fire", 1_000_000_000),
    ]);

    const state = createSimulation(data);

    expect(state.adjustments["dept-police"]).toBe(1.0);
    expect(state.adjustments["dept-fire"]).toBe(1.0);
  });

  it("sets total budget equal to original budget", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_000_000_000),
      createMockDepartment("dept-fire", 1_000_000_000),
    ]);

    const state = createSimulation(data);

    expect(state.totalBudget).toBe(3_000_000_000);
    expect(state.originalBudget).toBe(3_000_000_000);
  });
});

describe("adjustDepartment", () => {
  it("adjusts department multiplier", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_000_000_000),
      createMockDepartment("dept-fire", 1_000_000_000),
    ]);

    const state = createSimulation(data);
    const newState = adjustDepartment(
      state,
      data.appropriations.by_department,
      "dept-police",
      1.2
    );

    expect(newState.adjustments["dept-police"]).toBe(1.2);
    expect(newState.adjustments["dept-fire"]).toBe(1.0); // Unchanged
  });

  it("recalculates total budget after adjustment", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_000_000_000),
      createMockDepartment("dept-fire", 1_000_000_000),
    ]);

    const state = createSimulation(data);
    const newState = adjustDepartment(
      state,
      data.appropriations.by_department,
      "dept-police",
      1.2
    );

    // Police: 2B * 1.2 = 2.4B
    // Fire: 1B * 1.0 = 1B
    // Total: 3.4B
    expect(newState.totalBudget).toBe(3_400_000_000);
  });

  it("clamps multiplier to min constraint", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_000_000_000, true, 0.5, 1.5),
    ]);

    const state = createSimulation(data);
    const newState = adjustDepartment(
      state,
      data.appropriations.by_department,
      "dept-police",
      0.3 // Below min
    );

    expect(newState.adjustments["dept-police"]).toBe(0.5); // Clamped to min
  });

  it("clamps multiplier to max constraint", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_000_000_000, true, 0.5, 1.5),
    ]);

    const state = createSimulation(data);
    const newState = adjustDepartment(
      state,
      data.appropriations.by_department,
      "dept-police",
      2.0 // Above max
    );

    expect(newState.adjustments["dept-police"]).toBe(1.5); // Clamped to max
  });

  it("ignores adjustment for non-adjustable departments", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-finance", 500_000_000, false, 1.0, 1.0),
    ]);

    const state = createSimulation(data);
    const newState = adjustDepartment(
      state,
      data.appropriations.by_department,
      "dept-finance",
      1.5 // Try to adjust
    );

    expect(newState.adjustments["dept-finance"]).toBe(1.0); // Unchanged
    expect(newState.totalBudget).toBe(500_000_000); // Unchanged
  });

  it("ignores adjustment for non-existent department", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_000_000_000),
    ]);

    const state = createSimulation(data);
    const newState = adjustDepartment(
      state,
      data.appropriations.by_department,
      "dept-nonexistent",
      1.5
    );

    expect(newState).toEqual(state); // State unchanged
  });

  it("returns new state object (immutable)", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_000_000_000),
    ]);

    const state = createSimulation(data);
    const newState = adjustDepartment(
      state,
      data.appropriations.by_department,
      "dept-police",
      1.2
    );

    expect(newState).not.toBe(state); // Different objects
    expect(state.adjustments["dept-police"]).toBe(1.0); // Original unchanged
  });
});

describe("getAdjustedAmount", () => {
  it("returns adjusted amount for department", () => {
    const dept = createMockDepartment("dept-police", 2_000_000_000);
    const state = {
      adjustments: { "dept-police": 1.2 },
      totalBudget: 2_400_000_000,
      originalBudget: 2_000_000_000,
    };

    const adjusted = getAdjustedAmount(dept, state);
    expect(adjusted).toBe(2_400_000_000);
  });

  it("defaults to 1.0x if department not in adjustments", () => {
    const dept = createMockDepartment("dept-police", 2_000_000_000);
    const state = {
      adjustments: {},
      totalBudget: 2_000_000_000,
      originalBudget: 2_000_000_000,
    };

    const adjusted = getAdjustedAmount(dept, state);
    expect(adjusted).toBe(2_000_000_000);
  });

  it("rounds result to nearest dollar", () => {
    const dept = createMockDepartment("dept-police", 1_000_000);
    const state = {
      adjustments: { "dept-police": 1.33333 },
      totalBudget: 0,
      originalBudget: 0,
    };

    const adjusted = getAdjustedAmount(dept, state);
    expect(adjusted).toBe(1_333_330); // Rounded
  });
});

describe("getBudgetDelta", () => {
  it("returns zero for balanced budget", () => {
    const state = {
      adjustments: {},
      totalBudget: 3_000_000_000,
      originalBudget: 3_000_000_000,
    };

    expect(getBudgetDelta(state)).toBe(0);
  });

  it("returns positive delta for over budget", () => {
    const state = {
      adjustments: {},
      totalBudget: 3_500_000_000,
      originalBudget: 3_000_000_000,
    };

    expect(getBudgetDelta(state)).toBe(500_000_000);
  });

  it("returns negative delta for under budget", () => {
    const state = {
      adjustments: {},
      totalBudget: 2_500_000_000,
      originalBudget: 3_000_000_000,
    };

    expect(getBudgetDelta(state)).toBe(-500_000_000);
  });
});

describe("getDeltaPercent", () => {
  it("returns zero for balanced budget", () => {
    const state = {
      adjustments: {},
      totalBudget: 3_000_000_000,
      originalBudget: 3_000_000_000,
    };

    expect(getDeltaPercent(state)).toBe(0);
  });

  it("returns positive percentage for over budget", () => {
    const state = {
      adjustments: {},
      totalBudget: 3_300_000_000,
      originalBudget: 3_000_000_000,
    };

    expect(getDeltaPercent(state)).toBeCloseTo(10.0);
  });

  it("returns negative percentage for under budget", () => {
    const state = {
      adjustments: {},
      totalBudget: 2_700_000_000,
      originalBudget: 3_000_000_000,
    };

    expect(getDeltaPercent(state)).toBeCloseTo(-10.0);
  });

  it("handles zero original budget", () => {
    const state = {
      adjustments: {},
      totalBudget: 1_000_000_000,
      originalBudget: 0,
    };

    expect(getDeltaPercent(state)).toBe(0);
  });
});

describe("isBalanced", () => {
  it("returns true for exactly balanced budget", () => {
    const state = {
      adjustments: {},
      totalBudget: 3_000_000_000,
      originalBudget: 3_000_000_000,
    };

    expect(isBalanced(state)).toBe(true);
  });

  it("returns true for delta within tolerance", () => {
    const state = {
      adjustments: {},
      totalBudget: 3_000_000_500,
      originalBudget: 3_000_000_000,
    };

    expect(isBalanced(state, 1000)).toBe(true);
  });

  it("returns false for delta outside tolerance", () => {
    const state = {
      adjustments: {},
      totalBudget: 3_000_010_000,
      originalBudget: 3_000_000_000,
    };

    expect(isBalanced(state, 1000)).toBe(false);
  });

  it("uses default tolerance of $1000", () => {
    const state = {
      adjustments: {},
      totalBudget: 3_000_000_500,
      originalBudget: 3_000_000_000,
    };

    expect(isBalanced(state)).toBe(true);
  });
});

describe("getAdjustedDepartments", () => {
  it("returns departments with non-1.0 multipliers", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_000_000_000),
      createMockDepartment("dept-fire", 1_000_000_000),
      createMockDepartment("dept-streets", 500_000_000),
    ]);

    const state = {
      adjustments: {
        "dept-police": 1.2,
        "dept-fire": 1.0,
        "dept-streets": 0.8,
      },
      totalBudget: 0,
      originalBudget: 0,
    };

    const adjusted = getAdjustedDepartments(state, data.appropriations.by_department);

    expect(adjusted).toHaveLength(2);
    expect(adjusted.find((d) => d.id === "dept-police")).toBeDefined();
    expect(adjusted.find((d) => d.id === "dept-streets")).toBeDefined();
    expect(adjusted.find((d) => d.id === "dept-fire")).toBeUndefined();
  });

  it("returns empty array if no adjustments", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_000_000_000),
    ]);

    const state = {
      adjustments: { "dept-police": 1.0 },
      totalBudget: 0,
      originalBudget: 0,
    };

    const adjusted = getAdjustedDepartments(state, data.appropriations.by_department);
    expect(adjusted).toHaveLength(0);
  });

  it("handles floating point precision", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_000_000_000),
    ]);

    const state = {
      adjustments: { "dept-police": 1.0001 }, // Very small difference
      totalBudget: 0,
      originalBudget: 0,
    };

    const adjusted = getAdjustedDepartments(state, data.appropriations.by_department);
    expect(adjusted).toHaveLength(0); // Should be treated as 1.0
  });
});

describe("resetSimulation", () => {
  it("resets all adjustments to 1.0", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_000_000_000),
      createMockDepartment("dept-fire", 1_000_000_000),
    ]);

    const resetState = resetSimulation(data);

    expect(resetState.adjustments["dept-police"]).toBe(1.0);
    expect(resetState.adjustments["dept-fire"]).toBe(1.0);
    expect(resetState.totalBudget).toBe(3_000_000_000);
    expect(resetState.originalBudget).toBe(3_000_000_000);
  });

  it("returns same structure as createSimulation", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_000_000_000),
    ]);

    const initialState = createSimulation(data);
    const resetState = resetSimulation(data);

    expect(resetState).toEqual(initialState);
  });
});

/**
 * Tests for subcategory-level simulation engine (expenses + revenue).
 */

import { describe, it, expect } from "vitest";
import {
  createSimulation,
  adjustSubcategory,
  adjustRevenueSubcategory,
  getAdjustedSubcategoryAmount,
  getAdjustedDepartmentTotal,
  getAdjustedRevenueSourceTotal,
  getRevenueExpenseBalance,
  getBudgetDelta,
  getDeltaPercent,
  isBalanced,
  getAdjustedSubcategories,
  getAdjustedRevenueSources,
  resetSimulation,
} from "../simulation-engine";
import type {
  BudgetData,
  Department,
  RevenueSource,
  SimulationState,
} from "../types";

// ── Test data fixtures ──────────────────────────────────────────────────

/** Helper: default revenue fields for inline SimulationState objects. */
const defaultRevenueState = {
  totalRevenue: 0,
  originalRevenue: 0,
  untrackedRevenue: 0,
};

/**
 * Create a mock department with generated subcategories.
 * Amount is split evenly across subcategories (last gets remainder).
 */
const createMockDepartment = (
  id: string,
  amount: number,
  adjustable: boolean = true,
  min_pct: number = 0.5,
  max_pct: number = 1.5,
  subcategoryCount: number = 3,
): Department => {
  const subcategories = [];
  const baseAmount = Math.floor(amount / Math.max(subcategoryCount, 1));
  for (let i = 0; i < subcategoryCount; i++) {
    const isLast = i === subcategoryCount - 1;
    subcategories.push({
      id: `${id}-subcat-${i}`,
      name: `Subcat ${i}`,
      amount: isLast ? amount - baseAmount * (subcategoryCount - 1) : baseAmount,
    });
  }

  return {
    id,
    name: id.replace("dept-", ""),
    code: "000",
    amount,
    prior_year_amount: null,
    change_pct: null,
    fund_breakdown: [],
    subcategories,
    simulation: {
      adjustable,
      min_pct,
      max_pct,
      step_pct: 0.01,
      constraints: [],
      description: "Test department",
    },
  };
};

/**
 * Create a mock revenue source with generated subcategories.
 * Amount is split evenly across subcategories (last gets remainder).
 */
const createMockRevenueSource = (
  id: string,
  amount: number,
  subcategoryCount: number = 2,
): RevenueSource => {
  const subcategories = [];
  const baseAmount = Math.floor(amount / Math.max(subcategoryCount, 1));
  for (let i = 0; i < subcategoryCount; i++) {
    const isLast = i === subcategoryCount - 1;
    subcategories.push({
      id: `${id}-subcat-${i}`,
      name: `Revenue Subcat ${i}`,
      amount: isLast ? amount - baseAmount * (subcategoryCount - 1) : baseAmount,
    });
  }

  return {
    id,
    name: id.replace("revenue-", ""),
    amount,
    revenue_type: "tax",
    subcategories,
    fund_breakdown: [],
  };
};

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

const createMockBudgetDataWithRevenue = (
  departments: Department[],
  revenueSources: RevenueSource[],
  grantRevenueEstimated: number | null = null,
): BudgetData => ({
  ...createMockBudgetData(departments),
  revenue: {
    by_source: revenueSources,
    by_fund: [],
    total_revenue: revenueSources.reduce((sum, s) => sum + s.amount, 0),
    local_revenue_only: true,
    grant_revenue_estimated: grantRevenueEstimated,
  },
});

// ── Existing expense simulation tests ───────────────────────────────────

describe("createSimulation", () => {
  it("initializes all subcategories at 1.0x multiplier", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_000_000_000),
      createMockDepartment("dept-fire", 1_000_000_000),
    ]);

    const state = createSimulation(data);

    // All 6 subcategory IDs should be in adjustments at 1.0
    expect(Object.keys(state.adjustments)).toHaveLength(6);
    expect(state.adjustments["dept-police-subcat-0"]).toBe(1.0);
    expect(state.adjustments["dept-police-subcat-1"]).toBe(1.0);
    expect(state.adjustments["dept-police-subcat-2"]).toBe(1.0);
    expect(state.adjustments["dept-fire-subcat-0"]).toBe(1.0);
    expect(state.adjustments["dept-fire-subcat-1"]).toBe(1.0);
    expect(state.adjustments["dept-fire-subcat-2"]).toBe(1.0);

    // No department IDs in adjustments
    expect(state.adjustments["dept-police"]).toBeUndefined();
    expect(state.adjustments["dept-fire"]).toBeUndefined();
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

  it("handles departments with no subcategories", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-empty", 500_000_000, true, 0.5, 1.5, 0),
    ]);

    const state = createSimulation(data);

    expect(Object.keys(state.adjustments)).toHaveLength(0);
    // totalBudget comes from metadata.total_appropriations, not subcategory sum
    expect(state.totalBudget).toBe(500_000_000);
  });
});

describe("adjustSubcategory", () => {
  it("adjusts subcategory multiplier", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_100_000_000),
    ]);

    const state = createSimulation(data);
    const newState = adjustSubcategory(
      state,
      data.appropriations.by_department,
      "dept-police-subcat-0",
      1.2,
    );

    expect(newState.adjustments["dept-police-subcat-0"]).toBe(1.2);
    expect(newState.adjustments["dept-police-subcat-1"]).toBe(1.0); // Unchanged
    expect(newState.adjustments["dept-police-subcat-2"]).toBe(1.0); // Unchanged
  });

  it("recalculates total budget after adjustment", () => {
    // Police: $2B with 2 subcats of $1B each
    // Fire: $1B with 2 subcats of $500M each
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_000_000_000, true, 0.5, 1.5, 2),
      createMockDepartment("dept-fire", 1_000_000_000, true, 0.5, 1.5, 2),
    ]);

    const state = createSimulation(data);
    const newState = adjustSubcategory(
      state,
      data.appropriations.by_department,
      "dept-police-subcat-0",
      1.2,
    );

    // police-subcat-0: $1B * 1.2 = $1.2B
    // police-subcat-1: $1B * 1.0 = $1B
    // fire-subcat-0: $500M * 1.0 = $500M
    // fire-subcat-1: $500M * 1.0 = $500M
    // Total: $3.2B
    expect(newState.totalBudget).toBe(3_200_000_000);
  });

  it("clamps multiplier to min constraint", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_100_000_000, true, 0.5, 1.5),
    ]);

    const state = createSimulation(data);
    const newState = adjustSubcategory(
      state,
      data.appropriations.by_department,
      "dept-police-subcat-0",
      0.3, // Below min
    );

    expect(newState.adjustments["dept-police-subcat-0"]).toBe(0.5); // Clamped to min
  });

  it("clamps multiplier to max constraint", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_100_000_000, true, 0.5, 1.5),
    ]);

    const state = createSimulation(data);
    const newState = adjustSubcategory(
      state,
      data.appropriations.by_department,
      "dept-police-subcat-0",
      2.0, // Above max
    );

    expect(newState.adjustments["dept-police-subcat-0"]).toBe(1.5); // Clamped to max
  });

  it("ignores adjustment for non-adjustable department's subcategory", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-finance", 500_000_000, false, 1.0, 1.0),
    ]);

    const state = createSimulation(data);
    const newState = adjustSubcategory(
      state,
      data.appropriations.by_department,
      "dept-finance-subcat-0",
      1.5,
    );

    expect(newState).toBe(state); // Same object reference (unchanged)
  });

  it("ignores adjustment for non-existent subcategory", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_000_000_000),
    ]);

    const state = createSimulation(data);
    const newState = adjustSubcategory(
      state,
      data.appropriations.by_department,
      "nonexistent-id",
      1.5,
    );

    expect(newState).toBe(state); // Same object reference (unchanged)
  });

  it("returns new state object (immutable)", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_100_000_000),
    ]);

    const state = createSimulation(data);
    const newState = adjustSubcategory(
      state,
      data.appropriations.by_department,
      "dept-police-subcat-0",
      1.2,
    );

    expect(newState).not.toBe(state); // Different objects
    expect(state.adjustments["dept-police-subcat-0"]).toBe(1.0); // Original unchanged
  });

  it("adjusts multiple subcategories in same department independently", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_100_000_000),
    ]);

    const state = createSimulation(data);
    const state2 = adjustSubcategory(
      state,
      data.appropriations.by_department,
      "dept-police-subcat-0",
      1.2,
    );
    const state3 = adjustSubcategory(
      state2,
      data.appropriations.by_department,
      "dept-police-subcat-1",
      0.8,
    );

    expect(state3.adjustments["dept-police-subcat-0"]).toBe(1.2); // Not overwritten
    expect(state3.adjustments["dept-police-subcat-1"]).toBe(0.8);
    expect(state3.adjustments["dept-police-subcat-2"]).toBe(1.0);

    // Verify total reflects both adjustments
    const sub0 = data.appropriations.by_department[0].subcategories[0].amount;
    const sub1 = data.appropriations.by_department[0].subcategories[1].amount;
    const sub2 = data.appropriations.by_department[0].subcategories[2].amount;
    const expectedTotal =
      Math.round(sub0 * 1.2) + Math.round(sub1 * 0.8) + Math.round(sub2 * 1.0);
    expect(state3.totalBudget).toBe(expectedTotal);
  });
});

describe("getAdjustedSubcategoryAmount", () => {
  it("returns adjusted amount for subcategory", () => {
    const subcategory = { id: "test-subcat", name: "Test", amount: 1_000_000_000 };
    const state: SimulationState = {
      adjustments: { "test-subcat": 1.2 },
      totalBudget: 0,
      originalBudget: 0,
      ...defaultRevenueState,
    };

    expect(getAdjustedSubcategoryAmount(subcategory, state)).toBe(1_200_000_000);
  });

  it("defaults to 1.0x if subcategory not in adjustments", () => {
    const subcategory = { id: "test-subcat", name: "Test", amount: 1_000_000_000 };
    const state: SimulationState = {
      adjustments: {},
      totalBudget: 0,
      originalBudget: 0,
      ...defaultRevenueState,
    };

    expect(getAdjustedSubcategoryAmount(subcategory, state)).toBe(1_000_000_000);
  });

  it("rounds result to nearest dollar", () => {
    const subcategory = { id: "test-subcat", name: "Test", amount: 1_000_000 };
    const state: SimulationState = {
      adjustments: { "test-subcat": 1.33333 },
      totalBudget: 0,
      originalBudget: 0,
      ...defaultRevenueState,
    };

    expect(getAdjustedSubcategoryAmount(subcategory, state)).toBe(1_333_330);
  });
});

describe("getAdjustedDepartmentTotal", () => {
  it("sums adjusted subcategories for a department", () => {
    const dept = createMockDepartment("dept-police", 2_000_000_000);
    const state: SimulationState = {
      adjustments: {
        "dept-police-subcat-0": 1.2,
        "dept-police-subcat-1": 1.0,
        "dept-police-subcat-2": 1.0,
      },
      totalBudget: 0,
      originalBudget: 0,
      ...defaultRevenueState,
    };

    const total = getAdjustedDepartmentTotal(dept, state);
    const expected =
      Math.round(dept.subcategories[0].amount * 1.2) +
      dept.subcategories[1].amount +
      dept.subcategories[2].amount;
    expect(total).toBe(expected);
  });

  it("returns original total when no adjustments", () => {
    const dept = createMockDepartment("dept-police", 2_000_000_000);
    const state: SimulationState = {
      adjustments: {
        "dept-police-subcat-0": 1.0,
        "dept-police-subcat-1": 1.0,
        "dept-police-subcat-2": 1.0,
      },
      totalBudget: 0,
      originalBudget: 0,
      ...defaultRevenueState,
    };

    expect(getAdjustedDepartmentTotal(dept, state)).toBe(dept.amount);
  });

  it("handles department with no subcategories", () => {
    const dept = createMockDepartment("dept-empty", 500_000_000, true, 0.5, 1.5, 0);
    const state: SimulationState = {
      adjustments: {},
      totalBudget: 0,
      originalBudget: 0,
      ...defaultRevenueState,
    };

    expect(getAdjustedDepartmentTotal(dept, state)).toBe(0);
  });
});

describe("getAdjustedSubcategories", () => {
  it("returns subcategories with non-1.0 multipliers", () => {
    const departments = [
      createMockDepartment("dept-police", 2_100_000_000),
      createMockDepartment("dept-fire", 1_000_000_000),
    ];

    const state: SimulationState = {
      adjustments: {
        "dept-police-subcat-0": 1.2,
        "dept-police-subcat-1": 1.0,
        "dept-police-subcat-2": 1.0,
        "dept-fire-subcat-0": 0.8,
        "dept-fire-subcat-1": 1.0,
        "dept-fire-subcat-2": 1.0,
      },
      totalBudget: 0,
      originalBudget: 0,
      ...defaultRevenueState,
    };

    const adjusted = getAdjustedSubcategories(state, departments);
    expect(adjusted).toHaveLength(2);
    expect(adjusted[0].subcategory.id).toBe("dept-police-subcat-0");
    expect(adjusted[0].department.id).toBe("dept-police");
    expect(adjusted[1].subcategory.id).toBe("dept-fire-subcat-0");
    expect(adjusted[1].department.id).toBe("dept-fire");
  });

  it("returns empty array if no adjustments", () => {
    const departments = [createMockDepartment("dept-police", 2_000_000_000)];

    const state: SimulationState = {
      adjustments: {
        "dept-police-subcat-0": 1.0,
        "dept-police-subcat-1": 1.0,
        "dept-police-subcat-2": 1.0,
      },
      totalBudget: 0,
      originalBudget: 0,
      ...defaultRevenueState,
    };

    expect(getAdjustedSubcategories(state, departments)).toHaveLength(0);
  });

  it("handles floating point precision", () => {
    const departments = [createMockDepartment("dept-police", 2_000_000_000)];

    const state: SimulationState = {
      adjustments: {
        "dept-police-subcat-0": 1.0001, // Very small difference
        "dept-police-subcat-1": 1.0,
        "dept-police-subcat-2": 1.0,
      },
      totalBudget: 0,
      originalBudget: 0,
      ...defaultRevenueState,
    };

    const adjusted = getAdjustedSubcategories(state, departments);
    expect(adjusted).toHaveLength(0); // Should be treated as 1.0
  });

  it("includes department context", () => {
    const departments = [createMockDepartment("dept-police", 2_100_000_000)];

    const state: SimulationState = {
      adjustments: {
        "dept-police-subcat-0": 1.2,
        "dept-police-subcat-1": 1.0,
        "dept-police-subcat-2": 1.0,
      },
      totalBudget: 0,
      originalBudget: 0,
      ...defaultRevenueState,
    };

    const adjusted = getAdjustedSubcategories(state, departments);
    expect(adjusted).toHaveLength(1);
    expect(adjusted[0].department.name).toBe("police");
    expect(adjusted[0].subcategory.id).toBe("dept-police-subcat-0");
  });
});

describe("getBudgetDelta", () => {
  it("returns zero for balanced budget", () => {
    const state: SimulationState = {
      adjustments: {},
      totalBudget: 3_000_000_000,
      originalBudget: 3_000_000_000,
      ...defaultRevenueState,
    };

    expect(getBudgetDelta(state)).toBe(0);
  });

  it("returns positive delta for over budget", () => {
    const state: SimulationState = {
      adjustments: {},
      totalBudget: 3_500_000_000,
      originalBudget: 3_000_000_000,
      ...defaultRevenueState,
    };

    expect(getBudgetDelta(state)).toBe(500_000_000);
  });

  it("returns negative delta for under budget", () => {
    const state: SimulationState = {
      adjustments: {},
      totalBudget: 2_500_000_000,
      originalBudget: 3_000_000_000,
      ...defaultRevenueState,
    };

    expect(getBudgetDelta(state)).toBe(-500_000_000);
  });
});

describe("getDeltaPercent", () => {
  it("returns zero for balanced budget", () => {
    const state: SimulationState = {
      adjustments: {},
      totalBudget: 3_000_000_000,
      originalBudget: 3_000_000_000,
      ...defaultRevenueState,
    };

    expect(getDeltaPercent(state)).toBe(0);
  });

  it("returns positive percentage for over budget", () => {
    const state: SimulationState = {
      adjustments: {},
      totalBudget: 3_300_000_000,
      originalBudget: 3_000_000_000,
      ...defaultRevenueState,
    };

    expect(getDeltaPercent(state)).toBeCloseTo(10.0);
  });

  it("returns negative percentage for under budget", () => {
    const state: SimulationState = {
      adjustments: {},
      totalBudget: 2_700_000_000,
      originalBudget: 3_000_000_000,
      ...defaultRevenueState,
    };

    expect(getDeltaPercent(state)).toBeCloseTo(-10.0);
  });

  it("handles zero original budget", () => {
    const state: SimulationState = {
      adjustments: {},
      totalBudget: 1_000_000_000,
      originalBudget: 0,
      ...defaultRevenueState,
    };

    expect(getDeltaPercent(state)).toBe(0);
  });
});

describe("isBalanced", () => {
  it("returns true for exactly balanced budget", () => {
    const state: SimulationState = {
      adjustments: {},
      totalBudget: 3_000_000_000,
      originalBudget: 3_000_000_000,
      ...defaultRevenueState,
    };

    expect(isBalanced(state)).toBe(true);
  });

  it("returns true for delta within tolerance", () => {
    const state: SimulationState = {
      adjustments: {},
      totalBudget: 3_000_000_500,
      originalBudget: 3_000_000_000,
      ...defaultRevenueState,
    };

    expect(isBalanced(state, 1000)).toBe(true);
  });

  it("returns false for delta outside tolerance", () => {
    const state: SimulationState = {
      adjustments: {},
      totalBudget: 3_000_010_000,
      originalBudget: 3_000_000_000,
      ...defaultRevenueState,
    };

    expect(isBalanced(state, 1000)).toBe(false);
  });

  it("uses default tolerance of $1000", () => {
    const state: SimulationState = {
      adjustments: {},
      totalBudget: 3_000_000_500,
      originalBudget: 3_000_000_000,
      ...defaultRevenueState,
    };

    expect(isBalanced(state)).toBe(true);
  });
});

describe("resetSimulation", () => {
  it("resets all subcategory adjustments to 1.0", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_000_000_000),
      createMockDepartment("dept-fire", 1_000_000_000),
    ]);

    const resetState = resetSimulation(data);

    expect(resetState.adjustments["dept-police-subcat-0"]).toBe(1.0);
    expect(resetState.adjustments["dept-police-subcat-1"]).toBe(1.0);
    expect(resetState.adjustments["dept-police-subcat-2"]).toBe(1.0);
    expect(resetState.adjustments["dept-fire-subcat-0"]).toBe(1.0);
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

// ── Revenue simulation tests ────────────────────────────────────────────

describe("createSimulation with revenue", () => {
  it("initializes revenue subcategory adjustments at 1.0", () => {
    const data = createMockBudgetDataWithRevenue(
      [createMockDepartment("dept-police", 2_000_000_000)],
      [
        createMockRevenueSource("revenue-property-tax", 1_000_000_000, 3),
        createMockRevenueSource("revenue-sales-tax", 500_000_000, 2),
      ],
    );

    const state = createSimulation(data);

    // 3 dept subcats + 3 revenue subcats + 2 revenue subcats = 8
    expect(Object.keys(state.adjustments)).toHaveLength(8);

    // Revenue subcategories initialized at 1.0
    expect(state.adjustments["revenue-property-tax-subcat-0"]).toBe(1.0);
    expect(state.adjustments["revenue-property-tax-subcat-1"]).toBe(1.0);
    expect(state.adjustments["revenue-property-tax-subcat-2"]).toBe(1.0);
    expect(state.adjustments["revenue-sales-tax-subcat-0"]).toBe(1.0);
    expect(state.adjustments["revenue-sales-tax-subcat-1"]).toBe(1.0);
  });

  it("populates totalRevenue from revenue data", () => {
    const data = createMockBudgetDataWithRevenue(
      [createMockDepartment("dept-police", 2_000_000_000)],
      [createMockRevenueSource("revenue-tax", 5_000_000_000)],
    );

    const state = createSimulation(data);

    expect(state.totalRevenue).toBe(5_000_000_000);
    expect(state.originalRevenue).toBe(5_000_000_000);
  });

  it("populates untrackedRevenue from grant_revenue_estimated", () => {
    const data = createMockBudgetDataWithRevenue(
      [createMockDepartment("dept-police", 2_000_000_000)],
      [createMockRevenueSource("revenue-tax", 5_000_000_000)],
      3_000_000_000,
    );

    const state = createSimulation(data);

    expect(state.untrackedRevenue).toBe(3_000_000_000);
  });

  it("handles null revenue data", () => {
    const data = createMockBudgetData([
      createMockDepartment("dept-police", 2_000_000_000),
    ]);

    const state = createSimulation(data);

    expect(state.totalRevenue).toBe(0);
    expect(state.originalRevenue).toBe(0);
    expect(state.untrackedRevenue).toBe(0);
    // Only department subcategory IDs in adjustments
    expect(Object.keys(state.adjustments)).toHaveLength(3);
  });

  it("handles null grant_revenue_estimated", () => {
    const data = createMockBudgetDataWithRevenue(
      [createMockDepartment("dept-police", 2_000_000_000)],
      [createMockRevenueSource("revenue-tax", 5_000_000_000)],
      null,
    );

    const state = createSimulation(data);

    expect(state.untrackedRevenue).toBe(0);
  });
});

describe("adjustRevenueSubcategory", () => {
  const revenueSources = [
    createMockRevenueSource("revenue-property-tax", 1_000_000_000, 2),
    createMockRevenueSource("revenue-sales-tax", 500_000_000, 2),
  ];

  it("adjusts revenue subcategory multiplier", () => {
    const data = createMockBudgetDataWithRevenue(
      [createMockDepartment("dept-police", 2_000_000_000)],
      revenueSources,
    );
    const state = createSimulation(data);

    const newState = adjustRevenueSubcategory(
      state,
      revenueSources,
      "revenue-property-tax-subcat-0",
      1.2,
    );

    expect(newState.adjustments["revenue-property-tax-subcat-0"]).toBe(1.2);
    expect(newState.adjustments["revenue-property-tax-subcat-1"]).toBe(1.0);
    expect(newState.adjustments["revenue-sales-tax-subcat-0"]).toBe(1.0);
  });

  it("recalculates totalRevenue after adjustment", () => {
    // Property tax: $1B total, 2 subcats of $500M each
    // Sales tax: $500M total, 2 subcats of $250M each
    const data = createMockBudgetDataWithRevenue(
      [createMockDepartment("dept-police", 2_000_000_000)],
      revenueSources,
    );
    const state = createSimulation(data);

    const newState = adjustRevenueSubcategory(
      state,
      revenueSources,
      "revenue-property-tax-subcat-0",
      1.2,
    );

    // property-tax-subcat-0: $500M * 1.2 = $600M
    // property-tax-subcat-1: $500M * 1.0 = $500M
    // sales-tax-subcat-0: $250M * 1.0 = $250M
    // sales-tax-subcat-1: $250M * 1.0 = $250M
    // Total: $1.6B
    expect(newState.totalRevenue).toBe(1_600_000_000);
  });

  it("clamps to min constraint (0.5)", () => {
    const data = createMockBudgetDataWithRevenue(
      [createMockDepartment("dept-police", 2_000_000_000)],
      revenueSources,
    );
    const state = createSimulation(data);

    const newState = adjustRevenueSubcategory(
      state,
      revenueSources,
      "revenue-property-tax-subcat-0",
      0.3,
    );

    expect(newState.adjustments["revenue-property-tax-subcat-0"]).toBe(0.5);
  });

  it("clamps to max constraint (1.5)", () => {
    const data = createMockBudgetDataWithRevenue(
      [createMockDepartment("dept-police", 2_000_000_000)],
      revenueSources,
    );
    const state = createSimulation(data);

    const newState = adjustRevenueSubcategory(
      state,
      revenueSources,
      "revenue-property-tax-subcat-0",
      2.0,
    );

    expect(newState.adjustments["revenue-property-tax-subcat-0"]).toBe(1.5);
  });

  it("supports custom min/max", () => {
    const data = createMockBudgetDataWithRevenue(
      [createMockDepartment("dept-police", 2_000_000_000)],
      revenueSources,
    );
    const state = createSimulation(data);

    const newState = adjustRevenueSubcategory(
      state,
      revenueSources,
      "revenue-property-tax-subcat-0",
      0.7,
      0.8,
      1.2,
    );

    // 0.7 is below custom min 0.8 -> clamped to 0.8
    expect(newState.adjustments["revenue-property-tax-subcat-0"]).toBe(0.8);
  });

  it("returns same state for nonexistent subcategory", () => {
    const data = createMockBudgetDataWithRevenue(
      [createMockDepartment("dept-police", 2_000_000_000)],
      revenueSources,
    );
    const state = createSimulation(data);

    const newState = adjustRevenueSubcategory(
      state,
      revenueSources,
      "nonexistent-id",
      1.5,
    );

    expect(newState).toBe(state); // Same object reference
  });

  it("preserves expense state fields", () => {
    const data = createMockBudgetDataWithRevenue(
      [createMockDepartment("dept-police", 2_000_000_000)],
      revenueSources,
    );
    const state = createSimulation(data);

    // First adjust an expense to change totalBudget
    const expenseState = adjustSubcategory(
      state,
      data.appropriations.by_department,
      "dept-police-subcat-0",
      1.2,
    );

    // Then adjust revenue
    const revenueState = adjustRevenueSubcategory(
      expenseState,
      revenueSources,
      "revenue-property-tax-subcat-0",
      1.3,
    );

    // Expense fields preserved
    expect(revenueState.totalBudget).toBe(expenseState.totalBudget);
    expect(revenueState.originalBudget).toBe(expenseState.originalBudget);
    // Expense adjustment preserved
    expect(revenueState.adjustments["dept-police-subcat-0"]).toBe(1.2);
  });

  it("returns new state object (immutable)", () => {
    const data = createMockBudgetDataWithRevenue(
      [createMockDepartment("dept-police", 2_000_000_000)],
      revenueSources,
    );
    const state = createSimulation(data);

    const newState = adjustRevenueSubcategory(
      state,
      revenueSources,
      "revenue-property-tax-subcat-0",
      1.2,
    );

    expect(newState).not.toBe(state);
    expect(state.adjustments["revenue-property-tax-subcat-0"]).toBe(1.0);
  });
});

describe("adjustSubcategory preserves revenue", () => {
  it("expense adjustment preserves revenue fields", () => {
    const revenueSources = [
      createMockRevenueSource("revenue-property-tax", 1_000_000_000, 2),
    ];
    const data = createMockBudgetDataWithRevenue(
      [createMockDepartment("dept-police", 2_000_000_000)],
      revenueSources,
      3_000_000_000,
    );

    const state = createSimulation(data);

    // Adjust a revenue subcategory first to change totalRevenue
    const revenueState = adjustRevenueSubcategory(
      state,
      revenueSources,
      "revenue-property-tax-subcat-0",
      1.2,
    );

    // Then adjust an expense subcategory
    const expenseState = adjustSubcategory(
      revenueState,
      data.appropriations.by_department,
      "dept-police-subcat-0",
      1.1,
    );

    // Revenue fields should be preserved
    expect(expenseState.totalRevenue).toBe(revenueState.totalRevenue);
    expect(expenseState.originalRevenue).toBe(revenueState.originalRevenue);
    expect(expenseState.untrackedRevenue).toBe(3_000_000_000);
    // Revenue adjustment preserved
    expect(expenseState.adjustments["revenue-property-tax-subcat-0"]).toBe(1.2);
  });
});

describe("getAdjustedRevenueSourceTotal", () => {
  it("returns sum of adjusted subcategories", () => {
    const source = createMockRevenueSource("revenue-tax", 1_000_000_000, 3);
    const state: SimulationState = {
      adjustments: {
        "revenue-tax-subcat-0": 1.2,
        "revenue-tax-subcat-1": 0.8,
        "revenue-tax-subcat-2": 1.0,
      },
      totalBudget: 0,
      originalBudget: 0,
      ...defaultRevenueState,
    };

    const total = getAdjustedRevenueSourceTotal(source, state);
    const expected =
      Math.round(source.subcategories[0].amount * 1.2) +
      Math.round(source.subcategories[1].amount * 0.8) +
      Math.round(source.subcategories[2].amount * 1.0);
    expect(total).toBe(expected);
  });

  it("defaults unadjusted subcategories to 1.0", () => {
    const source = createMockRevenueSource("revenue-tax", 1_000_000_000, 2);
    const state: SimulationState = {
      adjustments: {}, // No adjustments at all
      totalBudget: 0,
      originalBudget: 0,
      ...defaultRevenueState,
    };

    expect(getAdjustedRevenueSourceTotal(source, state)).toBe(1_000_000_000);
  });

  it("rounds individual subcategory amounts", () => {
    const source: RevenueSource = {
      id: "revenue-tax",
      name: "Tax",
      amount: 999_999,
      revenue_type: "tax",
      subcategories: [{ id: "revenue-tax-subcat-0", name: "Subcat", amount: 999_999 }],
      fund_breakdown: [],
    };
    const state: SimulationState = {
      adjustments: { "revenue-tax-subcat-0": 1.33 },
      totalBudget: 0,
      originalBudget: 0,
      ...defaultRevenueState,
    };

    expect(getAdjustedRevenueSourceTotal(source, state)).toBe(Math.round(999_999 * 1.33));
  });

  it("handles revenue source with zero subcategories", () => {
    const source: RevenueSource = {
      id: "revenue-empty",
      name: "Empty",
      amount: 0,
      revenue_type: "other",
      subcategories: [],
      fund_breakdown: [],
    };
    const state: SimulationState = {
      adjustments: {},
      totalBudget: 0,
      originalBudget: 0,
      ...defaultRevenueState,
    };

    expect(getAdjustedRevenueSourceTotal(source, state)).toBe(0);
  });
});

describe("getRevenueExpenseBalance", () => {
  it("returns positive for surplus", () => {
    const state: SimulationState = {
      adjustments: {},
      totalBudget: 12_000_000_000,
      originalBudget: 12_000_000_000,
      totalRevenue: 10_000_000_000,
      originalRevenue: 10_000_000_000,
      untrackedRevenue: 3_000_000_000,
    };

    // (10B + 3B) - 12B = 1B
    expect(getRevenueExpenseBalance(state)).toBe(1_000_000_000);
  });

  it("returns negative for deficit", () => {
    const state: SimulationState = {
      adjustments: {},
      totalBudget: 15_000_000_000,
      originalBudget: 15_000_000_000,
      totalRevenue: 10_000_000_000,
      originalRevenue: 10_000_000_000,
      untrackedRevenue: 3_000_000_000,
    };

    // (10B + 3B) - 15B = -2B
    expect(getRevenueExpenseBalance(state)).toBe(-2_000_000_000);
  });

  it("returns zero when balanced", () => {
    const state: SimulationState = {
      adjustments: {},
      totalBudget: 13_000_000_000,
      originalBudget: 13_000_000_000,
      totalRevenue: 10_000_000_000,
      originalRevenue: 10_000_000_000,
      untrackedRevenue: 3_000_000_000,
    };

    expect(getRevenueExpenseBalance(state)).toBe(0);
  });

  it("handles zero untracked revenue", () => {
    const state: SimulationState = {
      adjustments: {},
      totalBudget: 10_000_000_000,
      originalBudget: 10_000_000_000,
      totalRevenue: 10_000_000_000,
      originalRevenue: 10_000_000_000,
      untrackedRevenue: 0,
    };

    expect(getRevenueExpenseBalance(state)).toBe(0);
  });
});

describe("getAdjustedRevenueSources", () => {
  it("returns subcategories with non-1.0 multipliers", () => {
    const revenueSources = [
      createMockRevenueSource("revenue-property-tax", 1_000_000_000, 2),
      createMockRevenueSource("revenue-sales-tax", 500_000_000, 2),
    ];

    const state: SimulationState = {
      adjustments: {
        "revenue-property-tax-subcat-0": 1.2,
        "revenue-property-tax-subcat-1": 1.0,
        "revenue-sales-tax-subcat-0": 1.0,
        "revenue-sales-tax-subcat-1": 0.8,
      },
      totalBudget: 0,
      originalBudget: 0,
      ...defaultRevenueState,
    };

    const adjusted = getAdjustedRevenueSources(state, revenueSources);
    expect(adjusted).toHaveLength(2);
    expect(adjusted[0].subcategory.id).toBe("revenue-property-tax-subcat-0");
    expect(adjusted[0].source.id).toBe("revenue-property-tax");
    expect(adjusted[1].subcategory.id).toBe("revenue-sales-tax-subcat-1");
    expect(adjusted[1].source.id).toBe("revenue-sales-tax");
  });

  it("excludes subcategories at 1.0", () => {
    const revenueSources = [
      createMockRevenueSource("revenue-tax", 1_000_000_000, 2),
    ];

    const state: SimulationState = {
      adjustments: {
        "revenue-tax-subcat-0": 1.0,
        "revenue-tax-subcat-1": 1.0,
      },
      totalBudget: 0,
      originalBudget: 0,
      ...defaultRevenueState,
    };

    expect(getAdjustedRevenueSources(state, revenueSources)).toHaveLength(0);
  });

  it("handles floating point precision", () => {
    const revenueSources = [
      createMockRevenueSource("revenue-tax", 1_000_000_000, 2),
    ];

    const state: SimulationState = {
      adjustments: {
        "revenue-tax-subcat-0": 1.0001, // Very small difference
        "revenue-tax-subcat-1": 1.0,
      },
      totalBudget: 0,
      originalBudget: 0,
      ...defaultRevenueState,
    };

    expect(getAdjustedRevenueSources(state, revenueSources)).toHaveLength(0);
  });
});

describe("resetSimulation with revenue", () => {
  it("resets revenue adjustments to 1.0", () => {
    const revenueSources = [
      createMockRevenueSource("revenue-tax", 1_000_000_000, 2),
    ];
    const data = createMockBudgetDataWithRevenue(
      [createMockDepartment("dept-police", 2_000_000_000)],
      revenueSources,
      3_000_000_000,
    );

    // Create state and modify it
    const state = createSimulation(data);
    const modified = adjustRevenueSubcategory(
      state,
      revenueSources,
      "revenue-tax-subcat-0",
      1.3,
    );
    expect(modified.adjustments["revenue-tax-subcat-0"]).toBe(1.3);

    // Reset
    const resetState = resetSimulation(data);
    expect(resetState.adjustments["revenue-tax-subcat-0"]).toBe(1.0);
    expect(resetState.adjustments["revenue-tax-subcat-1"]).toBe(1.0);
  });

  it("resets totalRevenue to original", () => {
    const revenueSources = [
      createMockRevenueSource("revenue-tax", 1_000_000_000, 2),
    ];
    const data = createMockBudgetDataWithRevenue(
      [createMockDepartment("dept-police", 2_000_000_000)],
      revenueSources,
      3_000_000_000,
    );

    const resetState = resetSimulation(data);

    expect(resetState.totalRevenue).toBe(1_000_000_000);
    expect(resetState.originalRevenue).toBe(1_000_000_000);
    expect(resetState.untrackedRevenue).toBe(3_000_000_000);
  });
});

import { describe, it, expect } from "vitest";
import {
  compareBudgets,
  compareDepartments,
  compareSubcategories,
  compareRevenueSources,
  getRevenueSourceType,
} from "../comparison-engine";
import type { BudgetData, Department, Revenue } from "../types";

// -- Test data factories --

function createMockDepartment(
  id: string,
  name: string,
  amount: number,
  subcategories?: { id: string; name: string; amount: number }[],
): Department {
  return {
    id,
    name,
    code: id,
    amount,
    prior_year_amount: null,
    change_pct: null,
    fund_breakdown: [],
    subcategories: subcategories ?? [
      { id: `${id}-personnel`, name: "Personnel", amount: Math.round(amount * 0.7) },
      { id: `${id}-operations`, name: "Operations", amount: Math.round(amount * 0.3) },
    ],
    simulation: {
      adjustable: true,
      min_pct: 0.5,
      max_pct: 1.5,
      step_pct: 0.01,
      constraints: [],
      description: "",
    },
  };
}

function createMockBudgetData(
  year: string,
  options?: {
    total?: number;
    gross?: number;
    operating?: number | null;
    departments?: Department[];
    revenue?: Revenue;
    fundCategories?: Record<string, number>;
    totalRevenue?: number | null;
  },
): BudgetData {
  const total = options?.total ?? 18_000_000_000;
  const gross = options?.gross ?? total + 500_000_000;
  const departments = options?.departments ?? [
    createMockDepartment("dept-police", "Police", 2_000_000_000),
    createMockDepartment("dept-fire", "Fire", 800_000_000),
    createMockDepartment("dept-finance", "Finance", 500_000_000),
  ];

  return {
    metadata: {
      entity_id: "city-of-chicago",
      entity_name: "City of Chicago",
      fiscal_year: year,
      fiscal_year_label: `FY${year.substring(2).toUpperCase()}`,
      fiscal_year_start: `20${year.substring(2)}-01-01`,
      fiscal_year_end: `20${year.substring(2)}-12-31`,
      gross_appropriations: gross,
      accounting_adjustments: total - gross,
      total_appropriations: total,
      operating_appropriations: options?.operating ?? total,
      fund_category_breakdown: options?.fundCategories ?? {
        operating: Math.round(total * 0.6),
        enterprise: Math.round(total * 0.3),
        pension: Math.round(total * 0.1),
      },
      total_revenue: options?.totalRevenue ?? null,
      revenue_surplus_deficit: null,
      data_source: "Test Data",
      source_dataset_id: "test-dataset",
      extraction_date: "2026-01-01T00:00:00Z",
      pipeline_version: "1.0.0",
      notes: null,
    },
    appropriations: {
      by_department: departments,
      by_fund: [],
    },
    revenue: options?.revenue,
    schema_version: "1.0.0",
  };
}

function createMockRevenue(
  sources: { id: string; name: string; amount: number; revenue_type: string }[],
): Revenue {
  const total = sources.reduce((sum, s) => sum + s.amount, 0);
  return {
    by_source: sources.map((s) => ({
      ...s,
      subcategories: [],
      fund_breakdown: [],
    })),
    by_fund: [],
    total_revenue: total,
    local_revenue_only: true,
    grant_revenue_estimated: null,
  };
}

// -- compareBudgets tests --

describe("compareBudgets", () => {
  it("computes total appropriations delta between two years", () => {
    const base = createMockBudgetData("fy2024", { total: 18_000_000_000 });
    const target = createMockBudgetData("fy2026", { total: 18_800_000_000 });

    const result = compareBudgets(base, target);

    expect(result.totalAppropriations.baseAmount).toBe(18_000_000_000);
    expect(result.totalAppropriations.targetAmount).toBe(18_800_000_000);
    expect(result.totalAppropriations.delta).toBe(800_000_000);
    expect(result.totalAppropriations.deltaPct).toBeCloseTo(4.44, 1);
  });

  it("computes gross appropriations delta", () => {
    const base = createMockBudgetData("fy2024", { total: 18_000_000_000, gross: 18_500_000_000 });
    const target = createMockBudgetData("fy2026", { total: 19_000_000_000, gross: 19_500_000_000 });

    const result = compareBudgets(base, target);

    expect(result.grossAppropriations.delta).toBe(1_000_000_000);
  });

  it("computes revenue delta when both years have revenue", () => {
    const base = createMockBudgetData("fy2024", { totalRevenue: 13_000_000_000 });
    const target = createMockBudgetData("fy2026", { totalRevenue: 14_600_000_000 });

    const result = compareBudgets(base, target);

    expect(result.totalRevenue).not.toBeNull();
    expect(result.totalRevenue!.delta).toBe(1_600_000_000);
    expect(result.totalRevenue!.status).toBe("common");
  });

  it("returns null revenue comparison when base year has no revenue", () => {
    const base = createMockBudgetData("fy2023", { totalRevenue: null });
    const target = createMockBudgetData("fy2026", { totalRevenue: 14_600_000_000 });

    const result = compareBudgets(base, target);

    expect(result.totalRevenue).toBeNull();
  });

  it("returns null revenue comparison when target year has no revenue", () => {
    const base = createMockBudgetData("fy2024", { totalRevenue: 13_000_000_000 });
    const target = createMockBudgetData("fy2023", { totalRevenue: null });

    const result = compareBudgets(base, target);

    expect(result.totalRevenue).toBeNull();
  });

  it("computes fund category breakdown deltas", () => {
    const base = createMockBudgetData("fy2024", {
      fundCategories: { operating: 10_000_000_000, enterprise: 5_000_000_000, pension: 3_000_000_000 },
    });
    const target = createMockBudgetData("fy2026", {
      fundCategories: { operating: 11_000_000_000, enterprise: 5_500_000_000, pension: 2_800_000_000 },
    });

    const result = compareBudgets(base, target);

    expect(result.fundCategoryBreakdown).toHaveLength(3);

    const enterprise = result.fundCategoryBreakdown.find((c) => c.id === "fund-enterprise");
    expect(enterprise?.delta).toBe(500_000_000);

    const pension = result.fundCategoryBreakdown.find((c) => c.id === "fund-pension");
    expect(pension?.delta).toBe(-200_000_000);
  });

  it("handles fund categories present in only one year", () => {
    const base = createMockBudgetData("fy2024", {
      fundCategories: { operating: 10_000_000_000, grant: 500_000_000 },
    });
    const target = createMockBudgetData("fy2026", {
      fundCategories: { operating: 11_000_000_000 },
    });

    const result = compareBudgets(base, target);

    const grant = result.fundCategoryBreakdown.find((c) => c.id === "fund-grant");
    expect(grant).toBeDefined();
    expect(grant!.status).toBe("removed");
    expect(grant!.targetAmount).toBeNull();
    expect(grant!.delta).toBeNull();
  });

  it("returns correct year labels from metadata", () => {
    const base = createMockBudgetData("fy2024");
    const target = createMockBudgetData("fy2026");

    const result = compareBudgets(base, target);

    expect(result.baseYearLabel).toBe("FY2024");
    expect(result.targetYearLabel).toBe("FY2026");
    expect(result.baseYear).toBe("fy2024");
    expect(result.targetYear).toBe("fy2026");
  });
});

// -- compareDepartments tests --

describe("compareDepartments", () => {
  it("matches departments by code and computes deltas", () => {
    const base = createMockBudgetData("fy2024", {
      departments: [
        createMockDepartment("dept-police", "Police", 1_900_000_000),
        createMockDepartment("dept-fire", "Fire", 750_000_000),
        createMockDepartment("dept-finance", "Finance", 500_000_000),
      ],
    });
    const target = createMockBudgetData("fy2026", {
      departments: [
        createMockDepartment("dept-police", "Police", 2_000_000_000),
        createMockDepartment("dept-fire", "Fire", 800_000_000),
        createMockDepartment("dept-finance", "Finance", 450_000_000),
      ],
    });

    const result = compareDepartments(base, target);

    expect(result).toHaveLength(3);

    const police = result.find((d) => d.id === "dept-police")!;
    expect(police.delta).toBe(100_000_000);
    expect(police.status).toBe("common");
    expect(police.deltaPct).toBeCloseTo(5.26, 1);

    const finance = result.find((d) => d.id === "dept-finance")!;
    expect(finance.delta).toBe(-50_000_000);
  });

  it("marks departments only in target year as added", () => {
    const base = createMockBudgetData("fy2024", {
      departments: [createMockDepartment("dept-police", "Police", 1_900_000_000)],
    });
    const target = createMockBudgetData("fy2026", {
      departments: [
        createMockDepartment("dept-police", "Police", 2_000_000_000),
        createMockDepartment("dept-new", "New Initiative", 50_000_000),
      ],
    });

    const result = compareDepartments(base, target);
    const newDept = result.find((d) => d.id === "dept-new")!;

    expect(newDept.status).toBe("added");
    expect(newDept.baseAmount).toBeNull();
    expect(newDept.targetAmount).toBe(50_000_000);
    expect(newDept.delta).toBeNull();
  });

  it("marks departments only in base year as removed", () => {
    const base = createMockBudgetData("fy2024", {
      departments: [
        createMockDepartment("dept-police", "Police", 1_900_000_000),
        createMockDepartment("dept-old", "Old Program", 30_000_000),
      ],
    });
    const target = createMockBudgetData("fy2026", {
      departments: [createMockDepartment("dept-police", "Police", 2_000_000_000)],
    });

    const result = compareDepartments(base, target);
    const oldDept = result.find((d) => d.id === "dept-old")!;

    expect(oldDept.status).toBe("removed");
    expect(oldDept.targetAmount).toBeNull();
    expect(oldDept.delta).toBeNull();
  });

  it("handles department with zero base amount", () => {
    const base = createMockBudgetData("fy2024", {
      departments: [createMockDepartment("dept-zero", "Zero Budget", 0)],
    });
    const target = createMockBudgetData("fy2026", {
      departments: [createMockDepartment("dept-zero", "Zero Budget", 500_000_000)],
    });

    const result = compareDepartments(base, target);
    const dept = result.find((d) => d.id === "dept-zero")!;

    expect(dept.delta).toBe(500_000_000);
    expect(dept.deltaPct).toBeNull(); // division by zero
  });

  it("handles department with zero target amount", () => {
    const base = createMockBudgetData("fy2024", {
      departments: [createMockDepartment("dept-shrink", "Shrinking Dept", 500_000_000)],
    });
    const target = createMockBudgetData("fy2026", {
      departments: [createMockDepartment("dept-shrink", "Shrinking Dept", 0)],
    });

    const result = compareDepartments(base, target);
    const dept = result.find((d) => d.id === "dept-shrink")!;

    expect(dept.delta).toBe(-500_000_000);
    expect(dept.deltaPct).toBe(-100);
  });

  it("handles negative amounts correctly", () => {
    const base = createMockBudgetData("fy2024", {
      departments: [createMockDepartment("dept-adj", "Adjustment", -50_000_000)],
    });
    const target = createMockBudgetData("fy2026", {
      departments: [createMockDepartment("dept-adj", "Adjustment", -30_000_000)],
    });

    const result = compareDepartments(base, target);
    const dept = result.find((d) => d.id === "dept-adj")!;

    expect(dept.delta).toBe(20_000_000); // less negative = positive delta
    expect(dept.deltaPct).toBeCloseTo(-40, 0); // -30M vs -50M = -40% change
  });

  it("returns empty array when both years have no departments", () => {
    const base = createMockBudgetData("fy2024", { departments: [] });
    const target = createMockBudgetData("fy2026", { departments: [] });

    const result = compareDepartments(base, target);
    expect(result).toHaveLength(0);
  });

  it("preserves department names from target year when available", () => {
    const base = createMockBudgetData("fy2024", {
      departments: [createMockDepartment("dept-x", "Old Name", 100_000_000)],
    });
    const target = createMockBudgetData("fy2026", {
      departments: [createMockDepartment("dept-x", "New Name", 200_000_000)],
    });

    const result = compareDepartments(base, target);
    expect(result[0]!.name).toBe("New Name");
  });

  it("matches departments with different id but same code as common", () => {
    const baseDept = createMockDepartment("dept-fire-department", "Fire Department", 750_000_000);
    baseDept.code = "23";
    const targetDept = createMockDepartment("dept-chicago-fire-department", "Chicago Fire Department", 800_000_000);
    targetDept.code = "23";

    const base = createMockBudgetData("fy2011", { departments: [baseDept] });
    const target = createMockBudgetData("fy2026", { departments: [targetDept] });

    const result = compareDepartments(base, target);

    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe("common");
    expect(result[0]!.id).toBe("23");
    expect(result[0]!.name).toBe("Chicago Fire Department");
    expect(result[0]!.delta).toBe(50_000_000);
  });

  it("includes all departments from both years (full outer join)", () => {
    const base = createMockBudgetData("fy2024", {
      departments: [
        createMockDepartment("dept-a", "A", 100_000_000),
        createMockDepartment("dept-b", "B", 200_000_000),
        createMockDepartment("dept-c", "C", 300_000_000),
      ],
    });
    const target = createMockBudgetData("fy2026", {
      departments: [
        createMockDepartment("dept-b", "B", 250_000_000),
        createMockDepartment("dept-c", "C", 350_000_000),
        createMockDepartment("dept-d", "D", 100_000_000),
      ],
    });

    const result = compareDepartments(base, target);
    const ids = result.map((r) => r.id).sort();

    expect(ids).toEqual(["dept-a", "dept-b", "dept-c", "dept-d"]);
    expect(result.find((d) => d.id === "dept-a")!.status).toBe("removed");
    expect(result.find((d) => d.id === "dept-b")!.status).toBe("common");
    expect(result.find((d) => d.id === "dept-d")!.status).toBe("added");
  });
});

// -- compareSubcategories tests --

describe("compareSubcategories", () => {
  it("matches subcategories by ID and computes deltas", () => {
    const baseDept = createMockDepartment("dept-police", "Police", 1_900_000_000, [
      { id: "police-salaries", name: "Salaries", amount: 1_400_000_000 },
      { id: "police-overtime", name: "Overtime", amount: 200_000_000 },
      { id: "police-equipment", name: "Equipment", amount: 300_000_000 },
    ]);
    const targetDept = createMockDepartment("dept-police", "Police", 2_000_000_000, [
      { id: "police-salaries", name: "Salaries", amount: 1_500_000_000 },
      { id: "police-overtime", name: "Overtime", amount: 180_000_000 },
      { id: "police-equipment", name: "Equipment", amount: 320_000_000 },
    ]);

    const result = compareSubcategories(baseDept, targetDept);

    expect(result).toHaveLength(3);
    const salaries = result.find((s) => s.id === "police-salaries")!;
    expect(salaries.delta).toBe(100_000_000);
    expect(salaries.status).toBe("common");
  });

  it("handles subcategories added in target year", () => {
    const baseDept = createMockDepartment("dept-x", "X", 100_000_000, [
      { id: "x-a", name: "A", amount: 100_000_000 },
    ]);
    const targetDept = createMockDepartment("dept-x", "X", 200_000_000, [
      { id: "x-a", name: "A", amount: 100_000_000 },
      { id: "x-b", name: "B", amount: 100_000_000 },
    ]);

    const result = compareSubcategories(baseDept, targetDept);
    const added = result.find((s) => s.id === "x-b")!;

    expect(added.status).toBe("added");
    expect(added.baseAmount).toBeNull();
  });

  it("handles subcategories removed in target year", () => {
    const baseDept = createMockDepartment("dept-x", "X", 200_000_000, [
      { id: "x-a", name: "A", amount: 100_000_000 },
      { id: "x-b", name: "B", amount: 100_000_000 },
    ]);
    const targetDept = createMockDepartment("dept-x", "X", 100_000_000, [
      { id: "x-a", name: "A", amount: 100_000_000 },
    ]);

    const result = compareSubcategories(baseDept, targetDept);
    const removed = result.find((s) => s.id === "x-b")!;

    expect(removed.status).toBe("removed");
    expect(removed.targetAmount).toBeNull();
  });

  it("returns items for target department when base department is undefined", () => {
    const targetDept = createMockDepartment("dept-new", "New", 100_000_000, [
      { id: "new-a", name: "A", amount: 60_000_000 },
      { id: "new-b", name: "B", amount: 40_000_000 },
    ]);

    const result = compareSubcategories(undefined, targetDept);

    expect(result).toHaveLength(2);
    expect(result.every((r) => r.status === "added")).toBe(true);
    expect(result.every((r) => r.baseAmount === null)).toBe(true);
  });

  it("returns items for base department when target department is undefined", () => {
    const baseDept = createMockDepartment("dept-old", "Old", 100_000_000, [
      { id: "old-a", name: "A", amount: 60_000_000 },
    ]);

    const result = compareSubcategories(baseDept, undefined);

    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe("removed");
    expect(result[0]!.targetAmount).toBeNull();
  });

  it("returns empty array when both departments are undefined", () => {
    const result = compareSubcategories(undefined, undefined);
    expect(result).toHaveLength(0);
  });

  it("handles large departments with many subcategories", () => {
    const subs = Array.from({ length: 94 }, (_, i) => ({
      id: `sub-${i}`,
      name: `Subcategory ${i}`,
      amount: 1_000_000 * (i + 1),
    }));

    const baseDept = createMockDepartment("dept-large", "Finance General", 0, subs);
    const targetDept = createMockDepartment(
      "dept-large",
      "Finance General",
      0,
      subs.map((s) => ({ ...s, amount: s.amount + 100_000 })),
    );

    const result = compareSubcategories(baseDept, targetDept);

    expect(result).toHaveLength(94);
    expect(result.every((r) => r.status === "common")).toBe(true);
    expect(result.every((r) => r.delta === 100_000)).toBe(true);
  });
});

// -- compareRevenueSources tests --

describe("compareRevenueSources", () => {
  it("matches revenue sources by ID and computes deltas", () => {
    const revBase = createMockRevenue([
      { id: "rev-property-tax", name: "Property Tax", amount: 1_500_000_000, revenue_type: "tax" },
      { id: "rev-sales-tax", name: "Sales Tax", amount: 800_000_000, revenue_type: "tax" },
    ]);
    const revTarget = createMockRevenue([
      { id: "rev-property-tax", name: "Property Tax", amount: 1_600_000_000, revenue_type: "tax" },
      { id: "rev-sales-tax", name: "Sales Tax", amount: 900_000_000, revenue_type: "tax" },
    ]);

    const base = createMockBudgetData("fy2024", { revenue: revBase });
    const target = createMockBudgetData("fy2026", { revenue: revTarget });

    const result = compareRevenueSources(base, target);

    expect(result).not.toBeNull();
    expect(result!).toHaveLength(2);

    const propertyTax = result!.find((r) => r.id === "rev-property-tax")!;
    expect(propertyTax.delta).toBe(100_000_000);
    expect(propertyTax.status).toBe("common");
  });

  it("returns null when base year has no revenue", () => {
    const base = createMockBudgetData("fy2023");
    const target = createMockBudgetData("fy2026", {
      revenue: createMockRevenue([
        { id: "rev-tax", name: "Tax", amount: 1_000_000_000, revenue_type: "tax" },
      ]),
    });

    const result = compareRevenueSources(base, target);
    expect(result).toBeNull();
  });

  it("returns null when target year has no revenue", () => {
    const base = createMockBudgetData("fy2024", {
      revenue: createMockRevenue([
        { id: "rev-tax", name: "Tax", amount: 1_000_000_000, revenue_type: "tax" },
      ]),
    });
    const target = createMockBudgetData("fy2023");

    const result = compareRevenueSources(base, target);
    expect(result).toBeNull();
  });

  it("handles revenue sources present in only one year", () => {
    const revBase = createMockRevenue([
      { id: "rev-a", name: "Source A", amount: 100_000_000, revenue_type: "tax" },
    ]);
    const revTarget = createMockRevenue([
      { id: "rev-a", name: "Source A", amount: 120_000_000, revenue_type: "tax" },
      { id: "rev-b", name: "Source B", amount: 50_000_000, revenue_type: "fee" },
    ]);

    const base = createMockBudgetData("fy2024", { revenue: revBase });
    const target = createMockBudgetData("fy2026", { revenue: revTarget });

    const result = compareRevenueSources(base, target)!;
    const newSource = result.find((r) => r.id === "rev-b")!;

    expect(newSource.status).toBe("added");
    expect(newSource.baseAmount).toBeNull();
  });
});

// -- getRevenueSourceType tests --

describe("getRevenueSourceType", () => {
  it("returns type from target year when available", () => {
    const base = createMockBudgetData("fy2024", {
      revenue: createMockRevenue([
        { id: "rev-x", name: "X", amount: 100, revenue_type: "fee" },
      ]),
    });
    const target = createMockBudgetData("fy2026", {
      revenue: createMockRevenue([
        { id: "rev-x", name: "X", amount: 200, revenue_type: "tax" },
      ]),
    });

    expect(getRevenueSourceType("rev-x", base, target)).toBe("tax");
  });

  it("falls back to base year when source not in target", () => {
    const base = createMockBudgetData("fy2024", {
      revenue: createMockRevenue([
        { id: "rev-old", name: "Old", amount: 100, revenue_type: "enterprise" },
      ]),
    });
    const target = createMockBudgetData("fy2026", {
      revenue: createMockRevenue([]),
    });

    expect(getRevenueSourceType("rev-old", base, target)).toBe("enterprise");
  });

  it("returns other when source not found anywhere", () => {
    const base = createMockBudgetData("fy2024");
    const target = createMockBudgetData("fy2026");

    expect(getRevenueSourceType("rev-unknown", base, target)).toBe("other");
  });
});

// -- Edge case: both amounts zero --

describe("edge cases", () => {
  it("handles both amounts being zero", () => {
    const base = createMockBudgetData("fy2024", {
      departments: [createMockDepartment("dept-zero", "Zero", 0)],
    });
    const target = createMockBudgetData("fy2026", {
      departments: [createMockDepartment("dept-zero", "Zero", 0)],
    });

    const result = compareDepartments(base, target);
    const dept = result.find((d) => d.id === "dept-zero")!;

    expect(dept.delta).toBe(0);
    expect(dept.deltaPct).toBeNull(); // 0/0 is undefined
  });
});

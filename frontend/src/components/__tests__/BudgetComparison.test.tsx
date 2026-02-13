import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BudgetComparison from "../BudgetComparison";
import type { BudgetData, Revenue } from "@/lib/types";

// Mock child components to isolate container logic
vi.mock("@/components/ui/YearPairSelector", () => ({
  default: ({
    baseYear,
    targetYear,
    onBaseYearChange,
    onTargetYearChange,
  }: {
    availableYears: string[];
    baseYear: string;
    targetYear: string;
    onBaseYearChange: (year: string) => void;
    onTargetYearChange: (year: string) => void;
  }) => (
    <div data-testid="year-pair-selector">
      <select
        data-testid="base-year-select"
        value={baseYear}
        onChange={(e) => onBaseYearChange(e.target.value)}
      >
        <option value="fy2026">FY2026</option>
        <option value="fy2025">FY2025</option>
        <option value="fy2024">FY2024</option>
        <option value="fy2023">FY2023</option>
      </select>
      <select
        data-testid="target-year-select"
        value={targetYear}
        onChange={(e) => onTargetYearChange(e.target.value)}
      >
        <option value="fy2026">FY2026</option>
        <option value="fy2025">FY2025</option>
        <option value="fy2024">FY2024</option>
        <option value="fy2023">FY2023</option>
      </select>
    </div>
  ),
}));

vi.mock("@/components/comparison/ComparisonSummary", () => ({
  default: () => <div data-testid="comparison-summary">Comparison Summary</div>,
}));

vi.mock("@/components/comparison/DepartmentComparisonTable", () => ({
  default: () => (
    <div data-testid="department-comparison-table">Department Table</div>
  ),
}));

vi.mock("@/components/comparison/RevenueComparison", () => ({
  default: () => (
    <div data-testid="revenue-comparison">Revenue Comparison</div>
  ),
}));

function createMockBudgetData(
  year: string,
  total: number,
  revenue?: Revenue,
): BudgetData {
  return {
    metadata: {
      entity_id: "city-of-chicago",
      entity_name: "City of Chicago",
      fiscal_year: year,
      fiscal_year_label: `FY${year.substring(2).toUpperCase()}`,
      fiscal_year_start: `20${year.substring(2)}-01-01`,
      fiscal_year_end: `20${year.substring(2)}-12-31`,
      gross_appropriations: total + 100_000_000,
      accounting_adjustments: -100_000_000,
      total_appropriations: total,
      operating_appropriations: total,
      fund_category_breakdown: { operating: total },
      total_revenue: revenue?.total_revenue ?? null,
      revenue_surplus_deficit: null,
      data_source: "Test",
      source_dataset_id: "test",
      extraction_date: "2026-01-01",
      pipeline_version: "1.0.0",
      notes: null,
    },
    appropriations: {
      by_department: [
        {
          id: "dept-finance",
          name: "Finance",
          code: "FIN",
          amount: 500_000_000,
          prior_year_amount: null,
          change_pct: null,
          fund_breakdown: [],
          subcategories: [{ id: "fin-personnel", name: "Personnel", amount: 500_000_000 }],
          simulation: {
            adjustable: true,
            min_pct: 0.5,
            max_pct: 1.5,
            step_pct: 0.01,
            constraints: [],
            description: "",
          },
        },
      ],
      by_fund: [],
    },
    revenue,
    schema_version: "1.0.0",
  };
}

const createRevenue = (): Revenue => ({
  by_source: [
    {
      id: "rev-tax",
      name: "Property Tax",
      amount: 1_500_000_000,
      revenue_type: "tax",
      subcategories: [],
      fund_breakdown: [],
    },
  ],
  by_fund: [],
  total_revenue: 1_500_000_000,
  local_revenue_only: true,
  grant_revenue_estimated: null,
});

const defaultProps = {
  entityId: "city-of-chicago",
  entityName: "City of Chicago",
  budgetDataByYear: {
    fy2026: createMockBudgetData("fy2026", 18_700_000_000, createRevenue()),
    fy2025: createMockBudgetData("fy2025", 18_300_000_000, createRevenue()),
    fy2024: createMockBudgetData("fy2024", 17_800_000_000, createRevenue()),
    fy2023: createMockBudgetData("fy2023", 17_000_000_000), // no revenue
  },
  availableYears: ["fy2026", "fy2025", "fy2024", "fy2023"],
  defaultYear: "fy2026",
};

describe("BudgetComparison", () => {
  it("renders entity name and year selectors", () => {
    render(<BudgetComparison {...defaultProps} />);

    expect(
      screen.getByRole("heading", { name: /city of chicago.*budget comparison/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("year-pair-selector")).toBeInTheDocument();
  });

  it("displays comparison summary for default year pair", () => {
    render(<BudgetComparison {...defaultProps} />);

    expect(screen.getByTestId("comparison-summary")).toBeInTheDocument();
  });

  it("updates comparison when base year changes", async () => {
    const user = userEvent.setup();
    render(<BudgetComparison {...defaultProps} />);

    const baseSelect = screen.getByTestId("base-year-select");
    await user.selectOptions(baseSelect, "fy2023");

    // The component should re-render with new data (summary still visible)
    expect(screen.getByTestId("comparison-summary")).toBeInTheDocument();
  });

  it("updates comparison when target year changes", async () => {
    const user = userEvent.setup();
    render(<BudgetComparison {...defaultProps} />);

    const targetSelect = screen.getByTestId("target-year-select");
    await user.selectOptions(targetSelect, "fy2024");

    expect(screen.getByTestId("comparison-summary")).toBeInTheDocument();
  });

  it("shows Spending tab with department table", () => {
    render(<BudgetComparison {...defaultProps} />);

    expect(screen.getByRole("tab", { name: "Spending" })).toBeInTheDocument();
    expect(screen.getByTestId("department-comparison-table")).toBeInTheDocument();
  });

  it("shows Revenue tab when both years have revenue data", () => {
    render(<BudgetComparison {...defaultProps} />);

    // Default: base = fy2025, target = fy2026, both have revenue
    expect(screen.getByRole("tab", { name: "Revenue" })).toBeInTheDocument();
  });

  it("hides Revenue tab when base year has no revenue", async () => {
    const user = userEvent.setup();
    render(<BudgetComparison {...defaultProps} />);

    // Change base to fy2023 which has no revenue
    const baseSelect = screen.getByTestId("base-year-select");
    await user.selectOptions(baseSelect, "fy2023");

    expect(screen.queryByRole("tab", { name: "Revenue" })).not.toBeInTheDocument();
  });

  it("shows informative message when entity has only 1 year", () => {
    render(
      <BudgetComparison
        {...defaultProps}
        budgetDataByYear={{ fy2026: defaultProps.budgetDataByYear.fy2026 }}
        availableYears={["fy2026"]}
      />,
    );

    expect(screen.getByTestId("single-year-message")).toBeInTheDocument();
    expect(
      screen.getByText(/at least 2 fiscal years/i),
    ).toBeInTheDocument();
  });

  it("renders back navigation link to entity overview", () => {
    render(<BudgetComparison {...defaultProps} />);

    const backLink = screen.getByRole("link", { name: /back to overview/i });
    expect(backLink).toHaveAttribute("href", "/entity/city-of-chicago");
  });
});

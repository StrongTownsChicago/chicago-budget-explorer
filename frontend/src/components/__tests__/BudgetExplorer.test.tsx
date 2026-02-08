import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BudgetExplorer from "../BudgetExplorer";
import type { BudgetData } from "@/lib/types";

// Mock child components
vi.mock("@/components/ui/YearSelector", () => ({
  default: ({
    availableYears,
    defaultYear,
    onYearChange,
  }: {
    availableYears: string[];
    defaultYear: string;
    onYearChange: (year: string) => void;
  }) => (
    <select
      data-testid="year-selector"
      defaultValue={defaultYear}
      onChange={(e) => onYearChange(e.target.value)}
    >
      {availableYears.map((year: string) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("@/components/charts/DepartmentBar", () => ({
  default: () => <div data-testid="department-bar">Department Bar Chart</div>,
}));

vi.mock("@/components/charts/FundPie", () => ({
  default: () => <div data-testid="fund-pie">Fund Pie Chart</div>,
}));

vi.mock("@/components/charts/AppropriationBreakdown", () => ({
  default: () => <div data-testid="appropriation-breakdown">Appropriation Breakdown</div>,
}));

vi.mock("@/components/charts/BudgetTreemap", () => ({
  default: () => <div data-testid="budget-treemap">Budget Treemap</div>,
}));

vi.mock("@/components/charts/RevenueBreakdown", () => ({
  default: () => <div data-testid="revenue-breakdown">Revenue Breakdown</div>,
}));

vi.mock("@/components/charts/RevenueVsSpending", () => ({
  default: () => <div data-testid="revenue-vs-spending">Revenue vs Spending</div>,
}));

vi.mock("@/components/charts/TransparencyCallout", () => ({
  default: () => <div data-testid="transparency-callout">Transparency Callout</div>,
}));

const createMockBudgetData = (year: string, total: number): BudgetData => ({
  metadata: {
    entity_id: "city-of-chicago",
    entity_name: "City of Chicago",
    fiscal_year: year,
    fiscal_year_label: `FY${year.substring(2)}`,
    fiscal_year_start: `${year.substring(2)}-01-01`,
    fiscal_year_end: `${year.substring(2)}-12-31`,
    gross_appropriations: total + 100000000,
    accounting_adjustments: -100000000,
    total_appropriations: total,
    operating_appropriations: total,
    fund_category_breakdown: { operating: total },
    total_revenue: null,
    revenue_surplus_deficit: null,
    data_source: "City of Chicago Open Data Portal",
    source_dataset_id: "test-dataset",
    extraction_date: "2026-02-07T00:00:00Z",
    pipeline_version: "1.0.0",
    notes: null,
  },
  appropriations: {
    by_department: [
      {
        id: "dept-finance",
        name: "Finance",
        code: "FIN",
        amount: 500000000,
        prior_year_amount: 450000000,
        change_pct: 11.1,
        fund_breakdown: [{ fund_id: "0100", fund_name: "Corporate", amount: 500000000 }],
        subcategories: [{ id: "personnel", name: "Personnel", amount: 500000000 }],
        simulation: {
          adjustable: true,
          min_pct: 50,
          max_pct: 150,
          step_pct: 1,
          constraints: [],
          description: "",
        },
      },
    ],
    by_fund: [
      {
        id: "corporate",
        name: "Corporate",
        amount: 1000000000,
        fund_type: "operating" as const,
      },
    ],
  },
  schema_version: "1.0.0",
});

describe("BudgetExplorer", () => {
  const defaultProps = {
    entityId: "city-of-chicago",
    entityName: "City of Chicago",
    budgetDataByYear: {
      fy2025: createMockBudgetData("fy2025", 16600000000),
      fy2024: createMockBudgetData("fy2024", 16100000000),
    },
    availableYears: ["fy2025", "fy2024"],
    defaultYear: "fy2025",
  };

  it("renders entity name in header", () => {
    render(<BudgetExplorer {...defaultProps} />);
    expect(screen.getByRole("heading", { name: /city of chicago/i })).toBeInTheDocument();
  });

  it("displays budget total for default year", () => {
    render(<BudgetExplorer {...defaultProps} />);
    const matches = screen.getAllByText(/\$16\.6B/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("renders year selector with available years", () => {
    render(<BudgetExplorer {...defaultProps} />);
    const yearSelector = screen.getByTestId("year-selector");
    expect(yearSelector).toBeInTheDocument();
  });

  it("renders all chart components", () => {
    render(<BudgetExplorer {...defaultProps} />);

    expect(screen.getByTestId("department-bar")).toBeInTheDocument();
    expect(screen.getByTestId("fund-pie")).toBeInTheDocument();
    expect(screen.getByTestId("appropriation-breakdown")).toBeInTheDocument();
    expect(screen.getByTestId("budget-treemap")).toBeInTheDocument();
  });

  it("renders navigation buttons", () => {
    render(<BudgetExplorer {...defaultProps} />);

    const simulatorLink = screen.getByRole("link", { name: /try the simulator/i });
    const homeLink = screen.getByRole("link", { name: /back to home/i });

    expect(simulatorLink).toHaveAttribute("href", "/entity/city-of-chicago/simulate");
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("updates displayed data when year changes", async () => {
    const user = userEvent.setup();
    render(<BudgetExplorer {...defaultProps} />);

    // Initially shows FY2025 data
    expect(screen.getAllByText(/\$16\.6B/).length).toBeGreaterThan(0);

    // Change to FY2024
    const yearSelector = screen.getByTestId("year-selector");
    await user.selectOptions(yearSelector, "fy2024");

    // Should now show FY2024 data
    expect(screen.getAllByText(/\$16\.1B/).length).toBeGreaterThan(0);
  });

  it("displays fiscal year label", () => {
    render(<BudgetExplorer {...defaultProps} />);
    expect(screen.getByText(/FY2025 Operating Budget/)).toBeInTheDocument();
  });

  it("renders data source attribution", () => {
    render(<BudgetExplorer {...defaultProps} />);

    expect(screen.getByText(/City of Chicago Open Data Portal/)).toBeInTheDocument();
    expect(screen.getByText(/test-dataset/)).toBeInTheDocument();
    expect(screen.getByText(/Pipeline Version: 1\.0\.0/)).toBeInTheDocument();
  });

  it("displays section headings", () => {
    render(<BudgetExplorer {...defaultProps} />);

    expect(screen.getByRole("heading", { name: /spending by department/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /spending by fund type/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /spending by category/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /budget treemap/i })).toBeInTheDocument();
  });

  it("handles single year without errors", () => {
    const singleYearProps = {
      ...defaultProps,
      budgetDataByYear: { fy2025: defaultProps.budgetDataByYear.fy2025 },
      availableYears: ["fy2025"],
    };

    render(<BudgetExplorer {...singleYearProps} />);
    expect(screen.getByRole("heading", { name: /city of chicago/i })).toBeInTheDocument();
  });

  it("formats extraction date correctly", () => {
    render(<BudgetExplorer {...defaultProps} />);
    expect(screen.getByText(/Extracted: 2\/6\/2026/)).toBeInTheDocument();
  });

  it("does not render revenue section when revenue is absent", () => {
    render(<BudgetExplorer {...defaultProps} />);
    expect(screen.queryByTestId("revenue-breakdown")).not.toBeInTheDocument();
    expect(screen.queryByTestId("revenue-vs-spending")).not.toBeInTheDocument();
  });

  it("renders revenue section when revenue data is present", () => {
    const dataWithRevenue = {
      ...defaultProps.budgetDataByYear.fy2025,
      revenue: {
        by_source: [
          {
            id: "revenue-property-tax",
            name: "Property Tax",
            amount: 1500000000,
            subcategories: [],
            fund_breakdown: [],
          },
        ],
        by_fund: [],
        total_revenue: 1500000000,
        local_revenue_only: true,
        grant_revenue_estimated: 500000000,
      },
    };

    const propsWithRevenue = {
      ...defaultProps,
      budgetDataByYear: {
        ...defaultProps.budgetDataByYear,
        fy2025: dataWithRevenue,
      },
    };

    render(<BudgetExplorer {...propsWithRevenue} />);
    expect(screen.getByTestId("revenue-breakdown")).toBeInTheDocument();
    expect(screen.getByTestId("revenue-vs-spending")).toBeInTheDocument();
    expect(screen.getByTestId("transparency-callout")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Revenue$/ })).toBeInTheDocument();
  });
});

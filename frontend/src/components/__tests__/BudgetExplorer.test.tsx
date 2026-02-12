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

vi.mock("@/components/charts/TrendChart", () => ({
  default: ({ label }: { label?: string }) => (
    <div data-testid={`trend-chart-${label || "departments"}`}>Trend Chart ({label || "departments"})</div>
  ),
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

vi.mock("@/components/charts/LineItemTrend", () => ({
  default: ({ parentName }: { parentName: string }) => (
    <div data-testid={`line-item-trend-${parentName.toLowerCase().replace(/\s+/g, "-")}`}>
      Line Item Trend ({parentName})
    </div>
  ),
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
    extraction_date: "2026-02-07T12:00:00Z",
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

const createRevenueData = () => ({
  by_source: [
    {
      id: "revenue-property-tax",
      name: "Property Tax",
      amount: 1500000000,
      revenue_type: "tax",
      subcategories: [],
      fund_breakdown: [],
    },
  ],
  by_fund: [],
  total_revenue: 1500000000,
  local_revenue_only: true,
  grant_revenue_estimated: 500000000,
});

const createRevenueTrendData = () => ({
  by_source: [
    {
      id: "revenue-property-tax",
      name: "Property Tax",
      amount: 1500000000,
      revenue_type: "tax",
      subcategories: [],
      fund_breakdown: [],
      trend: [
        { fiscal_year: "fy2024", amount: 1400000000 },
        { fiscal_year: "fy2025", amount: 1500000000 },
      ],
    },
    {
      id: "revenue-sales-tax",
      name: "Sales Tax",
      amount: 800000000,
      revenue_type: "tax",
      subcategories: [],
      fund_breakdown: [],
      trend: [
        { fiscal_year: "fy2024", amount: 750000000 },
        { fiscal_year: "fy2025", amount: 800000000 },
      ],
    },
  ],
  by_fund: [],
  total_revenue: 2300000000,
  local_revenue_only: true,
  grant_revenue_estimated: 500000000,
});

const createTrendDepartment = () => ({
  id: "dept-finance",
  name: "Finance",
  code: "FIN",
  amount: 500000000,
  prior_year_amount: 450000000,
  change_pct: 11.1,
  fund_breakdown: [{ fund_id: "0100", fund_name: "Corporate", amount: 500000000 }],
  subcategories: [{ id: "personnel", name: "Personnel", amount: 500000000 }],
  trend: [
    { fiscal_year: "fy2024", amount: 450000000 },
    { fiscal_year: "fy2025", amount: 500000000 },
  ],
  simulation: {
    adjustable: true,
    min_pct: 50,
    max_pct: 150,
    step_pct: 1,
    constraints: [],
    description: "",
  },
});

const createTrendDepartmentWithSubcategoryTrends = () => ({
  id: "dept-police",
  name: "Police",
  code: "057",
  amount: 2000000000,
  prior_year_amount: 1900000000,
  change_pct: 5.3,
  fund_breakdown: [{ fund_id: "0100", fund_name: "Corporate", amount: 2000000000 }],
  subcategories: [
    {
      id: "police-salaries",
      name: "Salaries",
      amount: 1500000000,
      trend: [
        { fiscal_year: "fy2024", amount: 1400000000 },
        { fiscal_year: "fy2025", amount: 1500000000 },
      ],
    },
    {
      id: "police-overtime",
      name: "Overtime",
      amount: 200000000,
      trend: [
        { fiscal_year: "fy2024", amount: 180000000 },
        { fiscal_year: "fy2025", amount: 200000000 },
      ],
    },
  ],
  trend: [
    { fiscal_year: "fy2024", amount: 1900000000 },
    { fiscal_year: "fy2025", amount: 2000000000 },
  ],
  simulation: {
    adjustable: true,
    min_pct: 50,
    max_pct: 150,
    step_pct: 1,
    constraints: [],
    description: "",
  },
});

const createRevenueTrendDataWithSubcategoryTrends = () => ({
  by_source: [
    {
      id: "revenue-property-tax",
      name: "Property Tax",
      amount: 1500000000,
      revenue_type: "tax",
      subcategories: [
        {
          id: "prop-levy",
          name: "Property Tax Levy",
          amount: 1200000000,
          trend: [
            { fiscal_year: "fy2024", amount: 1100000000 },
            { fiscal_year: "fy2025", amount: 1200000000 },
          ],
        },
      ],
      fund_breakdown: [],
      trend: [
        { fiscal_year: "fy2024", amount: 1400000000 },
        { fiscal_year: "fy2025", amount: 1500000000 },
      ],
    },
  ],
  by_fund: [],
  total_revenue: 1500000000,
  local_revenue_only: true,
  grant_revenue_estimated: 500000000,
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
    expect(screen.getByText(/FY2025 Total Appropriations/)).toBeInTheDocument();
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
    expect(screen.getByText(/Extracted: 2\/7\/2026/)).toBeInTheDocument();
  });

  it("does not render revenue section when revenue is absent", () => {
    render(<BudgetExplorer {...defaultProps} />);
    expect(screen.queryByTestId("revenue-breakdown")).not.toBeInTheDocument();
    expect(screen.queryByTestId("revenue-vs-spending")).not.toBeInTheDocument();
  });

  it("renders revenue section when revenue data is present", () => {
    const dataWithRevenue = {
      ...defaultProps.budgetDataByYear.fy2025,
      revenue: createRevenueData(),
    };

    const propsWithRevenue = {
      ...defaultProps,
      budgetDataByYear: {
        ...defaultProps.budgetDataByYear,
        fy2025: dataWithRevenue,
      },
    };

    render(<BudgetExplorer {...propsWithRevenue} />);
    // Revenue components are in the DOM (inside a hidden tab panel)
    expect(screen.getByTestId("revenue-breakdown")).toBeInTheDocument();
    expect(screen.getByTestId("revenue-vs-spending")).toBeInTheDocument();
    expect(screen.getByTestId("transparency-callout")).toBeInTheDocument();
    // Revenue heading is inside a hidden panel, so we need hidden: true
    expect(
      screen.getByRole("heading", { name: /^Revenue$/, hidden: true }),
    ).toBeInTheDocument();
  });

  // Tab-specific tests

  it("renders Spending tab button", () => {
    render(<BudgetExplorer {...defaultProps} />);
    expect(screen.getByRole("tab", { name: "Spending" })).toBeInTheDocument();
  });

  it("renders Revenue tab button when revenue data exists", () => {
    const dataWithRevenue = {
      ...defaultProps.budgetDataByYear.fy2025,
      revenue: createRevenueData(),
    };

    const propsWithRevenue = {
      ...defaultProps,
      budgetDataByYear: {
        ...defaultProps.budgetDataByYear,
        fy2025: dataWithRevenue,
      },
    };

    render(<BudgetExplorer {...propsWithRevenue} />);
    expect(screen.getByRole("tab", { name: "Revenue" })).toBeInTheDocument();
  });

  it("does not render Revenue tab when revenue is absent", () => {
    render(<BudgetExplorer {...defaultProps} />);
    expect(screen.queryByRole("tab", { name: "Revenue" })).not.toBeInTheDocument();
  });

  it("renders Trends tab when trend data exists", () => {
    const dataWithTrends: BudgetData = {
      ...defaultProps.budgetDataByYear.fy2025,
      appropriations: {
        ...defaultProps.budgetDataByYear.fy2025.appropriations,
        by_department: [createTrendDepartment()],
      },
    };

    const propsWithTrends = {
      ...defaultProps,
      budgetDataByYear: {
        ...defaultProps.budgetDataByYear,
        fy2025: dataWithTrends,
      },
    };

    render(<BudgetExplorer {...propsWithTrends} />);
    expect(screen.getByRole("tab", { name: "Trends" })).toBeInTheDocument();
  });

  it("does not render Trends tab when no trend data", () => {
    render(<BudgetExplorer {...defaultProps} />);
    expect(screen.queryByRole("tab", { name: "Trends" })).not.toBeInTheDocument();
  });

  // Revenue trend tests

  it("renders revenue trends in Trends tab when revenue has trend data", () => {
    const dataWithRevenueTrends: BudgetData = {
      ...defaultProps.budgetDataByYear.fy2025,
      appropriations: {
        ...defaultProps.budgetDataByYear.fy2025.appropriations,
        by_department: [createTrendDepartment()],
      },
      revenue: createRevenueTrendData(),
    };

    const propsWithRevenueTrends = {
      ...defaultProps,
      budgetDataByYear: {
        ...defaultProps.budgetDataByYear,
        fy2025: dataWithRevenueTrends,
      },
    };

    render(<BudgetExplorer {...propsWithRevenueTrends} />);
    expect(screen.getByRole("tab", { name: "Trends" })).toBeInTheDocument();

    // Both expense and revenue trend charts should be in the DOM
    expect(screen.getByTestId("trend-chart-departments")).toBeInTheDocument();
    expect(screen.getByTestId("trend-chart-revenue sources")).toBeInTheDocument();
  });

  it("renders Trends tab when only revenue has trends (no expense trends)", () => {
    const dataWithOnlyRevenueTrends: BudgetData = {
      ...defaultProps.budgetDataByYear.fy2025,
      revenue: createRevenueTrendData(),
    };

    const propsWithOnlyRevenueTrends = {
      ...defaultProps,
      budgetDataByYear: {
        ...defaultProps.budgetDataByYear,
        fy2025: dataWithOnlyRevenueTrends,
      },
    };

    render(<BudgetExplorer {...propsWithOnlyRevenueTrends} />);
    expect(screen.getByRole("tab", { name: "Trends" })).toBeInTheDocument();

    // Only revenue trend chart should be present (no expense trends)
    expect(screen.queryByTestId("trend-chart-departments")).not.toBeInTheDocument();
    expect(screen.getByTestId("trend-chart-revenue sources")).toBeInTheDocument();
  });

  it("does not render revenue trends section when revenue has no trend data", () => {
    const dataWithExpenseTrendsOnly: BudgetData = {
      ...defaultProps.budgetDataByYear.fy2025,
      appropriations: {
        ...defaultProps.budgetDataByYear.fy2025.appropriations,
        by_department: [createTrendDepartment()],
      },
      revenue: createRevenueData(), // has revenue but no trend arrays
    };

    const propsWithExpenseTrendsOnly = {
      ...defaultProps,
      budgetDataByYear: {
        ...defaultProps.budgetDataByYear,
        fy2025: dataWithExpenseTrendsOnly,
      },
    };

    render(<BudgetExplorer {...propsWithExpenseTrendsOnly} />);
    expect(screen.getByRole("tab", { name: "Trends" })).toBeInTheDocument();

    // Only expense trend chart should be present
    expect(screen.getByTestId("trend-chart-departments")).toBeInTheDocument();
    expect(screen.queryByTestId("trend-chart-revenue sources")).not.toBeInTheDocument();
  });

  it("does not render Trends tab when neither expenses nor revenue have trends", () => {
    const dataWithRevenueNoTrends: BudgetData = {
      ...defaultProps.budgetDataByYear.fy2025,
      revenue: createRevenueData(),
    };

    const propsNoTrends = {
      ...defaultProps,
      budgetDataByYear: {
        ...defaultProps.budgetDataByYear,
        fy2025: dataWithRevenueNoTrends,
      },
    };

    render(<BudgetExplorer {...propsNoTrends} />);
    expect(screen.queryByRole("tab", { name: "Trends" })).not.toBeInTheDocument();
  });

  // Line-item drill-down tests

  it("renders expense drill-down dropdown when department has subcategory trends", () => {
    const dataWithSubcatTrends: BudgetData = {
      ...defaultProps.budgetDataByYear.fy2025,
      appropriations: {
        ...defaultProps.budgetDataByYear.fy2025.appropriations,
        by_department: [createTrendDepartmentWithSubcategoryTrends()],
      },
    };

    const propsWithSubcatTrends = {
      ...defaultProps,
      budgetDataByYear: {
        ...defaultProps.budgetDataByYear,
        fy2025: dataWithSubcatTrends,
      },
    };

    render(<BudgetExplorer {...propsWithSubcatTrends} />);

    // The expense drill-down dropdown should be present in the DOM
    const dropdown = screen.getByLabelText(/explore line items for/i);
    expect(dropdown).toBeInTheDocument();
  });

  it("renders LineItemTrend when department selected from dropdown", async () => {
    const user = userEvent.setup();
    const dataWithSubcatTrends: BudgetData = {
      ...defaultProps.budgetDataByYear.fy2025,
      appropriations: {
        ...defaultProps.budgetDataByYear.fy2025.appropriations,
        by_department: [createTrendDepartmentWithSubcategoryTrends()],
      },
    };

    const propsWithSubcatTrends = {
      ...defaultProps,
      budgetDataByYear: {
        ...defaultProps.budgetDataByYear,
        fy2025: dataWithSubcatTrends,
      },
    };

    render(<BudgetExplorer {...propsWithSubcatTrends} />);

    // Before selection, no LineItemTrend rendered
    expect(screen.queryByTestId("line-item-trend-police")).not.toBeInTheDocument();

    // Select a department from dropdown
    const dropdown = screen.getByLabelText(/explore line items for/i);
    await user.selectOptions(dropdown, "dept-police");

    // LineItemTrend should now be rendered with parentName="Police"
    expect(screen.getByTestId("line-item-trend-police")).toBeInTheDocument();
  });

  it("renders revenue drill-down when revenue source has subcategory trends", async () => {
    const user = userEvent.setup();
    const dataWithRevSubcatTrends: BudgetData = {
      ...defaultProps.budgetDataByYear.fy2025,
      appropriations: {
        ...defaultProps.budgetDataByYear.fy2025.appropriations,
        by_department: [createTrendDepartment()],
      },
      revenue: createRevenueTrendDataWithSubcategoryTrends(),
    };

    const propsWithRevSubcatTrends = {
      ...defaultProps,
      budgetDataByYear: {
        ...defaultProps.budgetDataByYear,
        fy2025: dataWithRevSubcatTrends,
      },
    };

    render(<BudgetExplorer {...propsWithRevSubcatTrends} />);

    // Revenue drill-down dropdown should exist
    const dropdowns = screen.getAllByLabelText(/explore line items for/i);
    // There should be 2 dropdowns (expense + revenue) but expense may not have subcategory trends
    const revenueDropdown = dropdowns[dropdowns.length - 1]!;

    await user.selectOptions(revenueDropdown, "revenue-property-tax");

    expect(screen.getByTestId("line-item-trend-property-tax")).toBeInTheDocument();
  });
});

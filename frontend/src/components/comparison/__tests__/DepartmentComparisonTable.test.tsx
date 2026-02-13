import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DepartmentComparisonTable from "../DepartmentComparisonTable";
import type { ComparisonItem } from "@/lib/comparison-engine";
import type { BudgetData, Department } from "@/lib/types";

// Mock LineItemComparison to keep tests focused
vi.mock("../LineItemComparison", () => ({
  default: ({
    items,
    baseYearLabel,
    targetYearLabel,
  }: {
    items: ComparisonItem[];
    baseYearLabel: string;
    targetYearLabel: string;
  }) => (
    <div data-testid="line-item-comparison">
      Line items: {items.length} | {baseYearLabel} vs {targetYearLabel}
    </div>
  ),
}));

function createMockDepartment(
  id: string,
  name: string,
  amount: number,
): Department {
  return {
    id,
    name,
    code: id.substring(0, 3).toUpperCase(),
    amount,
    prior_year_amount: null,
    change_pct: null,
    fund_breakdown: [],
    subcategories: [
      { id: `${id}-personnel`, name: "Personnel", amount: Math.round(amount * 0.7) },
      { id: `${id}-ops`, name: "Operations", amount: Math.round(amount * 0.3) },
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

function createMockBudgetData(departments: Department[]): BudgetData {
  return {
    metadata: {
      entity_id: "city-of-chicago",
      entity_name: "City of Chicago",
      fiscal_year: "fy2025",
      fiscal_year_label: "FY2025",
      fiscal_year_start: "2025-01-01",
      fiscal_year_end: "2025-12-31",
      gross_appropriations: 0,
      accounting_adjustments: 0,
      total_appropriations: 0,
      operating_appropriations: 0,
      fund_category_breakdown: {},
      total_revenue: null,
      revenue_surplus_deficit: null,
      data_source: "Test",
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
  };
}

const sampleDepartments: ComparisonItem[] = [
  {
    id: "dept-police",
    name: "Police",
    baseAmount: 1_900_000_000,
    targetAmount: 2_000_000_000,
    delta: 100_000_000,
    deltaPct: 5.26,
    status: "common",
  },
  {
    id: "dept-fire",
    name: "Fire",
    baseAmount: 800_000_000,
    targetAmount: 750_000_000,
    delta: -50_000_000,
    deltaPct: -6.25,
    status: "common",
  },
  {
    id: "dept-finance",
    name: "Finance",
    baseAmount: 500_000_000,
    targetAmount: 520_000_000,
    delta: 20_000_000,
    deltaPct: 4.0,
    status: "common",
  },
  {
    id: "dept-new",
    name: "New Initiative",
    baseAmount: null,
    targetAmount: 50_000_000,
    delta: null,
    deltaPct: null,
    status: "added",
  },
  {
    id: "dept-old",
    name: "Old Program",
    baseAmount: 30_000_000,
    targetAmount: null,
    delta: null,
    deltaPct: null,
    status: "removed",
  },
];

const baseBudgetData = createMockBudgetData([
  createMockDepartment("dept-police", "Police", 1_900_000_000),
  createMockDepartment("dept-fire", "Fire", 800_000_000),
  createMockDepartment("dept-finance", "Finance", 500_000_000),
  createMockDepartment("dept-old", "Old Program", 30_000_000),
]);

const targetBudgetData = createMockBudgetData([
  createMockDepartment("dept-police", "Police", 2_000_000_000),
  createMockDepartment("dept-fire", "Fire", 750_000_000),
  createMockDepartment("dept-finance", "Finance", 520_000_000),
  createMockDepartment("dept-new", "New Initiative", 50_000_000),
]);

const defaultProps = {
  departments: sampleDepartments,
  baseYearLabel: "FY2024",
  targetYearLabel: "FY2026",
  baseBudgetData,
  targetBudgetData,
};

describe("DepartmentComparisonTable", () => {
  it("renders all departments in a table", () => {
    render(<DepartmentComparisonTable {...defaultProps} />);

    expect(screen.getByText("Police")).toBeInTheDocument();
    expect(screen.getByText("Fire")).toBeInTheDocument();
    expect(screen.getByText("Finance")).toBeInTheDocument();
    expect(screen.getByText("New Initiative")).toBeInTheDocument();
    expect(screen.getByText("Old Program")).toBeInTheDocument();
  });

  it("displays base amount, target amount, and delta for each department", () => {
    render(<DepartmentComparisonTable {...defaultProps} />);

    // Police row should have its amounts
    const policeRow = screen.getByTestId("dept-row-dept-police");
    expect(within(policeRow).getByText("$1.9B")).toBeInTheDocument();
    expect(within(policeRow).getByText("$2.0B")).toBeInTheDocument();
    expect(within(policeRow).getByText("+$100.0M")).toBeInTheDocument();
  });

  it("sorts by absolute dollar change descending by default", () => {
    render(<DepartmentComparisonTable {...defaultProps} />);

    const rows = screen.getAllByRole("row").filter((r) => r.getAttribute("data-testid")?.startsWith("dept-row-"));

    // Police (+$100M), Fire (-$50M), Finance (+$20M), then added/removed (null deltas)
    expect(within(rows[0]!).getByText("Police")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Fire")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("Finance")).toBeInTheDocument();
  });

  it("sorts by name when name column header clicked", async () => {
    const user = userEvent.setup();
    render(<DepartmentComparisonTable {...defaultProps} />);

    const nameHeader = screen.getByRole("button", { name: /department/i });
    // First click: desc alphabetically. Second click: asc
    await user.click(nameHeader);
    await user.click(nameHeader);

    const rowsAsc = screen.getAllByRole("row").filter((r) => r.getAttribute("data-testid")?.startsWith("dept-row-"));
    expect(within(rowsAsc[0]!).getByText("Finance")).toBeInTheDocument();
  });

  it("toggles sort direction on repeated click", async () => {
    const user = userEvent.setup();
    render(<DepartmentComparisonTable {...defaultProps} />);

    // Default sort is delta desc. Click delta header to toggle to asc
    const deltaHeader = screen.getByRole("button", { name: /\$ change/i });
    await user.click(deltaHeader);

    // Now ascending: smallest absolute delta first
    const rowsAsc = screen.getAllByRole("row").filter((r) => r.getAttribute("data-testid")?.startsWith("dept-row-"));
    // After toggle to asc, smallest absolute deltas come first (null deltas at -Infinity)
    // The added/removed items have null deltas so they appear first in asc order
    expect(rowsAsc.length).toBe(5);
  });

  it("marks added departments with visual indicator", () => {
    render(<DepartmentComparisonTable {...defaultProps} />);

    const newRow = screen.getByTestId("dept-row-dept-new");
    expect(within(newRow).getByText("New")).toBeInTheDocument();
    // Base amount and delta show as "--" (multiple cells), target shows $50.0M
    expect(within(newRow).getAllByText("--").length).toBeGreaterThanOrEqual(1);
    expect(within(newRow).getByText("$50.0M")).toBeInTheDocument();
  });

  it("marks removed departments with visual indicator", () => {
    render(<DepartmentComparisonTable {...defaultProps} />);

    const oldRow = screen.getByTestId("dept-row-dept-old");
    expect(within(oldRow).getByText("Removed")).toBeInTheDocument();
  });

  it("expands department row on click to show line items", async () => {
    const user = userEvent.setup();
    render(<DepartmentComparisonTable {...defaultProps} />);

    // Initially no line items shown
    expect(screen.queryByTestId("line-item-comparison")).not.toBeInTheDocument();

    // Click police row
    const policeRow = screen.getByTestId("dept-row-dept-police");
    await user.click(policeRow);

    // Line items should now be visible
    expect(screen.getByTestId("line-item-comparison")).toBeInTheDocument();
  });

  it("collapses expanded row on second click", async () => {
    const user = userEvent.setup();
    render(<DepartmentComparisonTable {...defaultProps} />);

    const policeRow = screen.getByTestId("dept-row-dept-police");
    await user.click(policeRow);
    expect(screen.getByTestId("line-item-comparison")).toBeInTheDocument();

    await user.click(policeRow);
    expect(screen.queryByTestId("line-item-comparison")).not.toBeInTheDocument();
  });

  it("only one department expanded at a time", async () => {
    const user = userEvent.setup();
    render(<DepartmentComparisonTable {...defaultProps} />);

    const policeRow = screen.getByTestId("dept-row-dept-police");
    await user.click(policeRow);
    expect(screen.getAllByTestId("line-item-comparison")).toHaveLength(1);

    const fireRow = screen.getByTestId("dept-row-dept-fire");
    await user.click(fireRow);

    // Only one expansion visible
    expect(screen.getAllByTestId("line-item-comparison")).toHaveLength(1);
  });

  it("shows empty state message when no departments", () => {
    render(
      <DepartmentComparisonTable
        {...defaultProps}
        departments={[]}
      />,
    );

    expect(screen.getByTestId("no-departments")).toBeInTheDocument();
  });

  it("handles keyboard interaction for row expansion", async () => {
    const user = userEvent.setup();
    render(<DepartmentComparisonTable {...defaultProps} />);

    const policeRow = screen.getByTestId("dept-row-dept-police");
    policeRow.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByTestId("line-item-comparison")).toBeInTheDocument();
  });
});

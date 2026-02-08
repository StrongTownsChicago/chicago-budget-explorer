import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DepartmentBar from "../DepartmentBar";
import type { Department } from "@/lib/types";

// Mock recharts to avoid rendering actual SVG in tests
vi.mock("recharts", () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  Cell: () => <div />,
}));

function createDept(
  id: string,
  name: string,
  amount: number,
  changePct: number | null = null,
): Department {
  return {
    id,
    name,
    code: "000",
    amount,
    prior_year_amount: changePct != null ? Math.round(amount / (1 + changePct / 100)) : null,
    change_pct: changePct,
    fund_breakdown: [],
    subcategories: [],
    simulation: {
      adjustable: true,
      min_pct: 0.5,
      max_pct: 1.5,
      step_pct: 0.01,
      constraints: [],
      description: "Test",
    },
  };
}

describe("DepartmentBar", () => {
  it("renders change badge with positive percentage", () => {
    const departments = [createDept("dept-police", "Police", 2_000_000_000, 5.5)];

    render(<DepartmentBar departments={departments} totalBudget={2_000_000_000} />);

    const badge = screen.getByTestId("change-badge-dept-police");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain("+5.5%");
  });

  it("renders change badge with negative percentage", () => {
    const departments = [createDept("dept-fire", "Fire", 900_000_000, -3.2)];

    render(<DepartmentBar departments={departments} totalBudget={900_000_000} />);

    const badge = screen.getByTestId("change-badge-dept-fire");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain("-3.2%");
  });

  it("does not render change badge when change_pct is null", () => {
    const departments = [createDept("dept-police", "Police", 2_000_000_000, null)];

    render(<DepartmentBar departments={departments} totalBudget={2_000_000_000} />);

    expect(screen.queryByTestId("change-badge-dept-police")).not.toBeInTheDocument();
  });

  it("renders minimal change with neutral styling", () => {
    const departments = [createDept("dept-police", "Police", 2_000_000_000, 0.1)];

    render(<DepartmentBar departments={departments} totalBudget={2_000_000_000} />);

    const badge = screen.getByTestId("change-badge-dept-police");
    expect(badge).toBeInTheDocument();
    // Small change (< 0.5%) should use gray styling
    const badgeSpan = badge.querySelector("span.text-gray-500");
    expect(badgeSpan).toBeInTheDocument();
  });

  it("renders chart container", () => {
    const departments = [createDept("dept-police", "Police", 2_000_000_000)];

    render(<DepartmentBar departments={departments} totalBudget={2_000_000_000} />);

    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("renders multiple change badges for departments with prior year data", () => {
    const departments = [
      createDept("dept-police", "Police", 2_000_000_000, 5.5),
      createDept("dept-fire", "Fire", 900_000_000, -2.1),
      createDept("dept-streets", "Streets", 500_000_000, null),
    ];

    render(<DepartmentBar departments={departments} totalBudget={3_400_000_000} />);

    expect(screen.getByTestId("change-badge-dept-police")).toBeInTheDocument();
    expect(screen.getByTestId("change-badge-dept-fire")).toBeInTheDocument();
    expect(screen.queryByTestId("change-badge-dept-streets")).not.toBeInTheDocument();
  });
});

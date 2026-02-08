import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TrendChart from "../TrendChart";
import type { Department, TrendPoint } from "@/lib/types";

// Mock recharts to avoid rendering actual SVG in tests
vi.mock("recharts", () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: ({ dataKey }: { dataKey: string }) => (
    <div data-testid={`line-${dataKey}`} />
  ),
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

function createMockDepartment(
  name: string,
  amount: number,
  trend?: TrendPoint[],
): Department {
  return {
    id: `dept-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    code: "000",
    amount,
    prior_year_amount: null,
    change_pct: null,
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
    trend,
  };
}

const fourYearTrend: TrendPoint[] = [
  { fiscal_year: "fy2023", amount: 1_800_000_000 },
  { fiscal_year: "fy2024", amount: 1_900_000_000 },
  { fiscal_year: "fy2025", amount: 2_000_000_000 },
  { fiscal_year: "fy2026", amount: 2_100_000_000 },
];

const twoYearTrend: TrendPoint[] = [
  { fiscal_year: "fy2025", amount: 900_000_000 },
  { fiscal_year: "fy2026", amount: 950_000_000 },
];

describe("TrendChart", () => {
  it("renders chart with trend data", () => {
    const departments = [
      createMockDepartment("Police", 2_000_000_000, fourYearTrend),
      createMockDepartment("Fire", 950_000_000, twoYearTrend),
    ];

    render(<TrendChart departments={departments} />);
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  it("renders correct number of lines for selected departments", () => {
    const departments = [
      createMockDepartment("Police", 2_000_000_000, fourYearTrend),
      createMockDepartment("Fire", 950_000_000, twoYearTrend),
    ];

    render(<TrendChart departments={departments} maxDefaultSelected={2} />);

    // Both departments selected by default (only 2 departments, maxDefault=2)
    expect(screen.getByTestId("line-Police")).toBeInTheDocument();
    expect(screen.getByTestId("line-Fire")).toBeInTheDocument();
  });

  it("handles departments without trend data gracefully", () => {
    const departments = [
      createMockDepartment("Police", 2_000_000_000, undefined),
      createMockDepartment("Fire", 950_000_000, undefined),
    ];

    render(<TrendChart departments={departments} />);

    // Should show empty state message
    expect(
      screen.getByText("No historical trend data available."),
    ).toBeInTheDocument();
  });

  it("handles mix of departments with and without trends", () => {
    const departments = [
      createMockDepartment("Police", 2_000_000_000, fourYearTrend),
      createMockDepartment("Fire", 950_000_000, undefined),
      createMockDepartment("Streets", 500_000_000, twoYearTrend),
    ];

    render(<TrendChart departments={departments} maxDefaultSelected={5} />);

    // Chart renders for departments with trends
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();

    // Only departments with trends appear as selection buttons
    expect(screen.getByText("Police")).toBeInTheDocument();
    expect(screen.getByText("Streets")).toBeInTheDocument();
    // Fire has no trend data, should not appear as a selectable department button
    const buttons = screen.getAllByRole("button");
    const fireButton = buttons.find((b) => b.textContent === "Fire");
    expect(fireButton).toBeUndefined();
  });

  it("handles single data point trend", () => {
    const singlePointTrend: TrendPoint[] = [
      { fiscal_year: "fy2025", amount: 1_000_000 },
    ];
    const departments = [
      createMockDepartment("Police", 1_000_000, singlePointTrend),
    ];

    render(<TrendChart departments={departments} />);
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    expect(screen.getByTestId("line-Police")).toBeInTheDocument();
  });

  it("defaults to top N departments by amount", () => {
    // Create 6 departments, max default = 3
    const departments = [
      createMockDepartment("Police", 2_000_000_000, fourYearTrend),
      createMockDepartment("Fire", 950_000_000, twoYearTrend),
      createMockDepartment("Streets", 800_000_000, twoYearTrend),
      createMockDepartment("Water", 600_000_000, twoYearTrend),
      createMockDepartment("Parks", 400_000_000, twoYearTrend),
      createMockDepartment("Library", 200_000_000, twoYearTrend),
    ];

    render(<TrendChart departments={departments} maxDefaultSelected={3} />);

    // Top 3 by amount should be selected (have lines)
    expect(screen.getByTestId("line-Police")).toBeInTheDocument();
    expect(screen.getByTestId("line-Fire")).toBeInTheDocument();
    expect(screen.getByTestId("line-Streets")).toBeInTheDocument();

    // Bottom 3 should NOT have lines
    expect(screen.queryByTestId("line-Water")).not.toBeInTheDocument();
    expect(screen.queryByTestId("line-Parks")).not.toBeInTheDocument();
    expect(screen.queryByTestId("line-Library")).not.toBeInTheDocument();
  });

  it("allows toggling departments on and off", async () => {
    const user = userEvent.setup();
    const departments = [
      createMockDepartment("Police", 2_000_000_000, fourYearTrend),
      createMockDepartment("Fire", 950_000_000, twoYearTrend),
    ];

    render(<TrendChart departments={departments} maxDefaultSelected={1} />);

    // Initially only Police is selected (top 1)
    expect(screen.getByTestId("line-Police")).toBeInTheDocument();
    expect(screen.queryByTestId("line-Fire")).not.toBeInTheDocument();

    // Click Fire button to add it
    await user.click(screen.getByText("Fire"));
    expect(screen.getByTestId("line-Fire")).toBeInTheDocument();

    // Click Police button to remove it
    await user.click(screen.getByText("Police"));
    expect(screen.queryByTestId("line-Police")).not.toBeInTheDocument();
  });

  it("renders department selection buttons", () => {
    const departments = [
      createMockDepartment("Police", 2_000_000_000, fourYearTrend),
      createMockDepartment("Fire", 950_000_000, twoYearTrend),
    ];

    render(<TrendChart departments={departments} />);

    expect(
      screen.getByText("Select departments to compare:"),
    ).toBeInTheDocument();
    expect(screen.getByText("Police")).toBeInTheDocument();
    expect(screen.getByText("Fire")).toBeInTheDocument();
  });
});

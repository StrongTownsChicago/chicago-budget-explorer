import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TrendChart from "../TrendChart";
import type { TrendItem } from "../TrendChart";
import type { TrendPoint } from "@/lib/types";

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

function createMockTrendItem(
  name: string,
  amount: number,
  trend?: TrendPoint[],
): TrendItem {
  return {
    id: `item-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    amount,
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
    const items = [
      createMockTrendItem("Police", 2_000_000_000, fourYearTrend),
      createMockTrendItem("Fire", 950_000_000, twoYearTrend),
    ];

    render(<TrendChart items={items} />);
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  it("renders correct number of lines for selected items", () => {
    const items = [
      createMockTrendItem("Police", 2_000_000_000, fourYearTrend),
      createMockTrendItem("Fire", 950_000_000, twoYearTrend),
    ];

    render(<TrendChart items={items} maxDefaultSelected={2} />);

    // Both items selected by default (only 2 items, maxDefault=2)
    expect(screen.getByTestId("line-Police")).toBeInTheDocument();
    expect(screen.getByTestId("line-Fire")).toBeInTheDocument();
  });

  it("handles items without trend data gracefully", () => {
    const items = [
      createMockTrendItem("Police", 2_000_000_000, undefined),
      createMockTrendItem("Fire", 950_000_000, undefined),
    ];

    render(<TrendChart items={items} />);

    // Should show empty state message
    expect(
      screen.getByText("No historical trend data available."),
    ).toBeInTheDocument();
  });

  it("handles mix of items with and without trends", () => {
    const items = [
      createMockTrendItem("Police", 2_000_000_000, fourYearTrend),
      createMockTrendItem("Fire", 950_000_000, undefined),
      createMockTrendItem("Streets", 500_000_000, twoYearTrend),
    ];

    render(<TrendChart items={items} maxDefaultSelected={5} />);

    // Chart renders for items with trends
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();

    // Only items with trends appear as selection buttons
    expect(screen.getByText("Police")).toBeInTheDocument();
    expect(screen.getByText("Streets")).toBeInTheDocument();
    // Fire has no trend data, should not appear as a selectable button
    const buttons = screen.getAllByRole("button");
    const fireButton = buttons.find((b) => b.textContent === "Fire");
    expect(fireButton).toBeUndefined();
  });

  it("handles single data point trend", () => {
    const singlePointTrend: TrendPoint[] = [
      { fiscal_year: "fy2025", amount: 1_000_000 },
    ];
    const items = [
      createMockTrendItem("Police", 1_000_000, singlePointTrend),
    ];

    render(<TrendChart items={items} />);
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    expect(screen.getByTestId("line-Police")).toBeInTheDocument();
  });

  it("defaults to top N items by amount", () => {
    // Create 6 items, max default = 3
    const items = [
      createMockTrendItem("Police", 2_000_000_000, fourYearTrend),
      createMockTrendItem("Fire", 950_000_000, twoYearTrend),
      createMockTrendItem("Streets", 800_000_000, twoYearTrend),
      createMockTrendItem("Water", 600_000_000, twoYearTrend),
      createMockTrendItem("Parks", 400_000_000, twoYearTrend),
      createMockTrendItem("Library", 200_000_000, twoYearTrend),
    ];

    render(<TrendChart items={items} maxDefaultSelected={3} />);

    // Top 3 by amount should be selected (have lines)
    expect(screen.getByTestId("line-Police")).toBeInTheDocument();
    expect(screen.getByTestId("line-Fire")).toBeInTheDocument();
    expect(screen.getByTestId("line-Streets")).toBeInTheDocument();

    // Bottom 3 should NOT have lines
    expect(screen.queryByTestId("line-Water")).not.toBeInTheDocument();
    expect(screen.queryByTestId("line-Parks")).not.toBeInTheDocument();
    expect(screen.queryByTestId("line-Library")).not.toBeInTheDocument();
  });

  it("allows toggling items on and off", async () => {
    const user = userEvent.setup();
    const items = [
      createMockTrendItem("Police", 2_000_000_000, fourYearTrend),
      createMockTrendItem("Fire", 950_000_000, twoYearTrend),
    ];

    render(<TrendChart items={items} maxDefaultSelected={1} />);

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

  it("renders default label as departments", () => {
    const items = [
      createMockTrendItem("Police", 2_000_000_000, fourYearTrend),
      createMockTrendItem("Fire", 950_000_000, twoYearTrend),
    ];

    render(<TrendChart items={items} />);

    expect(
      screen.getByText("Select departments to compare:"),
    ).toBeInTheDocument();
  });

  it("renders custom label", () => {
    const items = [
      createMockTrendItem("Property Tax", 1_500_000_000, fourYearTrend),
      createMockTrendItem("Sales Tax", 800_000_000, twoYearTrend),
    ];

    render(<TrendChart items={items} label="revenue sources" />);

    expect(
      screen.getByText("Select revenue sources to compare:"),
    ).toBeInTheDocument();
  });
});

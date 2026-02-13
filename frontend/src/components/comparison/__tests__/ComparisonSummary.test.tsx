import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ComparisonSummary from "../ComparisonSummary";
import type { ComparisonSummary as ComparisonSummaryType } from "@/lib/comparison-engine";

function createMockSummary(
  overrides?: Partial<ComparisonSummaryType>,
): ComparisonSummaryType {
  return {
    baseYear: "fy2024",
    targetYear: "fy2026",
    baseYearLabel: "FY2024",
    targetYearLabel: "FY2026",
    totalAppropriations: {
      id: "total-appropriations",
      name: "Total Appropriations",
      baseAmount: 18_000_000_000,
      targetAmount: 18_800_000_000,
      delta: 800_000_000,
      deltaPct: 4.44,
      status: "common",
    },
    grossAppropriations: {
      id: "gross-appropriations",
      name: "Gross Appropriations",
      baseAmount: 18_500_000_000,
      targetAmount: 19_300_000_000,
      delta: 800_000_000,
      deltaPct: 4.32,
      status: "common",
    },
    totalRevenue: {
      id: "total-revenue",
      name: "Total Revenue",
      baseAmount: 13_000_000_000,
      targetAmount: 14_600_000_000,
      delta: 1_600_000_000,
      deltaPct: 12.31,
      status: "common",
    },
    operatingAppropriations: {
      id: "operating-appropriations",
      name: "Operating Appropriations",
      baseAmount: 10_000_000_000,
      targetAmount: 10_500_000_000,
      delta: 500_000_000,
      deltaPct: 5.0,
      status: "common",
    },
    fundCategoryBreakdown: [
      {
        id: "fund-enterprise",
        name: "Enterprise",
        baseAmount: 5_000_000_000,
        targetAmount: 5_500_000_000,
        delta: 500_000_000,
        deltaPct: 10.0,
        status: "common",
      },
      {
        id: "fund-operating",
        name: "Operating",
        baseAmount: 10_000_000_000,
        targetAmount: 10_500_000_000,
        delta: 500_000_000,
        deltaPct: 5.0,
        status: "common",
      },
      {
        id: "fund-pension",
        name: "Pension",
        baseAmount: 3_000_000_000,
        targetAmount: 2_800_000_000,
        delta: -200_000_000,
        deltaPct: -6.67,
        status: "common",
      },
    ],
    ...overrides,
  };
}

describe("ComparisonSummary", () => {
  it("displays base and target year labels", () => {
    render(<ComparisonSummary summary={createMockSummary()} />);

    expect(screen.getAllByText("FY2024").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FY2026").length).toBeGreaterThan(0);
  });

  it("displays total appropriations with delta", () => {
    render(<ComparisonSummary summary={createMockSummary()} />);

    expect(screen.getByText("Total Appropriations")).toBeInTheDocument();
    // Both base and target amounts should appear
    expect(screen.getAllByText("$18.0B").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$18.8B").length).toBeGreaterThan(0);
  });

  it("color-codes positive deltas as green", () => {
    const { container } = render(
      <ComparisonSummary summary={createMockSummary()} />,
    );

    // Find elements with green color class (positive delta)
    const greenElements = container.querySelectorAll(".text-green-700");
    expect(greenElements.length).toBeGreaterThan(0);
  });

  it("color-codes negative deltas as red", () => {
    const summary = createMockSummary({
      totalAppropriations: {
        id: "total-appropriations",
        name: "Total Appropriations",
        baseAmount: 18_800_000_000,
        targetAmount: 18_000_000_000,
        delta: -800_000_000,
        deltaPct: -4.26,
        status: "common",
      },
    });

    const { container } = render(<ComparisonSummary summary={summary} />);

    const redElements = container.querySelectorAll(".text-red-700");
    expect(redElements.length).toBeGreaterThan(0);
  });

  it("displays revenue comparison when available", () => {
    render(<ComparisonSummary summary={createMockSummary()} />);

    expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    expect(screen.queryByTestId("no-revenue")).not.toBeInTheDocument();
  });

  it("hides revenue when comparison is null", () => {
    const summary = createMockSummary({ totalRevenue: null });

    render(<ComparisonSummary summary={summary} />);

    expect(screen.queryByText("Total Revenue")).not.toBeInTheDocument();
    expect(screen.getByTestId("no-revenue")).toBeInTheDocument();
  });

  it("displays fund category breakdown", () => {
    render(<ComparisonSummary summary={createMockSummary()} />);

    const table = screen.getByTestId("fund-category-table");
    expect(table).toBeInTheDocument();

    expect(screen.getByText("Enterprise")).toBeInTheDocument();
    expect(screen.getByText("Operating")).toBeInTheDocument();
    expect(screen.getByText("Pension")).toBeInTheDocument();
  });
});

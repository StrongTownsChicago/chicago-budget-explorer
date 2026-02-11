import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LineItemTrend from "../LineItemTrend";
import type { Subcategory, TrendPoint } from "@/lib/types";

// Mock TrendChart to avoid rendering actual recharts
vi.mock("@/components/charts/TrendChart", () => ({
  default: ({ items, label }: { items: { id: string; name: string }[]; label?: string }) => (
    <div data-testid="trend-chart">
      <span data-testid="trend-chart-label">{label}</span>
      {items.map((item) => (
        <span key={item.id} data-testid={`trend-item-${item.id}`}>
          {item.name}
        </span>
      ))}
    </div>
  ),
}));

function createSubcategory(
  id: string,
  name: string,
  amount: number,
  trend?: TrendPoint[],
): Subcategory {
  return { id, name, amount, trend };
}

const twoYearTrend: TrendPoint[] = [
  { fiscal_year: "fy2024", amount: 100_000_000 },
  { fiscal_year: "fy2025", amount: 110_000_000 },
];

const threeYearTrend: TrendPoint[] = [
  { fiscal_year: "fy2023", amount: 90_000_000 },
  { fiscal_year: "fy2024", amount: 100_000_000 },
  { fiscal_year: "fy2025", amount: 110_000_000 },
];

describe("LineItemTrend", () => {
  it("renders subcategory trend chart when subcategories have trend data", () => {
    const subcategories = [
      createSubcategory("police-salaries", "Salaries", 150_000_000, threeYearTrend),
      createSubcategory("police-overtime", "Overtime", 50_000_000, twoYearTrend),
    ];

    render(
      <LineItemTrend
        parentName="Chicago Police Department"
        subcategories={subcategories}
      />,
    );

    expect(screen.getByTestId("trend-chart")).toBeInTheDocument();
    expect(screen.getByTestId("trend-item-police-salaries")).toBeInTheDocument();
    expect(screen.getByTestId("trend-item-police-overtime")).toBeInTheDocument();
  });

  it("filters out subcategories without trend data", () => {
    const subcategories = [
      createSubcategory("police-salaries", "Salaries", 150_000_000, twoYearTrend),
      createSubcategory("police-overtime", "Overtime", 50_000_000, undefined),
      createSubcategory("police-equipment", "Equipment", 30_000_000, twoYearTrend),
    ];

    render(
      <LineItemTrend
        parentName="Chicago Police Department"
        subcategories={subcategories}
      />,
    );

    // Only subcategories with trends are passed to TrendChart
    expect(screen.getByTestId("trend-item-police-salaries")).toBeInTheDocument();
    expect(screen.getByTestId("trend-item-police-equipment")).toBeInTheDocument();
    expect(screen.queryByTestId("trend-item-police-overtime")).not.toBeInTheDocument();
  });

  it("renders nothing when no subcategories have trends", () => {
    const subcategories = [
      createSubcategory("police-salaries", "Salaries", 150_000_000, undefined),
      createSubcategory("police-overtime", "Overtime", 50_000_000, undefined),
    ];

    const { container } = render(
      <LineItemTrend
        parentName="Chicago Police Department"
        subcategories={subcategories}
      />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when subcategories have single-point trends", () => {
    const singlePointTrend: TrendPoint[] = [
      { fiscal_year: "fy2025", amount: 100_000_000 },
    ];

    const subcategories = [
      createSubcategory("police-salaries", "Salaries", 150_000_000, singlePointTrend),
    ];

    const { container } = render(
      <LineItemTrend
        parentName="Chicago Police Department"
        subcategories={subcategories}
      />,
    );

    // Single-point trends are filtered out (need 2+ for useful trend)
    expect(container.innerHTML).toBe("");
  });

  it("shows parent name in heading", () => {
    const subcategories = [
      createSubcategory("police-salaries", "Salaries", 150_000_000, twoYearTrend),
    ];

    render(
      <LineItemTrend
        parentName="Chicago Police Department"
        subcategories={subcategories}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /Chicago Police Department/i }),
    ).toBeInTheDocument();
  });

  it("passes correct label to TrendChart", () => {
    const subcategories = [
      createSubcategory("police-salaries", "Salaries", 150_000_000, twoYearTrend),
    ];

    render(
      <LineItemTrend
        parentName="Chicago Police Department"
        subcategories={subcategories}
        label="line items"
      />,
    );

    expect(screen.getByTestId("trend-chart-label")).toHaveTextContent("line items");
  });

  it("uses default label when not specified", () => {
    const subcategories = [
      createSubcategory("police-salaries", "Salaries", 150_000_000, twoYearTrend),
    ];

    render(
      <LineItemTrend
        parentName="Chicago Police Department"
        subcategories={subcategories}
      />,
    );

    expect(screen.getByTestId("trend-chart-label")).toHaveTextContent("line items");
  });
});

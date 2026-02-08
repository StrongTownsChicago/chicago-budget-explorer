import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import RevenueBreakdown from "../RevenueBreakdown";
import type { RevenueSource } from "@/lib/types";

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

const mockSources: RevenueSource[] = [
  {
    id: "revenue-property-tax",
    name: "Property Tax",
    amount: 1500000000,
    subcategories: [],
    fund_breakdown: [],
  },
  {
    id: "revenue-sales-tax",
    name: "Sales Tax",
    amount: 800000000,
    subcategories: [],
    fund_breakdown: [],
  },
  {
    id: "revenue-utility-tax",
    name: "Utility Taxes",
    amount: 300000000,
    subcategories: [],
    fund_breakdown: [],
  },
];

const totalRevenue = 2600000000;

describe("RevenueBreakdown", () => {
  it("renders chart container", () => {
    render(
      <RevenueBreakdown sources={mockSources} totalRevenue={totalRevenue} />
    );
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("renders table with all revenue sources", () => {
    render(
      <RevenueBreakdown sources={mockSources} totalRevenue={totalRevenue} />
    );
    expect(screen.getByText("Property Tax")).toBeInTheDocument();
    expect(screen.getByText("Sales Tax")).toBeInTheDocument();
    expect(screen.getByText("Utility Taxes")).toBeInTheDocument();
  });

  it("renders total revenue in table footer", () => {
    render(
      <RevenueBreakdown sources={mockSources} totalRevenue={totalRevenue} />
    );
    expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    expect(screen.getByText("$2.6B")).toBeInTheDocument();
  });

  it("displays percentage for each source", () => {
    render(
      <RevenueBreakdown sources={mockSources} totalRevenue={totalRevenue} />
    );
    // Property Tax: 1.5B / 2.6B = 57.7%
    expect(screen.getByText("57.7%")).toBeInTheDocument();
  });

  it("handles empty sources gracefully", () => {
    render(<RevenueBreakdown sources={[]} totalRevenue={0} />);
    expect(screen.getByText("Total Revenue")).toBeInTheDocument();
  });

  it("has accessible table structure", () => {
    render(
      <RevenueBreakdown sources={mockSources} totalRevenue={totalRevenue} />
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Revenue Source")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("% of Total")).toBeInTheDocument();
  });
});

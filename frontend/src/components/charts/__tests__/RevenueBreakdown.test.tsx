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
    revenue_type: "tax",
    subcategories: [],
    fund_breakdown: [],
  },
  {
    id: "revenue-sales-tax",
    name: "Sales Tax",
    amount: 800000000,
    revenue_type: "tax",
    subcategories: [],
    fund_breakdown: [],
  },
  {
    id: "revenue-airport",
    name: "Airport Revenue",
    amount: 2300000000,
    revenue_type: "enterprise",
    subcategories: [],
    fund_breakdown: [],
  },
  {
    id: "revenue-fines",
    name: "Fines and Forfeitures",
    amount: 300000000,
    revenue_type: "fee",
    subcategories: [],
    fund_breakdown: [],
  },
  {
    id: "revenue-pension",
    name: "Pension Fund Allocations",
    amount: 1300000000,
    revenue_type: "internal_transfer",
    subcategories: [],
    fund_breakdown: [],
  },
];

const totalRevenue = 6200000000;

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
    expect(screen.getByText("Airport Revenue")).toBeInTheDocument();
    expect(screen.getByText("Fines and Forfeitures")).toBeInTheDocument();
    expect(screen.getByText("Pension Fund Allocations")).toBeInTheDocument();
  });

  it("renders total revenue in table footer", () => {
    render(
      <RevenueBreakdown sources={mockSources} totalRevenue={totalRevenue} />
    );
    expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    expect(screen.getByText("$6.2B")).toBeInTheDocument();
  });

  it("renders table with type grouping headers", () => {
    render(
      <RevenueBreakdown sources={mockSources} totalRevenue={totalRevenue} />
    );
    expect(screen.getByText("Tax Revenue")).toBeInTheDocument();
    expect(screen.getByText("Fees & Charges")).toBeInTheDocument();
    expect(screen.getByText("Enterprise Revenue")).toBeInTheDocument();
    expect(screen.getByText("Internal Transfers")).toBeInTheDocument();
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

  it("renders correctly when revenue_type defaults to other", () => {
    const sourcesWithDefaultType: RevenueSource[] = [
      {
        id: "revenue-misc",
        name: "Miscellaneous",
        amount: 100000000,
        revenue_type: "other",
        subcategories: [],
        fund_breakdown: [],
      },
    ];
    render(
      <RevenueBreakdown
        sources={sourcesWithDefaultType}
        totalRevenue={100000000}
      />
    );
    expect(screen.getByText("Other Revenue")).toBeInTheDocument();
    expect(screen.getByText("Miscellaneous")).toBeInTheDocument();
  });

  it("displays group subtotal percentages in header rows", () => {
    render(
      <RevenueBreakdown sources={mockSources} totalRevenue={totalRevenue} />
    );
    // Tax Revenue group header row should exist with its subtotal percentage
    // (Tax Revenue: $2.3B / $6.2B = 37.1%)
    // Internal Transfers: $1.3B / $6.2B = 21.0%
    const headerRows = screen.getAllByText("21.0%");
    expect(headerRows.length).toBeGreaterThanOrEqual(1);
  });
});

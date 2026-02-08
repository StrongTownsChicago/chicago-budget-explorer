import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import RevenueVsSpending from "../RevenueVsSpending";

// Mock recharts
vi.mock("recharts", () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

describe("RevenueVsSpending", () => {
  it("renders chart container", () => {
    render(
      <RevenueVsSpending
        totalRevenue={5000000000}
        totalAppropriations={6000000000}
      />
    );
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("displays local revenue amount", () => {
    render(
      <RevenueVsSpending
        totalRevenue={5000000000}
        totalAppropriations={6000000000}
      />
    );
    expect(screen.getByText("Local Revenue")).toBeInTheDocument();
    expect(screen.getByText("$5.0B")).toBeInTheDocument();
  });

  it("displays total spending amount", () => {
    render(
      <RevenueVsSpending
        totalRevenue={5000000000}
        totalAppropriations={6000000000}
      />
    );
    expect(screen.getByText("Total Spending")).toBeInTheDocument();
    expect(screen.getByText("$6.0B")).toBeInTheDocument();
  });

  it("shows deficit when spending exceeds revenue", () => {
    render(
      <RevenueVsSpending
        totalRevenue={5000000000}
        totalAppropriations={6000000000}
      />
    );
    expect(screen.getByText("Deficit")).toBeInTheDocument();
    expect(screen.getByText("$1.0B")).toBeInTheDocument();
  });

  it("shows surplus when revenue exceeds spending", () => {
    render(
      <RevenueVsSpending
        totalRevenue={7000000000}
        totalAppropriations={6000000000}
      />
    );
    expect(screen.getByText("Surplus")).toBeInTheDocument();
    expect(screen.getByText("$1.0B")).toBeInTheDocument();
  });

  it("includes explanatory note", () => {
    render(
      <RevenueVsSpending
        totalRevenue={5000000000}
        totalAppropriations={6000000000}
      />
    );
    expect(
      screen.getByText(/Local revenue covers locally-generated funds/)
    ).toBeInTheDocument();
  });
});

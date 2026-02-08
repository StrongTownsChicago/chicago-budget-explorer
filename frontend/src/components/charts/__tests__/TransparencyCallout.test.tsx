import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TransparencyCallout from "../TransparencyCallout";

describe("TransparencyCallout", () => {
  it("renders when grant revenue is estimated", () => {
    render(
      <TransparencyCallout
        localRevenue={5000000000}
        grantRevenueEstimated={2500000000}
        totalBudget={16000000000}
      />
    );
    expect(screen.getByText("About the Revenue Data")).toBeInTheDocument();
    expect(screen.getByText(/local funds only/)).toBeInTheDocument();
  });

  it("shows grant revenue amount", () => {
    render(
      <TransparencyCallout
        localRevenue={5000000000}
        grantRevenueEstimated={2500000000}
        totalBudget={16000000000}
      />
    );
    expect(screen.getByText(/\$2\.5B/)).toBeInTheDocument();
  });

  it("shows grant revenue percentage", () => {
    render(
      <TransparencyCallout
        localRevenue={5000000000}
        grantRevenueEstimated={2500000000}
        totalBudget={16000000000}
      />
    );
    // 2.5B / 16B = 15.6%
    expect(screen.getByText(/15\.6%/)).toBeInTheDocument();
  });

  it("shows total budget amount", () => {
    render(
      <TransparencyCallout
        localRevenue={5000000000}
        grantRevenueEstimated={2500000000}
        totalBudget={16000000000}
      />
    );
    expect(screen.getByText(/\$16\.0B/)).toBeInTheDocument();
  });

  it("does not render when grant revenue is null", () => {
    const { container } = render(
      <TransparencyCallout
        localRevenue={5000000000}
        grantRevenueEstimated={null}
        totalBudget={16000000000}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("does not render when grant revenue is zero", () => {
    const { container } = render(
      <TransparencyCallout
        localRevenue={5000000000}
        grantRevenueEstimated={0}
        totalBudget={16000000000}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("has accessible role attribute", () => {
    render(
      <TransparencyCallout
        localRevenue={5000000000}
        grantRevenueEstimated={2500000000}
        totalBudget={16000000000}
      />
    );
    expect(screen.getByRole("note")).toBeInTheDocument();
  });
});

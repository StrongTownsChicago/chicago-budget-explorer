import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import YearPairSelector from "../YearPairSelector";

describe("YearPairSelector", () => {
  const defaultProps = {
    availableYears: ["fy2026", "fy2025", "fy2024", "fy2023"],
    baseYear: "fy2025",
    targetYear: "fy2026",
    onBaseYearChange: vi.fn(),
    onTargetYearChange: vi.fn(),
  };

  it("renders two year dropdowns with correct labels", () => {
    render(<YearPairSelector {...defaultProps} />);

    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
  });

  it("calls onBaseYearChange when base year dropdown changes", async () => {
    const onBaseYearChange = vi.fn();
    const user = userEvent.setup();

    render(
      <YearPairSelector {...defaultProps} onBaseYearChange={onBaseYearChange} />,
    );

    const baseSelect = screen.getByTestId("base-year-select");
    await user.selectOptions(baseSelect, "fy2024");

    expect(onBaseYearChange).toHaveBeenCalledWith("fy2024");
  });

  it("calls onTargetYearChange when target year dropdown changes", async () => {
    const onTargetYearChange = vi.fn();
    const user = userEvent.setup();

    render(
      <YearPairSelector
        {...defaultProps}
        onTargetYearChange={onTargetYearChange}
      />,
    );

    const targetSelect = screen.getByTestId("target-year-select");
    await user.selectOptions(targetSelect, "fy2024");

    expect(onTargetYearChange).toHaveBeenCalledWith("fy2024");
  });

  it("disables base year option in target dropdown", () => {
    render(<YearPairSelector {...defaultProps} />);

    const targetSelect = screen.getByTestId("target-year-select");
    const options = targetSelect.querySelectorAll("option");

    const baseYearOption = Array.from(options).find(
      (opt) => opt.value === defaultProps.baseYear,
    );
    expect(baseYearOption?.disabled).toBe(true);
  });

  it("disables target year option in base dropdown", () => {
    render(<YearPairSelector {...defaultProps} />);

    const baseSelect = screen.getByTestId("base-year-select");
    const options = baseSelect.querySelectorAll("option");

    const targetYearOption = Array.from(options).find(
      (opt) => opt.value === defaultProps.targetYear,
    );
    expect(targetYearOption?.disabled).toBe(true);
  });

  it("swaps years when swap button is clicked", async () => {
    const onBaseYearChange = vi.fn();
    const onTargetYearChange = vi.fn();
    const user = userEvent.setup();

    render(
      <YearPairSelector
        {...defaultProps}
        onBaseYearChange={onBaseYearChange}
        onTargetYearChange={onTargetYearChange}
      />,
    );

    const swapButton = screen.getByTestId("swap-years-button");
    await user.click(swapButton);

    expect(onBaseYearChange).toHaveBeenCalledWith("fy2026");
    expect(onTargetYearChange).toHaveBeenCalledWith("fy2025");
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import YearSelector from "../YearSelector";

describe("YearSelector", () => {
  const defaultProps = {
    availableYears: ["fy2025", "fy2024", "fy2023"],
    defaultYear: "fy2025",
    onYearChange: vi.fn(),
  };

  it("renders with all available years", () => {
    render(<YearSelector {...defaultProps} />);

    const select = screen.getByRole("combobox", { name: /fiscal year/i });
    expect(select).toBeInTheDocument();

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent("FY2025");
    expect(options[1]).toHaveTextContent("FY2024");
    expect(options[2]).toHaveTextContent("FY2023");
  });

  it("defaults to the specified default year", () => {
    render(<YearSelector {...defaultProps} />);

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("fy2025");
  });

  it("formats year labels correctly (lowercase to uppercase)", () => {
    render(<YearSelector {...defaultProps} />);

    const options = screen.getAllByRole("option");
    options.forEach((option) => {
      expect(option.textContent).toMatch(/^FY\d{4}$/);
    });
  });

  it("calls onYearChange when a different year is selected", async () => {
    const user = userEvent.setup();
    const onYearChange = vi.fn();

    render(<YearSelector {...defaultProps} onYearChange={onYearChange} />);

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "fy2024");

    expect(onYearChange).toHaveBeenCalledTimes(1);
    expect(onYearChange).toHaveBeenCalledWith("fy2024");
  });

  it("updates selected value when user changes selection", async () => {
    const user = userEvent.setup();

    render(<YearSelector {...defaultProps} />);

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("fy2025");

    await user.selectOptions(select, "fy2023");
    expect(select.value).toBe("fy2023");
  });

  it("renders with accessible label", () => {
    render(<YearSelector {...defaultProps} />);

    const label = screen.getByText(/fiscal year/i);
    const select = screen.getByRole("combobox");

    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute("for", "year-selector");
    expect(select).toHaveAttribute("id", "year-selector");
  });

  it("handles single year without errors", () => {
    render(
      <YearSelector
        availableYears={["fy2025"]}
        defaultYear="fy2025"
        onYearChange={vi.fn()}
      />
    );

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("FY2025");
  });

  it("applies proper styling classes", () => {
    render(<YearSelector {...defaultProps} />);

    const select = screen.getByRole("combobox");
    expect(select.className).toContain("px-4");
    expect(select.className).toContain("py-2");
    expect(select.className).toContain("border");
    expect(select.className).toContain("rounded-lg");
  });
});

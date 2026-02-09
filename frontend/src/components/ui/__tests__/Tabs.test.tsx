import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Tabs from "../Tabs";
import type { Tab } from "../Tabs";

const createTabs = (): Tab[] => [
  { id: "spending", label: "Spending", content: <div data-testid="content-spending">Spending Content</div> },
  { id: "revenue", label: "Revenue", content: <div data-testid="content-revenue">Revenue Content</div> },
  { id: "trends", label: "Trends", content: <div data-testid="content-trends">Trends Content</div> },
];

describe("Tabs", () => {
  it("renders all tab buttons", () => {
    render(<Tabs tabs={createTabs()} />);

    const tabButtons = screen.getAllByRole("tab");
    expect(tabButtons).toHaveLength(3);
    expect(tabButtons[0]).toHaveTextContent("Spending");
    expect(tabButtons[1]).toHaveTextContent("Revenue");
    expect(tabButtons[2]).toHaveTextContent("Trends");
  });

  it("first tab is active by default", () => {
    render(<Tabs tabs={createTabs()} />);

    const spendingTab = screen.getByRole("tab", { name: "Spending" });
    expect(spendingTab).toHaveAttribute("aria-selected", "true");

    const spendingPanel = screen.getByRole("tabpanel", { hidden: false });
    expect(spendingPanel).not.toHaveAttribute("hidden");
    expect(spendingPanel).toHaveAttribute("id", "panel-spending");
  });

  it("custom defaultTab sets initial active tab", () => {
    render(<Tabs tabs={createTabs()} defaultTab="revenue" />);

    const revenueTab = screen.getByRole("tab", { name: "Revenue" });
    expect(revenueTab).toHaveAttribute("aria-selected", "true");

    const spendingTab = screen.getByRole("tab", { name: "Spending" });
    expect(spendingTab).toHaveAttribute("aria-selected", "false");
  });

  it("clicking a tab switches the active panel", async () => {
    const user = userEvent.setup();
    render(<Tabs tabs={createTabs()} />);

    // Initially spending is active
    expect(screen.getByRole("tab", { name: "Spending" })).toHaveAttribute("aria-selected", "true");

    // Click Revenue tab
    await user.click(screen.getByRole("tab", { name: "Revenue" }));

    expect(screen.getByRole("tab", { name: "Revenue" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Spending" })).toHaveAttribute("aria-selected", "false");

    // Revenue panel is visible
    const visiblePanel = screen.getByRole("tabpanel", { hidden: false });
    expect(visiblePanel).toHaveAttribute("id", "panel-revenue");
  });

  it("ARIA attributes are correctly set", () => {
    render(<Tabs tabs={createTabs()} />);

    // Tablist
    expect(screen.getByRole("tablist")).toBeInTheDocument();

    // Tab buttons
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("id", "tab-spending");
    expect(tabs[0]).toHaveAttribute("aria-controls", "panel-spending");
    expect(tabs[1]).toHaveAttribute("id", "tab-revenue");
    expect(tabs[1]).toHaveAttribute("aria-controls", "panel-revenue");
    expect(tabs[2]).toHaveAttribute("id", "tab-trends");
    expect(tabs[2]).toHaveAttribute("aria-controls", "panel-trends");

    // Panels
    const panels = screen.getAllByRole("tabpanel", { hidden: true });
    expect(panels).toHaveLength(3);
    expect(panels[0]).toHaveAttribute("id", "panel-spending");
    expect(panels[0]).toHaveAttribute("aria-labelledby", "tab-spending");
    expect(panels[1]).toHaveAttribute("id", "panel-revenue");
    expect(panels[1]).toHaveAttribute("aria-labelledby", "tab-revenue");
    expect(panels[2]).toHaveAttribute("id", "panel-trends");
    expect(panels[2]).toHaveAttribute("aria-labelledby", "tab-trends");
  });

  it("ArrowRight moves to next tab", async () => {
    const user = userEvent.setup();
    render(<Tabs tabs={createTabs()} />);

    // Focus on Spending tab
    const spendingTab = screen.getByRole("tab", { name: "Spending" });
    spendingTab.focus();

    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "Revenue" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Revenue" })).toHaveFocus();
  });

  it("ArrowLeft moves to previous tab", async () => {
    const user = userEvent.setup();
    render(<Tabs tabs={createTabs()} defaultTab="revenue" />);

    const revenueTab = screen.getByRole("tab", { name: "Revenue" });
    revenueTab.focus();

    await user.keyboard("{ArrowLeft}");

    expect(screen.getByRole("tab", { name: "Spending" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Spending" })).toHaveFocus();
  });

  it("ArrowRight on last tab wraps to first", async () => {
    const user = userEvent.setup();
    render(<Tabs tabs={createTabs()} defaultTab="trends" />);

    const trendsTab = screen.getByRole("tab", { name: "Trends" });
    trendsTab.focus();

    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "Spending" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Spending" })).toHaveFocus();
  });

  it("ArrowLeft on first tab wraps to last", async () => {
    const user = userEvent.setup();
    render(<Tabs tabs={createTabs()} />);

    const spendingTab = screen.getByRole("tab", { name: "Spending" });
    spendingTab.focus();

    await user.keyboard("{ArrowLeft}");

    expect(screen.getByRole("tab", { name: "Trends" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Trends" })).toHaveFocus();
  });

  it("Home key activates first tab", async () => {
    const user = userEvent.setup();
    render(<Tabs tabs={createTabs()} defaultTab="trends" />);

    const trendsTab = screen.getByRole("tab", { name: "Trends" });
    trendsTab.focus();

    await user.keyboard("{Home}");

    expect(screen.getByRole("tab", { name: "Spending" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Spending" })).toHaveFocus();
  });

  it("End key activates last tab", async () => {
    const user = userEvent.setup();
    render(<Tabs tabs={createTabs()} />);

    const spendingTab = screen.getByRole("tab", { name: "Spending" });
    spendingTab.focus();

    await user.keyboard("{End}");

    expect(screen.getByRole("tab", { name: "Trends" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Trends" })).toHaveFocus();
  });

  it("inactive panels have hidden attribute", () => {
    render(<Tabs tabs={createTabs()} />);

    const allPanels = screen.getAllByRole("tabpanel", { hidden: true });
    const visiblePanels = allPanels.filter((panel) => !panel.hidden);
    const hiddenPanels = allPanels.filter((panel) => panel.hidden);

    expect(visiblePanels).toHaveLength(1);
    expect(hiddenPanels).toHaveLength(2);
    expect(visiblePanels[0]).toHaveAttribute("id", "panel-spending");
  });

  it("single tab renders correctly", () => {
    const singleTab: Tab[] = [
      { id: "only", label: "Only Tab", content: <div>Only Content</div> },
    ];

    render(<Tabs tabs={singleTab} />);

    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Only Tab" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { hidden: false })).not.toHaveAttribute("hidden");
  });

  it("invalid defaultTab falls back to first tab", () => {
    render(<Tabs tabs={createTabs()} defaultTab="nonexistent" />);

    expect(screen.getByRole("tab", { name: "Spending" })).toHaveAttribute("aria-selected", "true");
  });

  it("tab content is rendered in panels", () => {
    render(<Tabs tabs={createTabs()} />);

    // Active panel content is visible
    expect(screen.getByTestId("content-spending")).toBeInTheDocument();

    // Hidden panel content is in DOM but hidden
    expect(screen.getByTestId("content-revenue")).toBeInTheDocument();
    expect(screen.getByTestId("content-trends")).toBeInTheDocument();
  });

  it("renders nothing when tabs array is empty", () => {
    const { container } = render(<Tabs tabs={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("inactive tabs have tabIndex -1", () => {
    render(<Tabs tabs={createTabs()} />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("tabindex", "0"); // active
    expect(tabs[1]).toHaveAttribute("tabindex", "-1"); // inactive
    expect(tabs[2]).toHaveAttribute("tabindex", "-1"); // inactive
  });
});

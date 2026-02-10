import { useState, useCallback, useRef } from "react";
import type { BudgetData } from "@/lib/types";
import {
  createSimulation,
  adjustSubcategory,
  adjustRevenueSubcategory,
} from "@/lib/simulation-engine";
import { formatCurrency } from "@/lib/format";
import YearSelector from "@/components/ui/YearSelector";
import BudgetBalance from "./BudgetBalance";
import DepartmentAccordion from "./DepartmentAccordion";
import RevenueSourceAccordion from "./RevenueSourceAccordion";
import ResetButton from "./ResetButton";
import ImpactSummary from "./ImpactSummary";

type SimulatorTab = "expenses" | "revenue";

export interface Props {
  /** Budget data for all available years */
  budgetDataByYear: Record<string, BudgetData>;
  /** Available fiscal years (sorted newest first) */
  availableYears: string[];
  /** Default fiscal year to simulate */
  defaultYear: string;
}

/**
 * Main simulator panel managing simulation state and rendering all controls.
 * Supports year selection to simulate different fiscal year budgets.
 * Uses tabbed interface: Expenses tab (departments) and Revenue tab (revenue sources).
 * Both tabs share the same SimulationState for unified balance calculation.
 */
export default function SimulatorPanel({
  budgetDataByYear,
  availableYears,
  defaultYear,
}: Props) {
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const data = budgetDataByYear[selectedYear];
  const departments = data.appropriations.by_department;
  const revenueSources = data.revenue?.by_source ?? [];
  const hasRevenue = data.revenue != null && revenueSources.length > 0;

  const [state, setState] = useState(() => createSimulation(data));
  const [activeTab, setActiveTab] = useState<SimulatorTab>("expenses");
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [expandedSources, setExpandedSources] = useState<Set<string>>(
    new Set(),
  );
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // If revenue tab is active but revenue data is gone (year change), fall back
  const resolvedTab =
    activeTab === "revenue" && !hasRevenue ? "expenses" : activeTab;

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    setState(createSimulation(budgetDataByYear[year]));
  };

  const handleAdjustSubcategory = useCallback(
    (subcategoryId: string, multiplier: number) => {
      setState((prev) =>
        adjustSubcategory(prev, departments, subcategoryId, multiplier),
      );
    },
    [departments],
  );

  const handleAdjustRevenueSubcategory = useCallback(
    (subcategoryId: string, multiplier: number) => {
      setState((prev) =>
        adjustRevenueSubcategory(
          prev,
          revenueSources,
          subcategoryId,
          multiplier,
        ),
      );
    },
    [revenueSources],
  );

  const handleToggleDept = useCallback((deptId: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) {
        next.delete(deptId);
      } else {
        next.add(deptId);
      }
      return next;
    });
  }, []);

  const handleToggleSource = useCallback((sourceId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  }, []);

  const handleReset = () => {
    // Reset simulation state only; keep accordions open so user sees values snap back
    setState(createSimulation(budgetDataByYear[selectedYear]));
  };

  const tabs: Array<{ id: SimulatorTab; label: string }> = [
    { id: "expenses", label: "Expenses" },
    ...(hasRevenue
      ? [{ id: "revenue" as SimulatorTab, label: "Revenue" }]
      : []),
  ];

  const handleTabKeyDown = (event: React.KeyboardEvent) => {
    const currentIndex = tabs.findIndex((t) => t.id === resolvedTab);
    let nextIndex: number | null = null;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case "ArrowLeft":
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    setActiveTab(nextTab.id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="space-y-6">
      {/* Year selector */}
      {availableYears.length > 1 && (
        <div className="card flex items-center gap-3 p-4">
          <span className="text-sm text-gray-700 font-medium">
            Simulating budget for:
          </span>
          <YearSelector
            availableYears={availableYears}
            defaultYear={defaultYear}
            onYearChange={handleYearChange}
          />
        </div>
      )}

      {/* Budget balance indicator (always visible) */}
      <BudgetBalance state={state} />

      {/* Controls header with reset */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">
          Adjust Budget Line Items
        </h2>
        <ResetButton onReset={handleReset} />
      </div>

      {/* Tab bar (only when revenue data exists) */}
      {tabs.length > 1 && (
        <div
          role="tablist"
          className="border-b border-gray-200 flex"
          onKeyDown={handleTabKeyDown}
        >
          {tabs.map((tab, index) => {
            const isActive = tab.id === resolvedTab;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`simulator-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`simulator-panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-semibold cursor-pointer border-b-2 whitespace-nowrap ${
                  isActive
                    ? tab.id === "revenue"
                      ? "border-green-600 text-green-700"
                      : "border-chicago-blue text-chicago-blue"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Expenses tab panel */}
      <div
        role="tabpanel"
        id="simulator-panel-expenses"
        aria-labelledby="simulator-tab-expenses"
        hidden={resolvedTab !== "expenses"}
      >
        <div className="space-y-3">
          {departments.map((dept) => (
            <DepartmentAccordion
              key={dept.id}
              department={dept}
              state={state}
              isExpanded={expandedDepts.has(dept.id)}
              onToggle={handleToggleDept}
              onAdjustSubcategory={handleAdjustSubcategory}
            />
          ))}
        </div>
      </div>

      {/* Revenue tab panel */}
      {hasRevenue && (
        <div
          role="tabpanel"
          id="simulator-panel-revenue"
          aria-labelledby="simulator-tab-revenue"
          hidden={resolvedTab !== "revenue"}
        >
          <div className="space-y-3">
            {revenueSources.map((source) => (
              <RevenueSourceAccordion
                key={source.id}
                source={source}
                state={state}
                isExpanded={expandedSources.has(source.id)}
                onToggle={handleToggleSource}
                onAdjustSubcategory={handleAdjustRevenueSubcategory}
              />
            ))}

            {/* Untracked revenue (non-adjustable) */}
            {state.untrackedRevenue > 0 && (
              <div
                className="card overflow-hidden opacity-60 bg-gray-50"
                role="presentation"
              >
                <div className="p-4 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-lg" aria-hidden="true">
                      &#x1F512;
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-700">
                        Estimated Grant Revenue
                      </h3>
                      <p className="text-xs text-gray-500">
                        Federal and state grants estimated from appropriations
                        data. Not adjustable.
                      </p>
                    </div>
                  </div>
                  <span className="text-gray-600 font-mono text-sm">
                    {formatCurrency(state.untrackedRevenue)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Impact summary */}
      <ImpactSummary state={state} data={budgetDataByYear[selectedYear]} />
    </div>
  );
}

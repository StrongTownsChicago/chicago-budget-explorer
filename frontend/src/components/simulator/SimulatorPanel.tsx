import { useState, useCallback } from "react";
import type { BudgetData } from "@/lib/types";
import { createSimulation, adjustSubcategory } from "@/lib/simulation-engine";
import YearSelector from "@/components/ui/YearSelector";
import BudgetBalance from "./BudgetBalance";
import DepartmentAccordion from "./DepartmentAccordion";
import ResetButton from "./ResetButton";
import ImpactSummary from "./ImpactSummary";

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
 * Uses React state to track subcategory-level adjustments and recalculate totals in real-time.
 */
export default function SimulatorPanel({
  budgetDataByYear,
  availableYears,
  defaultYear,
}: Props) {
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const data = budgetDataByYear[selectedYear];
  const departments = data.appropriations.by_department;
  const [state, setState] = useState(() => createSimulation(data));
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    // Reinitialize simulation with new year's data; preserve expanded state
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

  const handleToggle = useCallback((deptId: string) => {
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

  const handleReset = () => {
    // Reset simulation state only; keep accordions open so user sees values snap back
    setState(createSimulation(budgetDataByYear[selectedYear]));
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

      {/* Budget balance indicator */}
      <BudgetBalance state={state} totalRevenue={data.revenue?.total_revenue} />

      {/* Controls header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">
          Adjust Budget Line Items
        </h2>
        <ResetButton onReset={handleReset} />
      </div>

      {/* Department accordions with subcategory sliders */}
      <div className="space-y-3">
        {departments.map((dept) => (
          <DepartmentAccordion
            key={dept.id}
            department={dept}
            state={state}
            isExpanded={expandedDepts.has(dept.id)}
            onToggle={handleToggle}
            onAdjustSubcategory={handleAdjustSubcategory}
          />
        ))}
      </div>

      {/* Impact summary */}
      <ImpactSummary state={state} data={budgetDataByYear[selectedYear]} />
    </div>
  );
}

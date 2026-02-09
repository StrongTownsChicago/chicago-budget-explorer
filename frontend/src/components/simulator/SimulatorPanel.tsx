import { useState } from "react";
import type { BudgetData } from "@/lib/types";
import { createSimulation, adjustDepartment } from "@/lib/simulation-engine";
import YearSelector from "@/components/ui/YearSelector";
import BudgetBalance from "./BudgetBalance";
import DepartmentSlider from "./DepartmentSlider";
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
 * Uses React state to track adjustments and recalculate totals in real-time.
 */
export default function SimulatorPanel({
  budgetDataByYear,
  availableYears,
  defaultYear,
}: Props) {
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const data = budgetDataByYear[selectedYear];
  const [state, setState] = useState(() => createSimulation(data));

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    // Reinitialize simulation with new year's data
    setState(createSimulation(budgetDataByYear[year]));
  };

  const handleAdjust = (deptId: string, multiplier: number) => {
    setState((prev) =>
      adjustDepartment(
        prev,
        budgetDataByYear[selectedYear].appropriations.by_department,
        deptId,
        multiplier,
      ),
    );
  };

  const handleReset = () => {
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
          Adjust Department Budgets
        </h2>
        <ResetButton onReset={handleReset} />
      </div>

      {/* Department sliders */}
      <div className="space-y-3">
        {budgetDataByYear[selectedYear].appropriations.by_department.map(
          (dept) => (
            <DepartmentSlider
              key={dept.id}
              department={dept}
              state={state}
              onAdjust={handleAdjust}
            />
          ),
        )}
      </div>

      {/* Impact summary */}
      <ImpactSummary state={state} data={budgetDataByYear[selectedYear]} />
    </div>
  );
}

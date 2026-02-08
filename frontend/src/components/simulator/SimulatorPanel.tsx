import { useState } from "react";
import type { BudgetData } from "@/lib/types";
import { createSimulation, adjustDepartment } from "@/lib/simulation-engine";
import BudgetBalance from "./BudgetBalance";
import DepartmentSlider from "./DepartmentSlider";
import ResetButton from "./ResetButton";
import ImpactSummary from "./ImpactSummary";

export interface Props {
  data: BudgetData;
}

/**
 * Main simulator panel managing simulation state and rendering all controls.
 * Uses React state to track adjustments and recalculate totals in real-time.
 */
export default function SimulatorPanel({ data }: Props) {
  const [state, setState] = useState(() => createSimulation(data));

  const handleAdjust = (deptId: string, multiplier: number) => {
    setState((prev) =>
      adjustDepartment(prev, data.appropriations.by_department, deptId, multiplier)
    );
  };

  const handleReset = () => {
    setState(createSimulation(data));
  };

  return (
    <div className="space-y-6">
      {/* Budget balance indicator */}
      <BudgetBalance state={state} totalRevenue={data.revenue?.total_revenue} />

      {/* Controls header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">Adjust Department Budgets</h2>
        <ResetButton onReset={handleReset} />
      </div>

      {/* Department sliders */}
      <div className="space-y-3">
        {data.appropriations.by_department.map((dept) => (
          <DepartmentSlider
            key={dept.id}
            department={dept}
            state={state}
            onAdjust={handleAdjust}
          />
        ))}
      </div>

      {/* Impact summary */}
      <ImpactSummary state={state} data={data} />
    </div>
  );
}

import type { BudgetData, SimulationState } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import {
  getBudgetDelta,
  getAdjustedSubcategoryAmount,
  getAdjustedSubcategories,
} from "@/lib/simulation-engine";

export interface Props {
  state: SimulationState;
  data: BudgetData;
}

/**
 * Plain-language summary of subcategory-level budget changes and their potential impact.
 * Shows individual line-item changes with department context for educational value.
 */
export default function ImpactSummary({ state, data }: Props) {
  const delta = getBudgetDelta(state);
  const departments = data.appropriations.by_department;

  // Find subcategories with significant changes (> $1M threshold for subcategory granularity)
  const changedSubcategories = getAdjustedSubcategories(state, departments)
    .map(({ subcategory, department }) => {
      const adjusted = getAdjustedSubcategoryAmount(subcategory, state);
      const change = adjusted - subcategory.amount;
      const changePct =
        subcategory.amount !== 0 ? (change / subcategory.amount) * 100 : 0;
      return { subcategory, department, change, changePct };
    })
    .filter((item) => Math.abs(item.change) > 1_000_000) // Only show changes > $1M
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  if (changedSubcategories.length === 0) {
    return (
      <div className="mt-6 card p-5 bg-blue-50/50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Impact Summary</h3>
        <p className="text-blue-800">
          No significant changes have been made yet. Expand a department and adjust
          the sliders to explore different budget scenarios.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 card p-5 bg-blue-50/50 border-blue-200">
      <h3 className="font-semibold text-blue-900 mb-3">Impact Summary</h3>

      <div className="space-y-2 text-blue-800">
        {changedSubcategories.slice(0, 8).map(({ subcategory, department, change, changePct }) => (
          <div key={subcategory.id} className="text-sm">
            <span className="font-semibold">{department.name}</span>
            {" > "}
            <span className="font-semibold">{subcategory.name}</span>
            {": "}
            {change > 0 ? "Increased" : "Decreased"} by{" "}
            <span className="font-bold">{formatCurrency(Math.abs(change))}</span>{" "}
            ({Math.abs(changePct).toFixed(1)}%)
          </div>
        ))}

        {delta !== 0 && (
          <div className="mt-4 pt-3 border-t border-blue-200">
            <p className="font-semibold">
              {delta > 0 ? "Budget Shortfall:" : "Budget Surplus:"}{" "}
              {formatCurrency(Math.abs(delta))}
            </p>
            <p className="text-sm mt-1">
              {delta > 0
                ? "This would require finding additional revenue through taxes, fees, or other sources."
                : "This surplus could be used to reduce taxes, increase services, or build reserves."}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-blue-200 text-xs text-blue-700">
        <p>
          Note: This is a simplified simulation. Real budgets involve complex tradeoffs,
          legal constraints, and public input processes.
        </p>
      </div>
    </div>
  );
}

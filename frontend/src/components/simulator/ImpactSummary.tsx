import type { BudgetData, SimulationState } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { getBudgetDelta, getAdjustedAmount } from "@/lib/simulation-engine";

export interface Props {
  state: SimulationState;
  data: BudgetData;
}

/**
 * Plain-language summary of budget changes and their potential impact.
 * Provides context by comparing changes to real-world equivalencies.
 */
export default function ImpactSummary({ state, data }: Props) {
  const delta = getBudgetDelta(state);

  // Find departments with significant changes
  const changedDepartments = data.appropriations.by_department
    .map((dept) => {
      const adjusted = getAdjustedAmount(dept, state);
      const change = adjusted - dept.amount;
      const changePct = (change / dept.amount) * 100;
      return { dept, change, changePct };
    })
    .filter((item) => Math.abs(item.change) > 10_000_000) // Only show changes > $10M
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  if (changedDepartments.length === 0) {
    return (
      <div className="mt-6 card p-5 bg-blue-50/50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Impact Summary</h3>
        <p className="text-blue-800">
          No significant changes have been made yet. Adjust the sliders above to explore
          different budget scenarios.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 card p-5 bg-blue-50/50 border-blue-200">
      <h3 className="font-semibold text-blue-900 mb-3">Impact Summary</h3>

      <div className="space-y-2 text-blue-800">
        {changedDepartments.slice(0, 5).map(({ dept, change, changePct }) => (
          <div key={dept.id} className="text-sm">
            <span className="font-semibold">{dept.name}:</span>{" "}
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

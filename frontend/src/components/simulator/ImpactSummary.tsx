import type { BudgetData, SimulationState } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import {
  getBudgetDelta,
  getAdjustedSubcategoryAmount,
  getAdjustedSubcategories,
  getAdjustedRevenueSources,
  getRevenueExpenseBalance,
} from "@/lib/simulation-engine";

export interface Props {
  state: SimulationState;
  data: BudgetData;
}

/**
 * Plain-language summary of budget changes and their potential impact.
 * Shows individual line-item changes for both expenses and revenue,
 * with department/source context for educational value.
 */
export default function ImpactSummary({ state, data }: Props) {
  const expenseDelta = getBudgetDelta(state);
  const departments = data.appropriations.by_department;
  const revenueSources = data.revenue?.by_source ?? [];
  const hasRevenue = state.originalRevenue > 0;

  // Find expense subcategories with significant changes (> $1M threshold)
  const changedExpenses = getAdjustedSubcategories(state, departments)
    .map(({ subcategory, department }) => {
      const adjusted = getAdjustedSubcategoryAmount(subcategory, state);
      const change = adjusted - subcategory.amount;
      const changePct =
        subcategory.amount !== 0 ? (change / subcategory.amount) * 100 : 0;
      return {
        id: subcategory.id,
        label: `${department.name} > ${subcategory.name}`,
        change,
        changePct,
      };
    })
    .filter((item) => Math.abs(item.change) > 1_000_000)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  // Find revenue subcategories with significant changes (> $1M threshold)
  const changedRevenue = getAdjustedRevenueSources(state, revenueSources)
    .map(({ subcategory, source }) => {
      const adjusted = getAdjustedSubcategoryAmount(subcategory, state);
      const change = adjusted - subcategory.amount;
      const changePct =
        subcategory.amount !== 0 ? (change / subcategory.amount) * 100 : 0;
      return {
        id: subcategory.id,
        label: `${source.name} > ${subcategory.name}`,
        change,
        changePct,
      };
    })
    .filter((item) => Math.abs(item.change) > 1_000_000)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  const hasChanges = changedExpenses.length > 0 || changedRevenue.length > 0;

  if (!hasChanges) {
    return (
      <div className="mt-6 card p-5 bg-blue-50/50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Impact Summary</h3>
        <p className="text-blue-800">
          No significant changes have been made yet. Expand a department
          {hasRevenue ? " or revenue source" : ""} and adjust the sliders to
          explore different budget scenarios.
        </p>
      </div>
    );
  }

  const balance = hasRevenue ? getRevenueExpenseBalance(state) : null;

  return (
    <div className="mt-6 card p-5 bg-blue-50/50 border-blue-200">
      <h3 className="font-semibold text-blue-900 mb-3">Impact Summary</h3>

      <div className="space-y-2 text-blue-800">
        {/* Expense changes */}
        {changedExpenses.length > 0 && (
          <>
            {hasRevenue && changedRevenue.length > 0 && (
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-1">
                Spending Changes
              </div>
            )}
            {changedExpenses
              .slice(0, 5)
              .map(({ id, label, change, changePct }) => (
                <div key={id} className="text-sm">
                  <span className="font-semibold">{label}</span>
                  {": "}
                  {change > 0 ? "Increased" : "Decreased"} by{" "}
                  <span className="font-bold">
                    {formatCurrency(Math.abs(change))}
                  </span>{" "}
                  ({Math.abs(changePct).toFixed(1)}%)
                </div>
              ))}
          </>
        )}

        {/* Revenue changes */}
        {changedRevenue.length > 0 && (
          <>
            <div
              className={`text-xs font-semibold uppercase tracking-wide text-green-700 ${changedExpenses.length > 0 ? "mt-3" : ""} mb-1`}
            >
              Revenue Changes
            </div>
            {changedRevenue
              .slice(0, 5)
              .map(({ id, label, change, changePct }) => (
                <div key={id} className="text-sm">
                  <span className="font-semibold">{label}</span>
                  {": "}
                  {change > 0 ? "Increased" : "Decreased"} by{" "}
                  <span className="font-bold">
                    {formatCurrency(Math.abs(change))}
                  </span>{" "}
                  ({Math.abs(changePct).toFixed(1)}%)
                </div>
              ))}
          </>
        )}

        {/* Bottom-line summary */}
        {balance != null && Math.abs(balance) >= 1000 && (
          <div className="mt-4 pt-3 border-t border-blue-200">
            <p className="font-semibold">
              {balance > 0 ? "Budget Surplus:" : "Budget Deficit:"}{" "}
              {formatCurrency(Math.abs(balance))}
            </p>
            <p className="text-sm mt-1">
              {balance > 0
                ? "Revenue exceeds spending. The surplus could fund reserves or reduce taxes."
                : "Spending exceeds revenue. Additional revenue or spending cuts are needed."}
            </p>
          </div>
        )}

        {balance == null && expenseDelta !== 0 && (
          <div className="mt-4 pt-3 border-t border-blue-200">
            <p className="font-semibold">
              {expenseDelta > 0 ? "Budget Shortfall:" : "Budget Surplus:"}{" "}
              {formatCurrency(Math.abs(expenseDelta))}
            </p>
            <p className="text-sm mt-1">
              {expenseDelta > 0
                ? "This would require finding additional revenue through taxes, fees, or other sources."
                : "This surplus could be used to reduce taxes, increase services, or build reserves."}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-blue-200 text-xs text-blue-700">
        <p>
          Note: This is a simplified simulation. Real budgets involve complex
          tradeoffs, legal constraints, and public input processes.
        </p>
      </div>
    </div>
  );
}

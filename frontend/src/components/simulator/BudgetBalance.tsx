import { formatCurrency, formatPercent } from "@/lib/format";
import type { SimulationState } from "@/lib/types";
import { getBudgetDelta, getDeltaPercent, isBalanced } from "@/lib/simulation-engine";
import { getDeltaBackground } from "@/lib/colors";

export interface Props {
  state: SimulationState;
  totalRevenue?: number;
}

/**
 * Large, prominent display showing budget balance status.
 * Color-coded to indicate balanced (green), over budget (red), or under budget (yellow).
 */
export default function BudgetBalance({ state, totalRevenue }: Props) {
  const delta = getBudgetDelta(state);
  const deltaPct = getDeltaPercent(state);
  const balanced = isBalanced(state);
  const revenueGap = totalRevenue != null ? state.totalBudget - totalRevenue : null;

  const statusText = balanced
    ? "Balanced"
    : delta > 0
      ? "Over Budget"
      : "Under Budget";

  const bgClass = getDeltaBackground(delta);

  return (
    <div
      className={`p-6 rounded-lg border-2 ${bgClass}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold mb-2">
            {formatCurrency(state.totalBudget)}
          </h2>
          <p className="text-lg">
            {statusText}
            {!balanced && (
              <span className="ml-2 font-semibold">
                by {formatCurrency(Math.abs(delta))}
              </span>
            )}
          </p>
        </div>

        <div className="text-right">
          <div className="text-sm text-gray-600 mb-1">Change from Original</div>
          <div className="text-2xl font-bold">
            {delta >= 0 ? "+" : ""}
            {formatCurrency(delta)}
          </div>
          <div className="text-lg">
            ({delta >= 0 ? "+" : ""}
            {formatPercent(deltaPct, 2, false)})
          </div>
        </div>
      </div>

      {balanced && (
        <div className="mt-4 text-sm">
          ✓ Your budget is balanced! No additional revenue needed.
        </div>
      )}

      {delta > 0 && (
        <div className="mt-4 text-sm">
          ⚠ You need to find additional revenue or make cuts to balance the budget.
        </div>
      )}

      {delta < 0 && (
        <div className="mt-4 text-sm">
          ℹ You have a surplus. Consider increasing services or reducing taxes.
        </div>
      )}

      {revenueGap != null && Math.abs(revenueGap) > 1_000_000 && (
        <div className="mt-4 text-sm text-gray-700 border-t pt-3">
          {revenueGap > 0 ? (
            <span>
              Your budget is <strong>{formatCurrency(revenueGap)}</strong> over
              available local revenue. This gap would need to be closed through
              new taxes, borrowing, or spending cuts elsewhere.
            </span>
          ) : (
            <span>
              Your budget leaves a{" "}
              <strong>{formatCurrency(Math.abs(revenueGap))}</strong> surplus
              relative to local revenue that could fund reserves, debt paydown,
              or new programs.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

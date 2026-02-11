import { formatCurrency, formatPercent } from "@/lib/format";
import type { SimulationState } from "@/lib/types";
import {
  getBudgetDelta,
  getDeltaPercent,
  isBalanced,
  getRevenueExpenseBalance,
} from "@/lib/simulation-engine";
import { getDeltaBackground } from "@/lib/colors";

export interface Props {
  state: SimulationState;
}

/**
 * Get background class for revenue-vs-expense balance.
 * Positive = surplus (green), negative = deficit (red), near-zero = balanced (green).
 */
function getBalanceBackground(balance: number): string {
  if (Math.abs(balance) < 1000) {
    return "bg-green-50 border-green-500";
  }
  return balance > 0 ? "bg-green-50 border-green-500" : "bg-red-50 border-red-500";
}

/**
 * Large, prominent display showing budget balance status.
 *
 * When revenue data exists: Shows revenue vs spending balance (true fiscal picture).
 * When no revenue data: Falls back to expense-only mode (over/under original budget).
 */
export default function BudgetBalance({ state }: Props) {
  const hasRevenue = state.originalRevenue > 0;

  if (hasRevenue) {
    return <RevenueBalanceDisplay state={state} />;
  }

  return <ExpenseOnlyDisplay state={state} />;
}

/**
 * Revenue-vs-spending balance display.
 * Shows adjusted revenue, adjusted spending, and the balance between them.
 */
function RevenueBalanceDisplay({ state }: { state: SimulationState }) {
  const balance = getRevenueExpenseBalance(state);
  const totalIncome = state.totalRevenue + state.untrackedRevenue;
  const bgClass = getBalanceBackground(balance);

  const expenseDelta = state.totalBudget - state.originalBudget;
  const revenueDelta = state.totalRevenue - state.originalRevenue;

  const statusText =
    Math.abs(balance) < 1000
      ? "Balanced"
      : balance > 0
        ? "Surplus"
        : "Deficit";

  return (
    <div
      className={`p-6 rounded-xl border-2 ${bgClass}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Revenue vs Spending */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Revenue side */}
        <div>
          <div className="text-sm text-gray-600 mb-1">Total Revenue</div>
          <div className="text-2xl font-extrabold tracking-tight">
            {formatCurrency(totalIncome)}
          </div>
          {revenueDelta !== 0 && (
            <div
              className={`text-sm font-semibold ${revenueDelta > 0 ? "text-green-600" : "text-red-600"}`}
            >
              {revenueDelta > 0 ? "+" : ""}
              {formatCurrency(revenueDelta)} local revenue
            </div>
          )}
          {state.untrackedRevenue > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              Includes {formatCurrency(state.untrackedRevenue)} est. grants &amp; other revenue
            </div>
          )}
        </div>

        {/* Balance indicator */}
        <div className="text-center flex flex-col justify-center">
          <div className="text-3xl font-extrabold tracking-tight">
            {statusText}
          </div>
          {Math.abs(balance) >= 1000 && (
            <div className="text-lg font-semibold mt-1">
              {balance > 0 ? "+" : ""}
              {formatCurrency(balance)}
            </div>
          )}
        </div>

        {/* Spending side */}
        <div className="text-right">
          <div className="text-sm text-gray-600 mb-1">Total Spending</div>
          <div className="text-2xl font-extrabold tracking-tight">
            {formatCurrency(state.totalBudget)}
          </div>
          {expenseDelta !== 0 && (
            <div
              className={`text-sm font-semibold ${expenseDelta > 0 ? "text-red-600" : "text-green-600"}`}
            >
              {expenseDelta > 0 ? "+" : ""}
              {formatCurrency(expenseDelta)}
            </div>
          )}
        </div>
      </div>

      {/* Explanatory text */}
      {Math.abs(balance) < 1000 && (
        <div className="text-sm font-medium">
          Revenue covers spending. The budget is balanced.
        </div>
      )}

      {balance > 1000 && (
        <div className="text-sm font-medium">
          Revenue exceeds spending. The surplus could fund reserves or new
          initiatives.
        </div>
      )}

      {balance < -1000 && (
        <div className="text-sm font-medium">
          Spending exceeds revenue. Additional revenue or spending cuts are
          needed to close the gap.
        </div>
      )}
    </div>
  );
}

/**
 * Expense-only balance display (fallback when no revenue data).
 * Shows over/under relative to original budget.
 */
function ExpenseOnlyDisplay({ state }: { state: SimulationState }) {
  const delta = getBudgetDelta(state);
  const deltaPct = getDeltaPercent(state);
  const balanced = isBalanced(state);
  const bgClass = getDeltaBackground(delta);

  const statusText = balanced
    ? "Balanced"
    : delta > 0
      ? "Over Budget"
      : "Under Budget";

  return (
    <div
      className={`p-6 rounded-xl border-2 ${bgClass}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold mb-2 tracking-tight">
            {formatCurrency(state.totalBudget)}
          </h2>
          <p className="text-lg font-medium">
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
          <div className="text-2xl font-bold tracking-tight">
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
        <div className="mt-4 text-sm font-medium">
          Your budget is balanced! No additional revenue needed.
        </div>
      )}

      {delta > 0 && (
        <div className="mt-4 text-sm font-medium">
          You need to find additional revenue or make cuts to balance the
          budget.
        </div>
      )}

      {delta < 0 && (
        <div className="mt-4 text-sm font-medium">You have a surplus.</div>
      )}
    </div>
  );
}

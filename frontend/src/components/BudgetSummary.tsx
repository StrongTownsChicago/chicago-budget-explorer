import { formatCurrency } from "@/lib/format";
import type { Metadata } from "@/lib/types";

export interface Props {
  metadata: Metadata;
}

export default function BudgetSummary({ metadata }: Props) {
  return (
    <div className="budget-summary bg-white rounded-lg shadow-md p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Budget Overview
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          The <strong>operating budget</strong> (
          {formatCurrency(metadata.operating_appropriations || 0)}) covers
          day-to-day operations and matches figures in budget reports. The{" "}
          <strong>total appropriations</strong> include all funds, including
          self-funded enterprise operations, pension contributions, and grant
          programs.
        </p>
      </div>

      {/* Main Totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="stat-card bg-blue-50 p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-600 mb-1">
            Operating Budget
          </h3>
          <p className="text-3xl font-bold text-blue-900">
            {formatCurrency(metadata.operating_appropriations || 0)}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Corporate &amp; local operating funds
          </p>
        </div>

        <div className="stat-card bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-600 mb-1">
            Total Appropriations
          </h3>
          <p className="text-3xl font-bold text-gray-900">
            {formatCurrency(metadata.total_appropriations)}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            All funds including enterprise &amp; pensions
          </p>
        </div>
      </div>

      {/* Calculation Breakdown */}
      <div className="calculation-breakdown border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          How Total is Calculated
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Gross Appropriations</span>
            <span className="font-mono">
              {formatCurrency(metadata.gross_appropriations)}
            </span>
          </div>
          {metadata.accounting_adjustments < 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Accounting Adjustments</span>
              <span className="font-mono text-red-600">
                {formatCurrency(metadata.accounting_adjustments)}
              </span>
            </div>
          )}
          <div className="flex justify-between font-semibold border-t border-gray-200 pt-2">
            <span>Total Appropriations</span>
            <span className="font-mono">
              {formatCurrency(metadata.total_appropriations)}
            </span>
          </div>
        </div>
      </div>

      {/* Fund Category Breakdown */}
      <div className="fund-breakdown border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Breakdown by Fund Type
        </h3>
        <div className="space-y-2 text-sm">
          {Object.entries(metadata.fund_category_breakdown || {})
            .sort((a, b) => b[1] - a[1])
            .map(([category, amount]) => (
              <div key={category} className="flex justify-between">
                <span className="text-gray-600 capitalize">
                  {category.replace(/_/g, " ")} Funds
                </span>
                <span className="font-mono">{formatCurrency(amount)}</span>
              </div>
            ))}

          {(!metadata.fund_category_breakdown ||
            Object.keys(metadata.fund_category_breakdown).length === 0) && (
            <div className="flex justify-between">
              <span className="text-gray-600">All Funds</span>
              <span className="font-mono">
                {formatCurrency(metadata.total_appropriations)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

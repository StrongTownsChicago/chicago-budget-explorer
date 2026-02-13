import type { ComparisonSummary as ComparisonSummaryType } from "@/lib/comparison-engine";
import { formatCurrency, formatPercent } from "@/lib/format";

export interface Props {
  summary: ComparisonSummaryType;
}

/**
 * Format a delta percentage for display, capping at +/-999%.
 * Returns "N/A" for null values.
 */
function formatDeltaPct(deltaPct: number | null): string {
  if (deltaPct === null) return "N/A";
  if (Math.abs(deltaPct) > 999) {
    return deltaPct > 0 ? ">+999%" : "<-999%";
  }
  return formatPercent(deltaPct);
}

/**
 * Get Tailwind color class for a delta value.
 * Green for positive (increase), red for negative (decrease), gray for neutral/null.
 */
function getDeltaColorClass(delta: number | null): string {
  if (delta === null || Math.abs(delta) < 1000) return "text-gray-600";
  return delta > 0 ? "text-green-700" : "text-red-700";
}

function getDeltaBgClass(delta: number | null): string {
  if (delta === null || Math.abs(delta) < 1000) return "bg-gray-50";
  return delta > 0 ? "bg-green-50" : "bg-red-50";
}

/**
 * Displays top-level budget comparison: total appropriations, revenue,
 * fund breakdown deltas with color coding.
 */
export default function ComparisonSummary({ summary }: Props) {
  return (
    <div className="space-y-6" data-testid="comparison-summary">
      {/* Main metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Appropriations */}
        <MetricCard
          label="Total Appropriations"
          baseLabel={summary.baseYearLabel}
          targetLabel={summary.targetYearLabel}
          baseAmount={summary.totalAppropriations.baseAmount}
          targetAmount={summary.totalAppropriations.targetAmount}
          delta={summary.totalAppropriations.delta}
          deltaPct={summary.totalAppropriations.deltaPct}
        />

        {/* Operating Appropriations */}
        {summary.operatingAppropriations && (
          <MetricCard
            label="Operating Appropriations"
            baseLabel={summary.baseYearLabel}
            targetLabel={summary.targetYearLabel}
            baseAmount={summary.operatingAppropriations.baseAmount}
            targetAmount={summary.operatingAppropriations.targetAmount}
            delta={summary.operatingAppropriations.delta}
            deltaPct={summary.operatingAppropriations.deltaPct}
          />
        )}

        {/* Total Revenue */}
        {summary.totalRevenue ? (
          <MetricCard
            label="Total Revenue"
            baseLabel={summary.baseYearLabel}
            targetLabel={summary.targetYearLabel}
            baseAmount={summary.totalRevenue.baseAmount}
            targetAmount={summary.totalRevenue.targetAmount}
            delta={summary.totalRevenue.delta}
            deltaPct={summary.totalRevenue.deltaPct}
          />
        ) : (
          <div className="card p-4 flex items-center justify-center" data-testid="no-revenue">
            <p className="text-sm text-gray-500">
              Revenue comparison not available for this year pair
            </p>
          </div>
        )}
      </div>

      {/* Fund Category Breakdown */}
      {summary.fundCategoryBreakdown.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Fund Category Changes
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="fund-category-table">
              <thead>
                <tr className="border-b border-gray-200">
                  <th scope="col" className="text-left py-2 font-medium text-gray-600">
                    Category
                  </th>
                  <th scope="col" className="text-right py-2 font-medium text-gray-600">
                    {summary.baseYearLabel}
                  </th>
                  <th scope="col" className="text-right py-2 font-medium text-gray-600">
                    {summary.targetYearLabel}
                  </th>
                  <th scope="col" className="text-right py-2 font-medium text-gray-600">
                    Change
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.fundCategoryBreakdown.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <th scope="row" className="text-left py-2 font-normal text-gray-700">
                      {item.name}
                      {item.status === "added" && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                          New
                        </span>
                      )}
                      {item.status === "removed" && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                          Removed
                        </span>
                      )}
                    </th>
                    <td className="text-right py-2 font-mono">
                      {item.baseAmount !== null ? formatCurrency(item.baseAmount) : "--"}
                    </td>
                    <td className="text-right py-2 font-mono">
                      {item.targetAmount !== null ? formatCurrency(item.targetAmount) : "--"}
                    </td>
                    <td className={`text-right py-2 font-mono ${getDeltaColorClass(item.delta)}`}>
                      {item.delta !== null
                        ? `${item.delta >= 0 ? "+" : ""}${formatCurrency(item.delta)} (${formatDeltaPct(item.deltaPct)})`
                        : "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/** A single metric card showing base/target amounts and delta. */
function MetricCard({
  label,
  baseLabel,
  targetLabel,
  baseAmount,
  targetAmount,
  delta,
  deltaPct,
}: {
  label: string;
  baseLabel: string;
  targetLabel: string;
  baseAmount: number | null;
  targetAmount: number | null;
  delta: number | null;
  deltaPct: number | null;
}) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-600 mb-3">{label}</h3>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{baseLabel}</span>
          <span className="font-mono font-medium">
            {baseAmount !== null ? formatCurrency(baseAmount) : "--"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{targetLabel}</span>
          <span className="font-mono font-medium">
            {targetAmount !== null ? formatCurrency(targetAmount) : "--"}
          </span>
        </div>
        <div
          className={`flex justify-between text-sm pt-2 mt-1 border-t border-gray-100 px-2 py-1.5 rounded ${getDeltaBgClass(delta)}`}
        >
          <span className={`font-medium ${getDeltaColorClass(delta)}`}>Change</span>
          <span className={`font-mono font-semibold ${getDeltaColorClass(delta)}`}>
            {delta !== null
              ? `${delta >= 0 ? "+" : ""}${formatCurrency(delta)} (${formatDeltaPct(deltaPct)})`
              : "N/A"}
          </span>
        </div>
      </div>
    </div>
  );
}

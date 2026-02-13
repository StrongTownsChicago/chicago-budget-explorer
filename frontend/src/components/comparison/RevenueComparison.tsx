import { useMemo } from "react";
import type { ComparisonItem } from "@/lib/comparison-engine";
import type { BudgetData } from "@/lib/types";
import { getRevenueSourceType } from "@/lib/comparison-engine";
import { formatCurrency, formatPercent } from "@/lib/format";

/** Display labels for revenue type groups (same as RevenueBreakdown). */
const REVENUE_TYPE_LABELS: Record<string, string> = {
  tax: "Tax Revenue",
  fee: "Fees & Charges",
  enterprise: "Enterprise Revenue",
  internal_transfer: "Internal Transfers",
  debt_proceeds: "Debt Proceeds",
  other: "Other Revenue",
};

/** Order in which revenue type groups are displayed. */
const REVENUE_TYPE_ORDER = [
  "tax",
  "fee",
  "enterprise",
  "debt_proceeds",
  "internal_transfer",
  "other",
];

export interface Props {
  sources: ComparisonItem[];
  baseYearLabel: string;
  targetYearLabel: string;
  baseBudgetData: BudgetData;
  targetBudgetData: BudgetData;
}

function formatDeltaPct(deltaPct: number | null): string {
  if (deltaPct === null) return "N/A";
  if (Math.abs(deltaPct) > 999) {
    return deltaPct > 0 ? ">+999%" : "<-999%";
  }
  return formatPercent(deltaPct);
}

function getDeltaColorClass(delta: number | null): string {
  if (delta === null || Math.abs(delta) < 1000) return "text-gray-600";
  return delta > 0 ? "text-green-700" : "text-red-700";
}

interface GroupedSources {
  type: string;
  label: string;
  sources: ComparisonItem[];
}

/**
 * Group revenue comparison items by revenue type, maintaining the standard display order.
 */
function groupByRevenueType(
  sources: ComparisonItem[],
  baseBudgetData: BudgetData,
  targetBudgetData: BudgetData,
): GroupedSources[] {
  const groups: Record<string, ComparisonItem[]> = {};

  for (const source of sources) {
    const revenueType = getRevenueSourceType(source.id, baseBudgetData, targetBudgetData);
    if (!groups[revenueType]) groups[revenueType] = [];
    groups[revenueType].push(source);
  }

  // Sort sources within each group by absolute delta (biggest movers first)
  for (const type of Object.keys(groups)) {
    groups[type]!.sort((a, b) => {
      const aAbs = a.delta !== null ? Math.abs(a.delta) : -Infinity;
      const bAbs = b.delta !== null ? Math.abs(b.delta) : -Infinity;
      return bAbs - aAbs;
    });
  }

  // Build grouped array in standard display order
  const result: GroupedSources[] = REVENUE_TYPE_ORDER
    .filter((type) => groups[type]?.length)
    .map((type) => ({
      type,
      label: REVENUE_TYPE_LABELS[type] || type.replace(/_/g, " "),
      sources: groups[type]!,
    }));

  // Append any types not in the predefined order
  const knownTypes = new Set(REVENUE_TYPE_ORDER);
  for (const type of Object.keys(groups)) {
    if (!knownTypes.has(type) && groups[type]!.length > 0) {
      result.push({
        type,
        label: REVENUE_TYPE_LABELS[type] || type.replace(/_/g, " "),
        sources: groups[type]!,
      });
    }
  }

  return result;
}

/**
 * Revenue source comparison table, grouped by revenue type.
 * Matches the grouping pattern of RevenueBreakdown.tsx.
 */
export default function RevenueComparison({
  sources,
  baseYearLabel,
  targetYearLabel,
  baseBudgetData,
  targetBudgetData,
}: Props) {
  const groupedSources = useMemo(
    () => groupByRevenueType(sources, baseBudgetData, targetBudgetData),
    [sources, baseBudgetData, targetBudgetData],
  );

  if (sources.length === 0) {
    return (
      <p className="text-gray-500 text-sm py-4" data-testid="no-revenue-sources">
        No revenue sources to compare.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto" data-testid="revenue-comparison">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th scope="col" className="text-left py-2 px-2 font-medium text-gray-600">
              Revenue Source
            </th>
            <th scope="col" className="text-right py-2 px-2 font-medium text-gray-600">
              {baseYearLabel}
            </th>
            <th scope="col" className="text-right py-2 px-2 font-medium text-gray-600">
              {targetYearLabel}
            </th>
            <th scope="col" className="text-right py-2 px-2 font-medium text-gray-600">
              $ Change
            </th>
            <th scope="col" className="text-right py-2 px-2 font-medium text-gray-600">
              % Change
            </th>
          </tr>
        </thead>
        <tbody>
          {groupedSources.map((group) => (
            <RevenueGroup
              key={group.type}
              label={group.label}
              sources={group.sources}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A group header row followed by individual revenue source rows. */
function RevenueGroup({
  label,
  sources,
}: {
  label: string;
  sources: ComparisonItem[];
}) {
  return (
    <>
      <tr className="bg-gray-100">
        <td className="py-1.5 px-2 font-semibold text-gray-700" colSpan={5}>
          {label}
        </td>
      </tr>
      {sources.map((source) => (
        <tr
          key={source.id}
          className="border-b border-gray-100 hover:bg-gray-50"
          data-testid={`revenue-row-${source.id}`}
        >
          <th scope="row" className="text-left py-2 px-2 pl-4 font-normal text-gray-700">
            {source.name}
            {source.status === "added" && (
              <span className="ml-2 text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                New
              </span>
            )}
            {source.status === "removed" && (
              <span className="ml-2 text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                Removed
              </span>
            )}
          </th>
          <td className="text-right py-2 px-2 font-mono">
            {source.baseAmount !== null ? formatCurrency(source.baseAmount) : "--"}
          </td>
          <td className="text-right py-2 px-2 font-mono">
            {source.targetAmount !== null ? formatCurrency(source.targetAmount) : "--"}
          </td>
          <td className={`text-right py-2 px-2 font-mono ${getDeltaColorClass(source.delta)}`}>
            {source.delta !== null
              ? `${source.delta >= 0 ? "+" : ""}${formatCurrency(source.delta)}`
              : "--"}
          </td>
          <td className={`text-right py-2 px-2 font-mono ${getDeltaColorClass(source.delta)}`}>
            {formatDeltaPct(source.deltaPct)}
          </td>
        </tr>
      ))}
    </>
  );
}

import { useMemo } from "react";
import type { ComparisonItem } from "@/lib/comparison-engine";
import { formatCurrency, formatPercent } from "@/lib/format";

export interface Props {
  items: ComparisonItem[];
  baseYearLabel: string;
  targetYearLabel: string;
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

/**
 * Compact table of subcategories within an expanded department row.
 * Sorted by absolute dollar change descending (biggest movers first).
 */
export default function LineItemComparison({
  items,
  baseYearLabel,
  targetYearLabel,
}: Props) {
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aAbs = a.delta !== null ? Math.abs(a.delta) : -Infinity;
      const bAbs = b.delta !== null ? Math.abs(b.delta) : -Infinity;
      return bAbs - aAbs;
    });
  }, [items]);

  if (items.length === 0) {
    return (
      <p className="text-gray-500 text-sm py-2" data-testid="no-line-items">
        No line items to compare.
      </p>
    );
  }

  return (
    <div data-testid="line-item-comparison">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200">
            <th scope="col" className="text-left py-1.5 px-2 font-medium text-gray-500">
              Line Item
            </th>
            <th scope="col" className="text-right py-1.5 px-2 font-medium text-gray-500">
              {baseYearLabel}
            </th>
            <th scope="col" className="text-right py-1.5 px-2 font-medium text-gray-500">
              {targetYearLabel}
            </th>
            <th scope="col" className="text-right py-1.5 px-2 font-medium text-gray-500">
              Change
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item) => (
            <tr
              key={item.id}
              className="border-b border-gray-100 hover:bg-white/50"
              data-testid={`line-item-${item.id}`}
            >
              <th scope="row" className="text-left py-1.5 px-2 font-normal text-gray-700">
                {item.name}
                {item.status === "added" && (
                  <span className="ml-1.5 text-[10px] px-1 py-0.5 bg-green-100 text-green-700 rounded">
                    New
                  </span>
                )}
                {item.status === "removed" && (
                  <span className="ml-1.5 text-[10px] px-1 py-0.5 bg-red-100 text-red-700 rounded">
                    Removed
                  </span>
                )}
              </th>
              <td className="text-right py-1.5 px-2 font-mono">
                {item.baseAmount !== null ? formatCurrency(item.baseAmount) : "--"}
              </td>
              <td className="text-right py-1.5 px-2 font-mono">
                {item.targetAmount !== null ? formatCurrency(item.targetAmount) : "--"}
              </td>
              <td className={`text-right py-1.5 px-2 font-mono ${getDeltaColorClass(item.delta)}`}>
                {item.delta !== null
                  ? `${item.delta >= 0 ? "+" : ""}${formatCurrency(item.delta)} (${formatDeltaPct(item.deltaPct)})`
                  : "--"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

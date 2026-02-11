import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { TrendPoint } from "@/lib/types";
import { formatCurrency, formatCompact } from "@/lib/format";
import { getDepartmentColor } from "@/lib/colors";

/** Minimal interface for any item that can be displayed on a trend chart. */
export interface TrendItem {
  id: string;
  name: string;
  amount: number;
  trend?: TrendPoint[];
}

export interface Props {
  items: TrendItem[];
  label?: string;
  maxDefaultSelected?: number;
}

/**
 * Format a fiscal year string for display (fy2025 -> FY2025).
 */
function formatFiscalYear(fy: string): string {
  return fy.toUpperCase();
}

/**
 * Line chart showing budget trends across fiscal years.
 * Works for both departments and revenue sources (any item with trend data).
 * Users can select which items to compare on the chart.
 * Default: top N items by current-year amount.
 */
export default function TrendChart({
  items,
  label = "departments",
  maxDefaultSelected = 5,
}: Props) {
  // Filter items that have trend data
  const itemsWithTrends = useMemo(
    () => items.filter((d) => d.trend && d.trend.length > 0),
    [items],
  );

  // Default selection: top N by amount
  const defaultSelected = useMemo(
    () =>
      new Set(
        [...itemsWithTrends]
          .sort((a, b) => b.amount - a.amount)
          .slice(0, maxDefaultSelected)
          .map((d) => d.id),
      ),
    [itemsWithTrends, maxDefaultSelected],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(defaultSelected);

  // Build chart data: one entry per fiscal year, with item amounts as keys
  const chartData = useMemo(() => {
    const selectedItems = itemsWithTrends.filter((d) =>
      selectedIds.has(d.id),
    );

    if (selectedItems.length === 0) return [];

    // Collect all fiscal years across selected items
    const allYears = new Set<string>();
    for (const item of selectedItems) {
      for (const point of item.trend!) {
        allYears.add(point.fiscal_year);
      }
    }

    // Sort years ascending
    const sortedYears = [...allYears].sort();

    // Build data points
    return sortedYears.map((fy) => {
      const entry: Record<string, string | number> = {
        fiscal_year: formatFiscalYear(fy),
      };
      for (const item of selectedItems) {
        const point = item.trend!.find((p) => p.fiscal_year === fy);
        if (point) {
          entry[item.name] = point.amount;
        }
      }
      return entry;
    });
  }, [itemsWithTrends, selectedIds]);

  const selectedItems = useMemo(
    () => itemsWithTrends.filter((d) => selectedIds.has(d.id)),
    [itemsWithTrends, selectedIds],
  );

  const toggleItem = (itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  if (itemsWithTrends.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        No historical trend data available.
      </p>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Chart */}
      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis dataKey="fiscal_year" style={{ fontSize: "12px" }} />
            <YAxis
              tickFormatter={(value) => formatCompact(value)}
              style={{ fontSize: "12px" }}
            />
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), ""]}
              labelFormatter={(label) => String(label)}
              contentStyle={{
                backgroundColor: "white",
                border: "none",
                borderRadius: "8px",
                padding: "12px 16px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)",
              }}
            />
            <Legend />
            {selectedItems.map((item, index) => (
              <Line
                key={item.id}
                type="monotone"
                dataKey={item.name}
                stroke={getDepartmentColor(index)}
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Item selection */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">
          Select {label} to compare:
        </h4>
        <div className="flex flex-wrap gap-2">
          {itemsWithTrends
            .sort((a, b) => b.amount - a.amount)
            .map((item) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                    isSelected
                      ? "bg-chicago-blue border-chicago-blue text-white shadow-sm"
                      : "bg-white border-border-subtle text-gray-600 hover:bg-gray-50 hover:border-gray-400"
                  }`}
                  style={isSelected ? { boxShadow: "0 1px 3px rgba(0,81,165,0.3)" } : {}}
                >
                  {item.name}
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}

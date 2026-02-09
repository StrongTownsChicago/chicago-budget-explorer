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
import type { Department } from "@/lib/types";
import { formatCurrency, formatCompact } from "@/lib/format";
import { getDepartmentColor } from "@/lib/colors";

export interface Props {
  departments: Department[];
  maxDefaultSelected?: number;
}

/**
 * Format a fiscal year string for display (fy2025 -> FY2025).
 */
function formatFiscalYear(fy: string): string {
  return fy.toUpperCase();
}

/**
 * Line chart showing department budget trends across fiscal years.
 * Users can select which departments to compare on the chart.
 * Default: top N departments by current-year amount.
 */
export default function TrendChart({
  departments,
  maxDefaultSelected = 5,
}: Props) {
  // Filter departments that have trend data
  const departmentsWithTrends = useMemo(
    () => departments.filter((d) => d.trend && d.trend.length > 0),
    [departments],
  );

  // Default selection: top N by amount
  const defaultSelected = useMemo(
    () =>
      new Set(
        [...departmentsWithTrends]
          .sort((a, b) => b.amount - a.amount)
          .slice(0, maxDefaultSelected)
          .map((d) => d.id),
      ),
    [departmentsWithTrends, maxDefaultSelected],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(defaultSelected);

  // Build chart data: one entry per fiscal year, with department amounts as keys
  const chartData = useMemo(() => {
    const selectedDepts = departmentsWithTrends.filter((d) =>
      selectedIds.has(d.id),
    );

    if (selectedDepts.length === 0) return [];

    // Collect all fiscal years across selected departments
    const allYears = new Set<string>();
    for (const dept of selectedDepts) {
      for (const point of dept.trend!) {
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
      for (const dept of selectedDepts) {
        const point = dept.trend!.find((p) => p.fiscal_year === fy);
        if (point) {
          entry[dept.name] = point.amount;
        }
      }
      return entry;
    });
  }, [departmentsWithTrends, selectedIds]);

  const selectedDepts = useMemo(
    () => departmentsWithTrends.filter((d) => selectedIds.has(d.id)),
    [departmentsWithTrends, selectedIds],
  );

  const toggleDepartment = (deptId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) {
        next.delete(deptId);
      } else {
        next.add(deptId);
      }
      return next;
    });
  };

  if (departmentsWithTrends.length === 0) {
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
            {selectedDepts.map((dept, index) => (
              <Line
                key={dept.id}
                type="monotone"
                dataKey={dept.name}
                stroke={getDepartmentColor(index)}
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Department selection */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">
          Select departments to compare:
        </h4>
        <div className="flex flex-wrap gap-2">
          {departmentsWithTrends
            .sort((a, b) => b.amount - a.amount)
            .map((dept) => {
              const isSelected = selectedIds.has(dept.id);
              return (
                <button
                  key={dept.id}
                  onClick={() => toggleDepartment(dept.id)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                    isSelected
                      ? "bg-chicago-blue border-chicago-blue text-white shadow-sm"
                      : "bg-white border-border-subtle text-gray-600 hover:bg-gray-50 hover:border-gray-400"
                  }`}
                  style={isSelected ? { boxShadow: "0 1px 3px rgba(0,81,165,0.3)" } : {}}
                >
                  {dept.name}
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}

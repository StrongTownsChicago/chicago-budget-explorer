import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { Department } from "@/lib/types";
import { formatCurrency, formatCompact, formatPercent } from "@/lib/format";
import { getDepartmentColor } from "@/lib/colors";

export interface Props {
  departments: Department[];
  totalBudget: number;
  maxDepartments?: number;
}

/**
 * Get CSS classes for a year-over-year change badge.
 * Green for increases, red for decreases, gray for minimal change.
 */
function getChangeBadgeStyle(changePct: number): string {
  const absPct = Math.abs(changePct);
  if (absPct < 0.5) {
    return "text-gray-500 bg-gray-100";
  }
  if (changePct > 0) {
    return "text-green-700 bg-green-50";
  }
  return "text-red-700 bg-red-50";
}

/**
 * Horizontal bar chart showing department budgets.
 * Departments are sorted by amount (largest first).
 * Shows year-over-year change badges when prior year data is available.
 */
export default function DepartmentBar({
  departments,
  totalBudget,
  maxDepartments = 20,
}: Props) {
  // Sort by amount descending and limit to top N
  const topDepartments = [...departments]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, maxDepartments);

  const chartData = topDepartments.map((dept, index) => ({
    name: dept.name,
    amount: dept.amount,
    percentage: ((dept.amount / totalBudget) * 100).toFixed(1),
    color: getDepartmentColor(index),
  }));

  return (
    <div className="w-full">
      <ResponsiveContainer
        width="100%"
        height={Math.min(600, topDepartments.length * 30)}
      >
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
        >
          <XAxis
            type="number"
            tickFormatter={(value) => formatCompact(value)}
            style={{ fontSize: "12px" }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            style={{ fontSize: "12px" }}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === "amount") {
                return [formatCurrency(value), "Budget"];
              }
              return [value, name];
            }}
            contentStyle={{
              backgroundColor: "white",
              border: "none",
              borderRadius: "8px",
              padding: "12px 16px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)",
            }}
            labelFormatter={(label) => label}
          />
          <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Year-over-year change badges */}
      <div className="mt-4 space-y-1">
        {topDepartments
          .filter((dept) => dept.change_pct != null)
          .map((dept) => (
            <div
              key={dept.id}
              className="flex items-center gap-2 text-sm"
              data-testid={`change-badge-${dept.id}`}
            >
              <span className="text-gray-700 w-36 truncate">{dept.name}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${getChangeBadgeStyle(dept.change_pct!)}`}
              >
                {formatPercent(dept.change_pct!)}
              </span>
            </div>
          ))}
      </div>

      {departments.length > maxDepartments && (
        <p className="text-sm text-gray-600 mt-2">
          Showing top {maxDepartments} of {departments.length} departments
        </p>
      )}
    </div>
  );
}

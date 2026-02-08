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
import { formatCurrency, formatCompact } from "@/lib/format";
import { getDepartmentColor } from "@/lib/colors";

export interface Props {
  departments: Department[];
  totalBudget: number;
  maxDepartments?: number;
}

/**
 * Horizontal bar chart showing department budgets.
 * Departments are sorted by amount (largest first).
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
      <ResponsiveContainer width="100%" height={Math.min(600, topDepartments.length * 30)}>
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
              border: "1px solid #ccc",
              borderRadius: "4px",
              padding: "8px",
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

      {departments.length > maxDepartments && (
        <p className="text-sm text-gray-600 mt-2">
          Showing top {maxDepartments} of {departments.length} departments
        </p>
      )}
    </div>
  );
}

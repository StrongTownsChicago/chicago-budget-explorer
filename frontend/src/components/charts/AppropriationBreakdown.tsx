import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import type { Department } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { getDepartmentColor } from "@/lib/colors";

export interface Props {
  departments: Department[];
}

/**
 * Chart showing spending breakdown by appropriation type.
 * Aggregates subcategories across all departments.
 */
export default function AppropriationBreakdown({ departments }: Props) {
  // Aggregate all subcategories across departments
  const categoryMap = new Map<string, number>();

  for (const dept of departments) {
    for (const subcat of dept.subcategories) {
      const current = categoryMap.get(subcat.name) || 0;
      categoryMap.set(subcat.name, current + subcat.amount);
    }
  }

  const total = Array.from(categoryMap.values()).reduce((sum, val) => sum + val, 0);

  // Sort by amount descending
  const chartData = Array.from(categoryMap.entries())
    .map(([name, amount], index) => ({
      name,
      value: amount,
      percentage: ((amount / total) * 100).toFixed(1),
      color: getDepartmentColor(index),
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={120}
            paddingAngle={2}
            dataKey="value"
            label={({ percentage }) => {
              // Only show label if percentage is significant
              return parseFloat(percentage) > 5 ? `${percentage}%` : "";
            }}
            labelLine={true}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderRadius: "4px",
              padding: "8px",
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={60}
            formatter={(value, entry) => {
              const data = entry.payload as { value: number; percentage: string };
              return `${value} (${data.percentage}%)`;
            }}
            wrapperStyle={{ fontSize: "12px" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

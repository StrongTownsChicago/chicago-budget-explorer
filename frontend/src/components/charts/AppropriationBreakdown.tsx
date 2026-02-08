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

  // Group small categories (< 1.5% of total) into "Other"
  const threshold = total * 0.015;
  const entries = Array.from(categoryMap.entries());
  const majorCategories = entries.filter(([_, amount]) => amount >= threshold);
  const minorCategories = entries.filter(([_, amount]) => amount < threshold);

  const otherAmount = minorCategories.reduce((sum, [_, amount]) => sum + amount, 0);
  const otherCount = minorCategories.length;

  // Build chart data with "Other" category if needed
  const baseCategories = majorCategories.map(([name, amount]) => ({
    name,
    value: amount,
    percentage: ((amount / total) * 100).toFixed(1),
  }));

  const categoriesToDisplay =
    otherCount > 0
      ? [
          ...baseCategories,
          {
            name: `Other (${otherCount} categories)`,
            value: otherAmount,
            percentage: ((otherAmount / total) * 100).toFixed(1),
          },
        ]
      : baseCategories;

  // Sort by amount descending and assign colors
  const chartData = categoriesToDisplay
    .sort((a, b) => b.value - a.value)
    .map((category, index) => ({
      ...category,
      color: getDepartmentColor(index),
    }));

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
            label={({ name, percentage }) => {
              // Only show label if slice is >= 3% to avoid overlap
              const pct = parseFloat(percentage);
              return pct >= 3 ? `${name}: ${percentage}%` : "";
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

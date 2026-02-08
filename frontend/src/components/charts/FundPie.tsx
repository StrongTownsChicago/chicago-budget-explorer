import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import type { FundSummary } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { getDepartmentColor } from "@/lib/colors";

export interface Props {
  funds: FundSummary[];
}

/**
 * Donut chart showing budget breakdown by fund type.
 */
export default function FundPie({ funds }: Props) {
  const total = funds.reduce((sum, fund) => sum + fund.amount, 0);

  // Group small funds (< 1.5% of total) into "Other"
  const threshold = total * 0.015;
  const majorFunds = funds.filter((f) => f.amount >= threshold);
  const minorFunds = funds.filter((f) => f.amount < threshold);

  const otherAmount = minorFunds.reduce((sum, f) => sum + f.amount, 0);
  const otherCount = minorFunds.length;

  // Build chart data with "Other" category if needed
  const baseFunds = majorFunds.map((fund) => ({
    name: fund.name,
    value: fund.amount,
    percentage: ((fund.amount / total) * 100).toFixed(1),
  }));

  const fundsToDisplay =
    otherCount > 0
      ? [
          ...baseFunds,
          {
            name: `Other (${otherCount} funds)`,
            value: otherAmount,
            percentage: ((otherAmount / total) * 100).toFixed(1),
          },
        ]
      : baseFunds;

  // Sort by amount descending and assign colors
  const chartData = fundsToDisplay
    .sort((a, b) => b.value - a.value)
    .map((fund, index) => ({
      ...fund,
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
            innerRadius={80}
            outerRadius={140}
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
            height={36}
            formatter={(value, entry) => {
              const data = entry.payload as { value: number; percentage: string };
              return `${value} (${data.percentage}%)`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

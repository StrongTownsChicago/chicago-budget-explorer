import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { RevenueSource } from "@/lib/types";
import { formatCurrency, formatCompact, formatPercent } from "@/lib/format";

/** Green-based color palette for revenue (distinct from spending blue/red). */
const REVENUE_COLORS = [
  "#2E7D32",
  "#388E3C",
  "#43A047",
  "#4CAF50",
  "#66BB6A",
  "#81C784",
  "#A5D6A7",
  "#C8E6C9",
  "#E8F5E9",
  "#F1F8E9",
  "#DCEDC8",
  "#AED581",
];

export interface Props {
  sources: RevenueSource[];
  totalRevenue: number;
}

/**
 * Horizontal bar chart showing revenue by source category.
 * Includes an accessible table view below the chart.
 */
export default function RevenueBreakdown({ sources, totalRevenue }: Props) {
  const chartData = sources.map((source, index) => ({
    name: source.name,
    amount: source.amount,
    percentage: totalRevenue > 0 ? (source.amount / totalRevenue) * 100 : 0,
    color: REVENUE_COLORS[index % REVENUE_COLORS.length],
  }));

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={Math.min(500, sources.length * 40 + 40)}>
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
            formatter={(value: number) => [formatCurrency(value), "Revenue"]}
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

      {/* Accessible table */}
      <table className="w-full mt-6 text-sm" role="table">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Revenue Source</th>
            <th className="text-right py-2">Amount</th>
            <th className="text-right py-2">% of Total</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => (
            <tr key={source.id} className="border-b hover:bg-gray-50">
              <td className="py-2">{source.name}</td>
              <td className="text-right font-mono">{formatCurrency(source.amount)}</td>
              <td className="text-right">
                {totalRevenue > 0
                  ? formatPercent((source.amount / totalRevenue) * 100, 1, false)
                  : "0.0%"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold border-t-2">
            <td className="py-2">Total Revenue</td>
            <td className="text-right font-mono">{formatCurrency(totalRevenue)}</td>
            <td className="text-right">100.0%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

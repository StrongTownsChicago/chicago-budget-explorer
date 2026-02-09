import { useMemo } from "react";
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

/** Display labels for revenue type groups. */
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
  sources: RevenueSource[];
  totalRevenue: number;
}

/**
 * Group revenue sources by their revenue_type for structured table display.
 * Returns groups in a stable display order, each containing sources sorted by amount.
 */
function groupSourcesByType(
  sources: RevenueSource[],
): { type: string; label: string; sources: RevenueSource[] }[] {
  const groups: Record<string, RevenueSource[]> = {};
  for (const source of sources) {
    const type = source.revenue_type || "other";
    if (!groups[type]) groups[type] = [];
    groups[type].push(source);
  }

  return REVENUE_TYPE_ORDER.filter((type) => groups[type]?.length)
    .map((type) => ({
      type,
      label: REVENUE_TYPE_LABELS[type] || type.replace("_", " "),
      sources: groups[type].sort((a, b) => b.amount - a.amount),
    }))
    .concat(
      // Include any types not in the predefined order
      Object.keys(groups)
        .filter((type) => !REVENUE_TYPE_ORDER.includes(type))
        .map((type) => ({
          type,
          label: REVENUE_TYPE_LABELS[type] || type.replace("_", " "),
          sources: groups[type].sort((a, b) => b.amount - a.amount),
        })),
    );
}

/**
 * Horizontal bar chart showing revenue by source category.
 * Includes an accessible table view below the chart, grouped by revenue type.
 */
export default function RevenueBreakdown({ sources, totalRevenue }: Props) {
  const chartData = sources.map((source, index) => ({
    name: source.name,
    amount: source.amount,
    percentage: totalRevenue > 0 ? (source.amount / totalRevenue) * 100 : 0,
    color: REVENUE_COLORS[index % REVENUE_COLORS.length],
  }));

  const groupedSources = useMemo(() => groupSourcesByType(sources), [sources]);

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={Math.max(300, Math.min(700, sources.length * 32 + 40))}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 160, bottom: 5 }}
        >
          <XAxis
            type="number"
            tickFormatter={(value) => formatCompact(value)}
            style={{ fontSize: "12px" }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            style={{ fontSize: "11px" }}
          />
          <Tooltip
            formatter={(value: number) => [formatCurrency(value), "Revenue"]}
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

      {/* Accessible table grouped by revenue type */}
      <table className="w-full mt-6 text-sm" role="table">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Revenue Source</th>
            <th className="text-right py-2">Amount</th>
            <th className="text-right py-2">% of Total</th>
          </tr>
        </thead>
        <tbody>
          {groupedSources.map((group) => (
            <GroupRows
              key={group.type}
              label={group.label}
              sources={group.sources}
              totalRevenue={totalRevenue}
            />
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

/** Renders a group header row followed by source rows for one revenue type. */
function GroupRows({
  label,
  sources,
  totalRevenue,
}: {
  label: string;
  sources: RevenueSource[];
  totalRevenue: number;
}) {
  const groupTotal = sources.reduce((sum, s) => sum + s.amount, 0);

  return (
    <>
      <tr className="bg-gray-100">
        <td className="py-1.5 font-semibold text-gray-700" colSpan={2}>
          {label}
        </td>
        <td className="py-1.5 text-right text-gray-600 font-medium">
          {totalRevenue > 0
            ? formatPercent((groupTotal / totalRevenue) * 100, 1, false)
            : "0.0%"}
        </td>
      </tr>
      {sources.map((source) => (
        <tr key={source.id} className="border-b hover:bg-gray-50">
          <td className="py-2 pl-4">{source.name}</td>
          <td className="text-right font-mono">{formatCurrency(source.amount)}</td>
          <td className="text-right">
            {totalRevenue > 0
              ? formatPercent((source.amount / totalRevenue) * 100, 1, false)
              : "0.0%"}
          </td>
        </tr>
      ))}
    </>
  );
}

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency, formatCompact } from "@/lib/format";

export interface Props {
  totalRevenue: number;
  totalAppropriations: number;
}

/**
 * Side-by-side bar comparison of revenue vs spending.
 * Shows the fiscal balance at a glance.
 */
export default function RevenueVsSpending({
  totalRevenue,
  totalAppropriations,
}: Props) {
  const data = [
    {
      category: "Budget",
      "Local Revenue": totalRevenue,
      "Total Spending": totalAppropriations,
    },
  ];

  const surplus = totalRevenue - totalAppropriations;
  const surplusLabel = surplus >= 0 ? "Surplus" : "Deficit";
  const surplusColor = surplus >= 0 ? "text-green-700" : "text-red-700";

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="category" />
          <YAxis tickFormatter={(value) => formatCompact(value)} />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: "white",
              border: "none",
              borderRadius: "8px",
              padding: "12px 16px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)",
            }}
          />
          <Legend />
          <Bar dataKey="Local Revenue" fill="#2E7D32" />
          <Bar dataKey="Total Spending" fill="#1976D2" />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 p-4 bg-surface-warm rounded-xl border border-border-subtle">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Local Revenue</div>
            <div className="text-lg font-semibold text-green-700">
              {formatCurrency(totalRevenue)}
            </div>
          </div>
          <div>
            <div className="text-gray-600">Total Spending</div>
            <div className="text-lg font-semibold text-blue-700">
              {formatCurrency(totalAppropriations)}
            </div>
          </div>
          <div>
            <div className="text-gray-600">{surplusLabel}</div>
            <div className={`text-lg font-semibold ${surplusColor}`}>
              {formatCurrency(Math.abs(surplus))}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm text-gray-600">
        Note: Local revenue covers locally-generated funds. Total spending
        includes enterprise funds, grants, pensions, and debt service that may
        be funded by other revenue sources.
      </p>
    </div>
  );
}

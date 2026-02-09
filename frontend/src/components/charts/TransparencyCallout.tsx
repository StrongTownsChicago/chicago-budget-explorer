import { formatCurrency } from "@/lib/format";

export interface Props {
  localRevenue: number;
  grantRevenueEstimated: number | null;
  totalBudget: number;
}

/**
 * Informational callout explaining the gap between local revenue data
 * and total budget (due to grant revenue not being published as open data).
 *
 * Only renders when grant revenue is estimated (non-null, > 0).
 */
export default function TransparencyCallout({
  grantRevenueEstimated,
  totalBudget,
}: Props) {
  if (!grantRevenueEstimated || grantRevenueEstimated <= 0) {
    return null;
  }

  const grantPct =
    totalBudget > 0 ? (grantRevenueEstimated / totalBudget) * 100 : 0;

  return (
    <div
      className="my-6 p-4 border-l-4 border-yellow-500 bg-yellow-50 rounded"
      role="note"
      aria-label="Revenue data transparency notice"
    >
      <div className="flex items-start">
        <span
          className="text-yellow-600 mt-0.5 mr-3 flex-shrink-0 text-lg"
          aria-hidden="true"
        >
          !
        </span>
        <div>
          <h4 className="font-semibold text-yellow-900 mb-2">
            About the Revenue Data
          </h4>
          <p className="text-sm text-yellow-800 mb-2">
            The revenue data shown covers <strong>local funds only</strong>{" "}
            (taxes, fees, enterprise revenue, etc.). It does not include
            federal and state grants, which make up approximately{" "}
            <strong>{formatCurrency(grantRevenueEstimated)}</strong> (
            {grantPct.toFixed(1)}%) of the total budget.
          </p>
          <p className="text-sm text-yellow-800 mb-2">
            Some revenue categories (such as pension fund allocations and
            internal service earnings) represent transfers between city funds
            rather than new revenue from external sources.
          </p>
          <p className="text-sm text-yellow-800">
            Grant revenue is not published in a structured, open-data format.
            We estimate grant funding from appropriations data. The total
            budget including grants is{" "}
            <strong>{formatCurrency(totalBudget)}</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}

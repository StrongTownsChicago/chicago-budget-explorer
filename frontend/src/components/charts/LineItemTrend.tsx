import { useMemo } from "react";
import type { Subcategory } from "@/lib/types";
import TrendChart from "@/components/charts/TrendChart";

export interface Props {
  parentName: string;
  subcategories: Subcategory[];
  label?: string;
  maxDefaultSelected?: number;
}

/**
 * Drill-down component that shows subcategory trend lines for a selected
 * parent item (department or revenue source). Filters to subcategories
 * with at least 2 trend points, then delegates to TrendChart.
 */
export default function LineItemTrend({
  parentName,
  subcategories,
  label = "line items",
  maxDefaultSelected = 5,
}: Props) {
  const trendableSubcategories = useMemo(
    () => subcategories.filter((s) => s.trend && s.trend.length >= 2),
    [subcategories],
  );

  if (trendableSubcategories.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 pt-6 border-t border-border-subtle">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">
        {parentName}: Line-Item Trends
      </h3>
      <p className="text-gray-600 text-sm mb-4">
        Compare individual {label} within {parentName} across fiscal years.
      </p>
      <TrendChart
        items={trendableSubcategories}
        label={label}
        maxDefaultSelected={maxDefaultSelected}
      />
    </div>
  );
}

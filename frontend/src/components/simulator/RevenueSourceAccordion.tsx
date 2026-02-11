import React from "react";
import type { RevenueSource, SimulationConfig, SimulationState } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { getAdjustedRevenueSourceTotal } from "@/lib/simulation-engine";
import SubcategorySlider from "./SubcategorySlider";

/** Default simulation config for revenue sources (all adjustable, 50%-150%). */
const REVENUE_SIMULATION_CONFIG: SimulationConfig = {
  adjustable: true,
  min_pct: 0.5,
  max_pct: 1.5,
  step_pct: 0.01,
  constraints: [],
  description: "",
};

/** Human-readable labels for revenue types. */
const REVENUE_TYPE_LABELS: Record<string, string> = {
  tax: "Tax",
  fee: "Fee",
  enterprise: "Enterprise",
  internal_transfer: "Transfer",
  debt_proceeds: "Debt",
  other: "Other",
};

export interface Props {
  source: RevenueSource;
  state: SimulationState;
  isExpanded: boolean;
  onToggle: (sourceId: string) => void;
  onAdjustSubcategory: (subcategoryId: string, multiplier: number) => void;
}

/**
 * Collapsible revenue source group containing subcategory sliders.
 *
 * Collapsed: Shows source name, revenue type badge, adjusted total, delta from original.
 * Expanded: Header + list of SubcategorySlider for each subcategory.
 * All revenue sources are adjustable (no locked state).
 */
const RevenueSourceAccordion = React.memo(function RevenueSourceAccordion({
  source,
  state,
  isExpanded,
  onToggle,
  onAdjustSubcategory,
}: Props) {
  const adjustedTotal = getAdjustedRevenueSourceTotal(source, state);
  const delta = adjustedTotal - source.amount;
  const typeLabel = REVENUE_TYPE_LABELS[source.revenue_type] ?? source.revenue_type;

  return (
    <div className="card overflow-hidden border-border-subtle hover:border-green-400 transition-colors">
      {/* Revenue source header (always visible) */}
      <button
        onClick={() => onToggle(source.id)}
        className="w-full p-4 flex justify-between items-center hover:bg-green-50/30 transition-colors cursor-pointer"
        aria-expanded={isExpanded}
        aria-controls={`revenue-subcategories-${source.id}`}
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{source.name}</h3>
              <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                {typeLabel}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {source.subcategories.length} line item{source.subcategories.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="font-mono font-bold text-lg">
            {formatCurrency(adjustedTotal)}
          </div>
          {delta !== 0 && (
            <div
              className={`text-sm font-semibold ${delta > 0 ? "text-green-600" : "text-red-600"}`}
            >
              {delta > 0 ? "+" : ""}
              {formatCurrency(delta)}
            </div>
          )}
        </div>
      </button>

      {/* Subcategory sliders (visible when expanded) */}
      {isExpanded && (
        <div
          id={`revenue-subcategories-${source.id}`}
          className="border-t border-gray-200 bg-green-50/20"
          role="region"
          aria-label={`${source.name} subcategories`}
        >
          {source.subcategories.map((sub) => (
            <SubcategorySlider
              key={sub.id}
              subcategory={sub}
              simulationConfig={REVENUE_SIMULATION_CONFIG}
              multiplier={state.adjustments[sub.id] ?? 1.0}
              onAdjust={onAdjustSubcategory}
              reverseColors
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default RevenueSourceAccordion;

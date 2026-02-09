import React from "react";
import type { Subcategory, SimulationConfig } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

export interface Props {
  subcategory: Subcategory;
  simulationConfig: SimulationConfig;
  multiplier: number;
  onAdjust: (subcategoryId: string, multiplier: number) => void;
}

/**
 * Compact slider control for adjusting a single subcategory's budget.
 * Shows subcategory name, original/adjusted amounts, and delta.
 * Inherits min/max/step constraints from the parent department's SimulationConfig.
 */
const SubcategorySlider = React.memo(function SubcategorySlider({
  subcategory,
  simulationConfig,
  multiplier,
  onAdjust,
}: Props) {
  const adjustedAmount = Math.round(subcategory.amount * multiplier);
  const delta = adjustedAmount - subcategory.amount;

  return (
    <div className="py-3 px-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors">
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex-1 min-w-0 mr-3">
          <span
            className="text-sm text-gray-800 block truncate"
            title={subcategory.name}
          >
            {subcategory.name}
          </span>
          <span className="text-xs text-gray-500">
            Original: {formatCurrency(subcategory.amount)}
          </span>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-sm font-semibold">
            {formatCurrency(adjustedAmount)}
          </div>
          {delta !== 0 && (
            <div
              className={`text-xs font-semibold ${delta > 0 ? "text-red-600" : "text-green-600"}`}
            >
              {delta > 0 ? "+" : ""}
              {formatCurrency(delta)}
            </div>
          )}
        </div>
      </div>

      <div className="mb-1">
        <input
          type="range"
          min={simulationConfig.min_pct}
          max={simulationConfig.max_pct}
          step={simulationConfig.step_pct}
          value={multiplier}
          onChange={(e) => onAdjust(subcategory.id, parseFloat(e.target.value))}
          className="w-full h-1.5"
          aria-label={`Adjust ${subcategory.name} budget`}
          aria-valuemin={simulationConfig.min_pct}
          aria-valuemax={simulationConfig.max_pct}
          aria-valuenow={multiplier}
          aria-valuetext={`${Math.round(multiplier * 100)}% of original budget`}
        />
      </div>

      <div className="flex justify-between text-[10px] text-gray-400">
        <span>{Math.round(simulationConfig.min_pct * 100)}%</span>
        <span className="font-semibold text-gray-600">
          {Math.round(multiplier * 100)}%
        </span>
        <span>{Math.round(simulationConfig.max_pct * 100)}%</span>
      </div>
    </div>
  );
});

export default SubcategorySlider;

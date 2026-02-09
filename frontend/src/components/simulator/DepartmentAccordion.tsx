import React from "react";
import type { Department, SimulationState } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { getAdjustedDepartmentTotal } from "@/lib/simulation-engine";
import SubcategorySlider from "./SubcategorySlider";

export interface Props {
  department: Department;
  state: SimulationState;
  isExpanded: boolean;
  onToggle: (deptId: string) => void;
  onAdjustSubcategory: (subcategoryId: string, multiplier: number) => void;
}

/**
 * Collapsible department group containing subcategory sliders.
 *
 * Collapsed: Shows department name, adjusted total, delta from original.
 * Expanded: Header + list of SubcategorySlider for each subcategory.
 * Non-adjustable departments show locked state with no expand capability.
 */
const DepartmentAccordion = React.memo(function DepartmentAccordion({
  department,
  state,
  isExpanded,
  onToggle,
  onAdjustSubcategory,
}: Props) {
  const adjustedTotal = getAdjustedDepartmentTotal(department, state);
  const delta = adjustedTotal - department.amount;

  // Non-adjustable departments: locked display, no expand
  if (!department.simulation.adjustable) {
    return (
      <div className="card overflow-hidden opacity-60 bg-gray-50" role="presentation">
        <div className="p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">&#x1F512;</span>
            <div>
              <h3 className="font-semibold text-gray-700">{department.name}</h3>
              <p className="text-xs text-gray-500">
                {department.simulation.constraints[0] || department.simulation.description}
              </p>
            </div>
          </div>
          <span className="text-gray-600 font-mono text-sm">
            {formatCurrency(department.amount)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden border-border-subtle hover:border-chicago-light-blue transition-colors">
      {/* Department header (always visible) */}
      <button
        onClick={() => onToggle(department.id)}
        className="w-full p-4 flex justify-between items-center hover:bg-gray-50/50 transition-colors cursor-pointer"
        aria-expanded={isExpanded}
        aria-controls={`dept-subcategories-${department.id}`}
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
            <h3 className="font-semibold text-gray-900">{department.name}</h3>
            <p className="text-xs text-gray-500">
              {department.subcategories.length} line items
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="font-mono font-bold text-lg">
            {formatCurrency(adjustedTotal)}
          </div>
          {delta !== 0 && (
            <div
              className={`text-sm font-semibold ${delta > 0 ? "text-red-600" : "text-green-600"}`}
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
          id={`dept-subcategories-${department.id}`}
          className="border-t border-gray-200 bg-gray-50/30"
          role="region"
          aria-label={`${department.name} subcategories`}
        >
          {department.subcategories.map((sub) => (
            <SubcategorySlider
              key={sub.id}
              subcategory={sub}
              simulationConfig={department.simulation}
              multiplier={state.adjustments[sub.id] ?? 1.0}
              onAdjust={onAdjustSubcategory}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default DepartmentAccordion;

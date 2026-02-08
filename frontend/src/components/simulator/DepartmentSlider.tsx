import type { Department } from "@/lib/types";
import type { SimulationState } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { getAdjustedAmount } from "@/lib/simulation-engine";

export interface Props {
  department: Department;
  state: SimulationState;
  onAdjust: (deptId: string, multiplier: number) => void;
}

/**
 * Slider control for adjusting a single department's budget.
 * Shows current value, change amount, and min/max constraints.
 * Non-adjustable departments are disabled with explanation.
 */
export default function DepartmentSlider({ department, state, onAdjust }: Props) {
  const adjustedAmount = getAdjustedAmount(department, state);
  const delta = adjustedAmount - department.amount;
  const multiplier = state.adjustments[department.id] ?? 1.0;

  if (!department.simulation.adjustable) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg opacity-60" role="presentation">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-gray-700">{department.name}</h3>
          <span className="text-gray-600 font-mono text-sm">
            {formatCurrency(department.amount)}
          </span>
        </div>
        <p className="text-sm text-gray-600 flex items-center gap-2">
          <span className="text-lg">🔒</span>
          {department.simulation.constraints[0] || department.simulation.description}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-400 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{department.name}</h3>
          <p className="text-xs text-gray-500 mt-1">
            Original: {formatCurrency(department.amount)}
          </p>
        </div>
        <div className="text-right ml-4">
          <div className="font-mono font-bold text-lg">
            {formatCurrency(adjustedAmount)}
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
      </div>

      <div className="mb-2">
        <input
          type="range"
          min={department.simulation.min_pct}
          max={department.simulation.max_pct}
          step={department.simulation.step_pct}
          value={multiplier}
          onChange={(e) => onAdjust(department.id, parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          aria-label={`Adjust ${department.name} budget`}
          aria-valuemin={department.simulation.min_pct}
          aria-valuemax={department.simulation.max_pct}
          aria-valuenow={multiplier}
          aria-valuetext={`${Math.round(multiplier * 100)}% of original budget`}
        />
      </div>

      <div className="flex justify-between text-xs text-gray-500">
        <span>{Math.round(department.simulation.min_pct * 100)}%</span>
        <span className="font-semibold text-gray-700">
          {Math.round(multiplier * 100)}%
        </span>
        <span>{Math.round(department.simulation.max_pct * 100)}%</span>
      </div>
    </div>
  );
}

export interface Props {
  availableYears: string[];
  baseYear: string;
  targetYear: string;
  onBaseYearChange: (year: string) => void;
  onTargetYearChange: (year: string) => void;
}

/** Format year for display (fy2025 -> FY2025). */
function formatYear(year: string): string {
  return year.toUpperCase();
}

/**
 * Dual-dropdown year selector for comparison page.
 * Prevents selecting the same year for both base and target.
 * Includes a swap button to reverse comparison direction.
 */
export default function YearPairSelector({
  availableYears,
  baseYear,
  targetYear,
  onBaseYearChange,
  onTargetYearChange,
}: Props) {
  const handleSwap = () => {
    onBaseYearChange(targetYear);
    onTargetYearChange(baseYear);
  };

  const selectClassName =
    "px-3 py-2 border border-white/30 rounded-lg bg-white/10 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-shadow";

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="year-pair-selector">
      {/* Base year selector */}
      <div className="flex items-center gap-2">
        <label htmlFor="base-year" className="text-sm font-medium text-white/80">
          From
        </label>
        <select
          id="base-year"
          value={baseYear}
          onChange={(e) => onBaseYearChange(e.target.value)}
          className={selectClassName}
          data-testid="base-year-select"
        >
          {availableYears.map((year) => (
            <option
              key={year}
              value={year}
              disabled={year === targetYear}
              className="text-gray-900"
            >
              {formatYear(year)}
            </option>
          ))}
        </select>
      </div>

      {/* Swap button */}
      <button
        type="button"
        onClick={handleSwap}
        className="px-2 py-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
        aria-label="Swap years"
        title="Swap comparison direction"
        data-testid="swap-years-button"
      >
        &#8644;
      </button>

      {/* Target year selector */}
      <div className="flex items-center gap-2">
        <label htmlFor="target-year" className="text-sm font-medium text-white/80">
          To
        </label>
        <select
          id="target-year"
          value={targetYear}
          onChange={(e) => onTargetYearChange(e.target.value)}
          className={selectClassName}
          data-testid="target-year-select"
        >
          {availableYears.map((year) => (
            <option
              key={year}
              value={year}
              disabled={year === baseYear}
              className="text-gray-900"
            >
              {formatYear(year)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

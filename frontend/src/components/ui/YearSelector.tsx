import { useState } from "react";

export interface Props {
  availableYears: string[];
  defaultYear: string;
  onYearChange: (year: string) => void;
}

export default function YearSelector({ availableYears, defaultYear, onYearChange }: Props) {
  const [selectedYear, setSelectedYear] = useState(defaultYear);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const year = event.target.value;
    setSelectedYear(year);
    onYearChange(year);
  };

  // Format year for display (fy2025 -> FY2025)
  const formatYear = (year: string) => year.toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <label htmlFor="year-selector" className="text-sm font-medium text-gray-700">
        Fiscal Year:
      </label>
      <select
        id="year-selector"
        value={selectedYear}
        onChange={handleChange}
        className="px-4 py-2 border border-border-subtle rounded-lg bg-white text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-chicago-blue focus:border-transparent transition-shadow"
        style={{
          boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
        }}
      >
        {availableYears.map((year) => (
          <option key={year} value={year}>
            {formatYear(year)}
          </option>
        ))}
      </select>
    </div>
  );
}

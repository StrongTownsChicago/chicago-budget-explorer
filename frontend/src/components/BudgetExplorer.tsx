import { useState } from "react";
import type { BudgetData } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import YearSelector from "@/components/ui/YearSelector";
import DepartmentBar from "@/components/charts/DepartmentBar";
import FundPie from "@/components/charts/FundPie";
import AppropriationBreakdown from "@/components/charts/AppropriationBreakdown";
import BudgetTreemap from "@/components/charts/BudgetTreemap";

export interface Props {
  entityId: string;
  entityName: string;
  budgetDataByYear: Record<string, BudgetData>;
  availableYears: string[];
  defaultYear: string;
}

export default function BudgetExplorer({
  entityId,
  entityName,
  budgetDataByYear,
  availableYears,
  defaultYear,
}: Props) {
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const data = budgetDataByYear[selectedYear];

  return (
    <div className="space-y-12">
      {/* Header */}
      <header>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">{entityName}</h1>
            <p className="text-xl text-gray-600 mt-2">
              {data.metadata.fiscal_year_label} Budget:{" "}
              {formatCurrency(data.metadata.total_appropriations)}
            </p>
          </div>
          <YearSelector
            availableYears={availableYears}
            defaultYear={defaultYear}
            onYearChange={setSelectedYear}
          />
        </div>

        <div className="mt-4 flex gap-3">
          <a
            href={`/entity/${entityId}/simulate`}
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Try the Simulator →
          </a>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
          >
            ← Back to Home
          </a>
        </div>
      </header>

      {/* Department Breakdown */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Spending by Department</h2>
        <DepartmentBar
          departments={data.appropriations.by_department}
          totalBudget={data.metadata.total_appropriations}
        />
      </section>

      {/* Fund Breakdown */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Spending by Fund Type</h2>
        <FundPie funds={data.appropriations.by_fund} />
      </section>

      {/* Appropriation Type */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Spending by Category</h2>
        <AppropriationBreakdown departments={data.appropriations.by_department} />
      </section>

      {/* Treemap */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Budget Treemap</h2>
        <p className="text-gray-600 mb-4">
          Visual representation of the budget with departments sized by their budget allocation.
        </p>
        <BudgetTreemap departments={data.appropriations.by_department} />
      </section>

      {/* Data Source Attribution */}
      <footer className="mt-12 pt-6 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          Data Source: {data.metadata.data_source} (Dataset: {data.metadata.source_dataset_id})
          <br />
          Extracted: {new Date(data.metadata.extraction_date).toLocaleDateString()}
          <br />
          Pipeline Version: {data.metadata.pipeline_version}
        </p>
      </footer>
    </div>
  );
}

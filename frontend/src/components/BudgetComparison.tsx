import { useState, useMemo, useCallback } from "react";
import type { BudgetData } from "@/lib/types";
import {
  compareBudgets,
  compareDepartments,
  compareRevenueSources,
} from "@/lib/comparison-engine";
import YearPairSelector from "@/components/ui/YearPairSelector";
import ComparisonSummary from "@/components/comparison/ComparisonSummary";
import DepartmentComparisonTable from "@/components/comparison/DepartmentComparisonTable";
import RevenueComparison from "@/components/comparison/RevenueComparison";
import Tabs from "@/components/ui/Tabs";
import type { Tab } from "@/components/ui/Tabs";

export interface Props {
  entityId: string;
  entityName: string;
  budgetDataByYear: Record<string, BudgetData>;
  availableYears: string[];
  defaultYear: string;
}

/**
 * Top-level React component for the budget year-over-year comparison page.
 * Manages year selection state and orchestrates child comparison components.
 */
export default function BudgetComparison({
  entityId,
  entityName,
  budgetDataByYear,
  availableYears,
  defaultYear,
}: Props) {
  // Default: base = second-most-recent, target = most recent (defaultYear)
  const initialBaseYear =
    availableYears.length >= 2
      ? availableYears[1]!
      : availableYears[0] ?? defaultYear;

  const [baseYear, setBaseYear] = useState(initialBaseYear);
  const [targetYear, setTargetYear] = useState(defaultYear);

  const handleBaseYearChange = useCallback(
    (year: string) => {
      setBaseYear(year);
    },
    [],
  );

  const handleTargetYearChange = useCallback(
    (year: string) => {
      setTargetYear(year);
    },
    [],
  );

  // Edge case: entity has fewer than 2 years
  if (availableYears.length < 2) {
    return (
      <div className="space-y-10">
        <header
          className="gradient-hero text-white -mx-4 -mt-8 px-4 py-10"
          style={{
            background: "linear-gradient(135deg, #0051A5 0%, #003B7A 100%)",
          }}
        >
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-extrabold tracking-tight">
              {entityName} - Budget Comparison
            </h1>
            <a
              href={`/entity/${entityId}`}
              className="inline-block mt-4 text-white/70 hover:text-white transition-colors"
            >
              &larr; Back to {entityName} Overview
            </a>
          </div>
        </header>
        <div className="max-w-6xl mx-auto card p-8 text-center" data-testid="single-year-message">
          <p className="text-gray-600 text-lg">
            At least 2 fiscal years are needed for comparison.
          </p>
          <a
            href={`/entity/${entityId}`}
            className="btn-primary inline-block mt-4"
          >
            Back to Overview
          </a>
        </div>
      </div>
    );
  }

  const baseData = budgetDataByYear[baseYear];
  const targetData = budgetDataByYear[targetYear];

  if (!baseData || !targetData) return null;

  const summary = useMemo(
    () => compareBudgets(baseData, targetData),
    [baseData, targetData],
  );

  const departments = useMemo(
    () => compareDepartments(baseData, targetData),
    [baseData, targetData],
  );

  const revenueSources = useMemo(
    () => compareRevenueSources(baseData, targetData),
    [baseData, targetData],
  );

  const tabs: Tab[] = [
    {
      id: "spending",
      label: "Spending",
      content: (
        <section className="card p-6">
          <h2 className="section-heading">Department Comparison</h2>
          <DepartmentComparisonTable
            departments={departments}
            baseYearLabel={summary.baseYearLabel}
            targetYearLabel={summary.targetYearLabel}
            baseBudgetData={baseData}
            targetBudgetData={targetData}
          />
        </section>
      ),
    },
  ];

  if (revenueSources) {
    tabs.push({
      id: "revenue",
      label: "Revenue",
      content: (
        <section className="card p-6">
          <h2 className="section-heading">Revenue Source Comparison</h2>
          <RevenueComparison
            sources={revenueSources}
            baseYearLabel={summary.baseYearLabel}
            targetYearLabel={summary.targetYearLabel}
            baseBudgetData={baseData}
            targetBudgetData={targetData}
          />
        </section>
      ),
    });
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <header
        className="gradient-hero text-white -mx-4 -mt-8 px-4 py-10"
        style={{
          background: "linear-gradient(135deg, #0051A5 0%, #003B7A 100%)",
        }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight">
                {entityName} - Budget Comparison
              </h1>
              <p className="text-lg text-white/80 mt-2">
                Comparing {summary.baseYearLabel} to {summary.targetYearLabel}
              </p>
            </div>
            <YearPairSelector
              availableYears={availableYears}
              baseYear={baseYear}
              targetYear={targetYear}
              onBaseYearChange={handleBaseYearChange}
              onTargetYearChange={handleTargetYearChange}
            />
          </div>
          <div className="mt-5 flex gap-3">
            <a
              href={`/entity/${entityId}`}
              className="inline-block px-6 py-3 bg-white/15 text-white rounded-lg hover:bg-white/25 transition-all font-semibold border border-white/30"
            >
              &larr; Back to Overview
            </a>
          </div>
        </div>
      </header>

      {/* Comparison Summary */}
      <section className="card p-6">
        <h2 className="section-heading">Summary</h2>
        <ComparisonSummary summary={summary} />
      </section>

      {/* Tabbed Content: Spending / Revenue */}
      <Tabs tabs={tabs} defaultTab="spending" />

      {/* Data Source Attribution */}
      <footer className="mt-8 pt-6 border-t border-border-subtle">
        <p className="text-sm text-gray-500">
          Data Source: {targetData.metadata.data_source}
          <br />
          Pipeline Version: {targetData.metadata.pipeline_version}
        </p>
      </footer>
    </div>
  );
}

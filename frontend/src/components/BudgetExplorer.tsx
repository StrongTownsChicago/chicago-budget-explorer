import { useState, useMemo } from "react";
import type { BudgetData } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import YearSelector from "@/components/ui/YearSelector";
import BudgetSummary from "@/components/BudgetSummary";
import DepartmentBar from "@/components/charts/DepartmentBar";
import FundPie from "@/components/charts/FundPie";
import AppropriationBreakdown from "@/components/charts/AppropriationBreakdown";
import BudgetTreemap from "@/components/charts/BudgetTreemap";
import TrendChart from "@/components/charts/TrendChart";
import LineItemTrend from "@/components/charts/LineItemTrend";
import RevenueBreakdown from "@/components/charts/RevenueBreakdown";
import RevenueVsSpending from "@/components/charts/RevenueVsSpending";
import TransparencyCallout from "@/components/charts/TransparencyCallout";
import Tabs from "@/components/ui/Tabs";
import type { Tab } from "@/components/ui/Tabs";

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
  const [selectedExpenseDeptId, setSelectedExpenseDeptId] = useState<string | null>(null);
  const [selectedRevenueSourceId, setSelectedRevenueSourceId] = useState<string | null>(null);
  const data = budgetDataByYear[selectedYear];

  if (!data) return null;

  const selectedExpenseDept = useMemo(
    () =>
      selectedExpenseDeptId
        ? data.appropriations.by_department.find((d) => d.id === selectedExpenseDeptId) ?? null
        : null,
    [data.appropriations.by_department, selectedExpenseDeptId],
  );

  const selectedRevenueSource = useMemo(
    () =>
      selectedRevenueSourceId && data.revenue
        ? data.revenue.by_source.find((s) => s.id === selectedRevenueSourceId) ?? null
        : null,
    [data.revenue, selectedRevenueSourceId],
  );

  const hasExpenseTrendData = data.appropriations.by_department.some(
    (d) => d.trend && d.trend.length > 1,
  );

  const hasRevenueTrendData = Boolean(
    data.revenue?.by_source.some((s) => s.trend && s.trend.length > 1),
  );

  const hasTrendData = hasExpenseTrendData || hasRevenueTrendData;

  const tabs: Tab[] = [
    {
      id: "spending",
      label: "Spending",
      content: (
        <div className="space-y-12">
          <section className="card p-6">
            <h2 className="section-heading">Spending by Department</h2>
            <DepartmentBar
              departments={data.appropriations.by_department}
              totalBudget={data.metadata.total_appropriations}
            />
          </section>

          <section className="card p-6">
            <h2 className="section-heading">Spending by Fund Type</h2>
            <FundPie funds={data.appropriations.by_fund} />
          </section>

          <section className="card p-6">
            <h2 className="section-heading">Spending by Category</h2>
            <AppropriationBreakdown
              departments={data.appropriations.by_department}
            />
          </section>

          <section className="card p-6">
            <h2 className="section-heading">Budget Treemap</h2>
            <p className="text-gray-600 mb-4">
              Visual representation of the budget with departments sized by
              their budget allocation.
            </p>
            <BudgetTreemap departments={data.appropriations.by_department} />
          </section>
        </div>
      ),
    },
  ];

  if (data.revenue) {
    tabs.push({
      id: "revenue",
      label: "Revenue",
      content: (
        <div className="space-y-12">
          <section className="card p-6">
            <h2 className="section-heading">Revenue</h2>
            <p className="text-gray-600 mb-4">
              Where the money comes from: a breakdown of revenue by source.
            </p>

            <TransparencyCallout
              localRevenue={data.revenue.total_revenue}
              grantRevenueEstimated={data.revenue.grant_revenue_estimated}
              totalBudget={data.metadata.total_appropriations}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Revenue by Source
                </h3>
                <RevenueBreakdown
                  sources={data.revenue.by_source}
                  totalRevenue={data.revenue.total_revenue}
                />
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Revenue vs. Spending
                </h3>
                <RevenueVsSpending
                  totalRevenue={data.revenue.total_revenue}
                  totalAppropriations={data.metadata.total_appropriations}
                />
              </div>
            </div>
          </section>
        </div>
      ),
    });
  }

  if (hasTrendData) {
    tabs.push({
      id: "trends",
      label: "Trends",
      content: (
        <div className="space-y-12">
          {hasExpenseTrendData && (
            <section className="card p-6">
              <h2 className="section-heading">Expense Trends</h2>
              <p className="text-gray-600 mb-4">
                Compare department budgets across fiscal years.
              </p>
              <TrendChart
                items={data.appropriations.by_department}
                label="departments"
              />

              {/* Expense line-item drill-down */}
              <div className="mt-6 pt-6 border-t border-border-subtle">
                <label
                  htmlFor="expense-drilldown"
                  className="text-sm font-semibold text-gray-700 mr-2"
                >
                  Explore line items for:
                </label>
                <select
                  id="expense-drilldown"
                  className="px-3 py-1.5 text-sm border border-border-subtle rounded-lg bg-white text-gray-700"
                  value={selectedExpenseDeptId ?? ""}
                  onChange={(e) =>
                    setSelectedExpenseDeptId(e.target.value || null)
                  }
                >
                  <option value="">Select a department...</option>
                  {data.appropriations.by_department
                    .filter((d) =>
                      d.subcategories.some(
                        (s) => s.trend && s.trend.length >= 2,
                      ),
                    )
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>

                {selectedExpenseDept && (
                  <LineItemTrend
                    parentName={selectedExpenseDept.name}
                    subcategories={selectedExpenseDept.subcategories}
                    label="line items"
                  />
                )}
              </div>
            </section>
          )}

          {hasRevenueTrendData && data.revenue && (
            <section className="card p-6">
              <h2 className="section-heading">Revenue Trends</h2>
              <p className="text-gray-600 mb-4">
                Compare revenue sources across fiscal years.
              </p>
              <TrendChart
                items={data.revenue.by_source}
                label="revenue sources"
              />

              {/* Revenue line-item drill-down */}
              <div className="mt-6 pt-6 border-t border-border-subtle">
                <label
                  htmlFor="revenue-drilldown"
                  className="text-sm font-semibold text-gray-700 mr-2"
                >
                  Explore line items for:
                </label>
                <select
                  id="revenue-drilldown"
                  className="px-3 py-1.5 text-sm border border-border-subtle rounded-lg bg-white text-gray-700"
                  value={selectedRevenueSourceId ?? ""}
                  onChange={(e) =>
                    setSelectedRevenueSourceId(e.target.value || null)
                  }
                >
                  <option value="">Select a revenue source...</option>
                  {data.revenue.by_source
                    .filter((s) =>
                      s.subcategories.some(
                        (sc) => sc.trend && sc.trend.length >= 2,
                      ),
                    )
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>

                {selectedRevenueSource && (
                  <LineItemTrend
                    parentName={selectedRevenueSource.name}
                    subcategories={selectedRevenueSource.subcategories}
                    label="revenue lines"
                  />
                )}
              </div>
            </section>
          )}
        </div>
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
                {entityName}
              </h1>
              <p className="text-xl text-white/80 mt-2">
                {data.metadata.fiscal_year_label} Operating Budget:{" "}
                {formatCurrency(
                  data.metadata.operating_appropriations ||
                    data.metadata.total_appropriations,
                )}
              </p>
            </div>
            <YearSelector
              availableYears={availableYears}
              defaultYear={defaultYear}
              onYearChange={setSelectedYear}
            />
          </div>

          <div className="mt-5 flex gap-3">
            <a
              href={`/entity/${entityId}/simulate`}
              className="inline-block px-6 py-3 bg-white text-chicago-blue rounded-lg hover:bg-gray-100 transition-all font-semibold shadow-lg"
              style={{ color: "#0051A5" }}
            >
              Try the Simulator &rarr;
            </a>
            <a
              href="/"
              className="inline-block px-6 py-3 bg-white/15 text-white rounded-lg hover:bg-white/25 transition-all font-semibold border border-white/30"
            >
              &larr; Back to Home
            </a>
          </div>
        </div>
      </header>

      {/* Budget Summary */}
      <section className="card p-6">
        <BudgetSummary metadata={data.metadata} />
      </section>

      {/* Tabbed Content */}
      <Tabs tabs={tabs} defaultTab="spending" />

      {/* Data Source Attribution */}
      <footer className="mt-8 pt-6 border-t border-border-subtle">
        <p className="text-sm text-gray-500">
          Data Source: {data.metadata.data_source} (Dataset:{" "}
          {data.metadata.source_dataset_id})
          <br />
          Extracted:{" "}
          {new Date(data.metadata.extraction_date).toLocaleDateString()}
          <br />
          Pipeline Version: {data.metadata.pipeline_version}
        </p>
      </footer>
    </div>
  );
}

import { useState, useMemo, useCallback } from "react";
import type { ComparisonItem } from "@/lib/comparison-engine";
import type { BudgetData } from "@/lib/types";
import { compareSubcategories } from "@/lib/comparison-engine";
import { formatCurrency, formatPercent } from "@/lib/format";
import LineItemComparison from "./LineItemComparison";

type SortColumn = "name" | "baseAmount" | "targetAmount" | "delta" | "deltaPct";
type SortDirection = "asc" | "desc";

export interface Props {
  departments: ComparisonItem[];
  baseYearLabel: string;
  targetYearLabel: string;
  baseBudgetData: BudgetData;
  targetBudgetData: BudgetData;
}

/**
 * Format a delta percentage for display, capping at +/-999%.
 */
function formatDeltaPct(deltaPct: number | null): string {
  if (deltaPct === null) return "N/A";
  if (Math.abs(deltaPct) > 999) {
    return deltaPct > 0 ? ">+999%" : "<-999%";
  }
  return formatPercent(deltaPct);
}

function getDeltaColorClass(delta: number | null): string {
  if (delta === null || Math.abs(delta) < 1000) return "text-gray-600";
  return delta > 0 ? "text-green-700" : "text-red-700";
}

/** Get sortable value, treating null as negative infinity for consistent sorting. */
function getSortValue(item: ComparisonItem, column: SortColumn): number | string {
  switch (column) {
    case "name":
      return item.name.toLowerCase();
    case "baseAmount":
      return item.baseAmount ?? -Infinity;
    case "targetAmount":
      return item.targetAmount ?? -Infinity;
    case "delta":
      return item.delta !== null ? Math.abs(item.delta) : -Infinity;
    case "deltaPct":
      return item.deltaPct !== null ? Math.abs(item.deltaPct) : -Infinity;
  }
}

/**
 * Sortable table of departments with base/target amounts, dollar and percentage changes.
 * Clicking a row expands to show subcategory line-item comparison.
 */
export default function DepartmentComparisonTable({
  departments,
  baseYearLabel,
  targetYearLabel,
  baseBudgetData,
  targetBudgetData,
}: Props) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("delta");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedDeptId, setExpandedDeptId] = useState<string | null>(null);

  const sortedDepartments = useMemo(() => {
    return [...departments].sort((a, b) => {
      const aVal = getSortValue(a, sortColumn);
      const bVal = getSortValue(b, sortColumn);

      let comparison: number;
      if (typeof aVal === "string" && typeof bVal === "string") {
        comparison = aVal.localeCompare(bVal);
      } else {
        comparison = (aVal as number) - (bVal as number);
      }

      return sortDirection === "desc" ? -comparison : comparison;
    });
  }, [departments, sortColumn, sortDirection]);

  const handleSort = useCallback(
    (column: SortColumn) => {
      if (sortColumn === column) {
        setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
      } else {
        setSortColumn(column);
        setSortDirection("desc");
      }
    },
    [sortColumn],
  );

  const handleRowClick = useCallback(
    (deptId: string) => {
      setExpandedDeptId((prev) => (prev === deptId ? null : deptId));
    },
    [],
  );

  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent, deptId: string) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleRowClick(deptId);
      }
    },
    [handleRowClick],
  );

  if (departments.length === 0) {
    return (
      <p className="text-gray-500 text-sm py-4" data-testid="no-departments">
        No departments to compare.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto" data-testid="department-comparison-table">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <SortableHeader
              label="Department"
              column="name"
              currentSort={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
            />
            <SortableHeader
              label={baseYearLabel}
              column="baseAmount"
              currentSort={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              align="right"
            />
            <SortableHeader
              label={targetYearLabel}
              column="targetAmount"
              currentSort={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              align="right"
            />
            <SortableHeader
              label="$ Change"
              column="delta"
              currentSort={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              align="right"
            />
            <SortableHeader
              label="% Change"
              column="deltaPct"
              currentSort={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              align="right"
            />
          </tr>
        </thead>
        <tbody>
          {sortedDepartments.map((dept) => (
            <DepartmentRow
              key={dept.id}
              department={dept}
              isExpanded={expandedDeptId === dept.id}
              onRowClick={handleRowClick}
              onRowKeyDown={handleRowKeyDown}
              baseYearLabel={baseYearLabel}
              targetYearLabel={targetYearLabel}
              baseBudgetData={baseBudgetData}
              targetBudgetData={targetBudgetData}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Sortable column header with aria-sort and sort indicator. */
function SortableHeader({
  label,
  column,
  currentSort,
  direction,
  onSort,
  align = "left",
}: {
  label: string;
  column: SortColumn;
  currentSort: SortColumn;
  direction: SortDirection;
  onSort: (column: SortColumn) => void;
  align?: "left" | "right";
}) {
  const isActive = currentSort === column;
  const ariaSort = isActive
    ? direction === "asc"
      ? ("ascending" as const)
      : ("descending" as const)
    : ("none" as const);

  return (
    <th
      scope="col"
      className={`py-2 px-2 font-medium text-gray-600 ${align === "right" ? "text-right" : "text-left"}`}
      aria-sort={ariaSort}
    >
      <button
        className="inline-flex items-center gap-1 hover:text-gray-900 cursor-pointer"
        onClick={() => onSort(column)}
        type="button"
      >
        {label}
        <span className="text-xs" aria-hidden="true">
          {isActive ? (direction === "asc" ? "\u25B2" : "\u25BC") : "\u25B4\u25BE"}
        </span>
      </button>
    </th>
  );
}

/** A single department row, expandable to show subcategory comparison. */
function DepartmentRow({
  department,
  isExpanded,
  onRowClick,
  onRowKeyDown,
  baseYearLabel,
  targetYearLabel,
  baseBudgetData,
  targetBudgetData,
}: {
  department: ComparisonItem;
  isExpanded: boolean;
  onRowClick: (id: string) => void;
  onRowKeyDown: (event: React.KeyboardEvent, id: string) => void;
  baseYearLabel: string;
  targetYearLabel: string;
  baseBudgetData: BudgetData;
  targetBudgetData: BudgetData;
}) {
  const subcategories = useMemo(() => {
    if (!isExpanded) return [];
    const baseDept = baseBudgetData.appropriations.by_department.find(
      (d) => d.id === department.id,
    );
    const targetDept = targetBudgetData.appropriations.by_department.find(
      (d) => d.id === department.id,
    );
    return compareSubcategories(baseDept, targetDept);
  }, [isExpanded, department.id, baseBudgetData, targetBudgetData]);

  return (
    <>
      <tr
        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
        onClick={() => onRowClick(department.id)}
        onKeyDown={(e) => onRowKeyDown(e, department.id)}
        tabIndex={0}
        role="row"
        aria-expanded={isExpanded}
        data-testid={`dept-row-${department.id}`}
      >
        <th scope="row" className="text-left py-2.5 px-2 font-normal">
          <span className="flex items-center gap-2">
            <span
              className="text-xs text-gray-400 transition-transform"
              style={{ transform: isExpanded ? "rotate(90deg)" : "none" }}
              aria-hidden="true"
            >
              {"\u25B6"}
            </span>
            <span className="font-medium text-gray-800">{department.name}</span>
            {department.status === "added" && (
              <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">
                New
              </span>
            )}
            {department.status === "removed" && (
              <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium">
                Removed
              </span>
            )}
          </span>
        </th>
        <td className="text-right py-2.5 px-2 font-mono">
          {department.baseAmount !== null ? formatCurrency(department.baseAmount) : "--"}
        </td>
        <td className="text-right py-2.5 px-2 font-mono">
          {department.targetAmount !== null ? formatCurrency(department.targetAmount) : "--"}
        </td>
        <td className={`text-right py-2.5 px-2 font-mono ${getDeltaColorClass(department.delta)}`}>
          {department.delta !== null
            ? `${department.delta >= 0 ? "+" : ""}${formatCurrency(department.delta)}`
            : "--"}
        </td>
        <td className={`text-right py-2.5 px-2 font-mono ${getDeltaColorClass(department.delta)}`}>
          {formatDeltaPct(department.deltaPct)}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={5} className="bg-gray-50 px-4 py-3">
            <LineItemComparison
              items={subcategories}
              baseYearLabel={baseYearLabel}
              targetYearLabel={targetYearLabel}
            />
          </td>
        </tr>
      )}
    </>
  );
}

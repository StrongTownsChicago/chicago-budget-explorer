/**
 * TypeScript types for Chicago Budget Explorer.
 *
 * These types mirror the Pydantic models from the pipeline.
 * They are the contract between backend and frontend.
 */

export interface FundBreakdown {
  fund_id: string;
  fund_name: string;
  amount: number;
}

export interface Subcategory {
  id: string;
  name: string;
  amount: number;
}

export interface SimulationConfig {
  adjustable: boolean;
  min_pct: number;
  max_pct: number;
  step_pct: number;
  constraints: string[];
  description: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  amount: number;
  prior_year_amount: number | null;
  change_pct: number | null;
  fund_breakdown: FundBreakdown[];
  subcategories: Subcategory[];
  simulation: SimulationConfig;
}

export type FundType = "operating" | "restricted" | "capital" | "grant";

export interface FundSummary {
  id: string;
  name: string;
  amount: number;
  fund_type: FundType;
}

export interface Appropriations {
  by_department: Department[];
  by_fund: FundSummary[];
}

export interface Metadata {
  entity_id: string;
  entity_name: string;
  fiscal_year: string;
  fiscal_year_label: string;
  fiscal_year_start: string; // ISO date
  fiscal_year_end: string; // ISO date

  // Comprehensive budget totals
  gross_appropriations: number;
  accounting_adjustments: number;
  total_appropriations: number;
  operating_appropriations: number | null;
  enterprise_fund_total: number;
  pension_fund_total: number;
  grant_fund_total: number;
  debt_service_total: number;

  data_source: string;
  source_dataset_id: string;
  extraction_date: string; // ISO date
  pipeline_version: string;
  notes: string | null;
}

export interface BudgetData {
  metadata: Metadata;
  appropriations: Appropriations;
  schema_version: string;
}

// Manifest types

export type EntityStatus = "active" | "coming_soon" | "hidden";

export interface EntityEntry {
  id: string;
  name: string;
  entity_type: string;
  status: EntityStatus;
  default_year: string;
  available_years: string[];
  property_tax_share_pct: number;
  color: string;
}

export interface Manifest {
  entities: EntityEntry[];
  last_updated: string; // ISO timestamp
  pipeline_version: string;
}

// Simulation state types

export interface SimulationState {
  adjustments: Record<string, number>; // dept id → multiplier
  totalBudget: number;
  originalBudget: number;
}

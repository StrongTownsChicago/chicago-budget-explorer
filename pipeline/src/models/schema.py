"""Pydantic models for Chicago Budget Explorer JSON schema."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class FundBreakdown(BaseModel):
    """How a department's budget breaks down by fund type."""

    fund_id: str = Field(..., description="Slugified fund identifier (e.g., 'fund-local')")
    fund_name: str = Field(..., description="Human-readable fund name (e.g., 'Corporate Fund')")
    amount: int = Field(
        ..., description="Dollar amount in this fund (can be negative for adjustments)"
    )


class Subcategory(BaseModel):
    """Budget subcategory within a department (e.g., Personnel Services, Contractual Services)."""

    id: str = Field(..., description="Unique subcategory identifier (slugified)")
    name: str = Field(..., description="Subcategory name")
    amount: int = Field(..., description="Dollar amount (can be negative for reductions)")


class SimulationConfig(BaseModel):
    """Configuration for budget simulation constraints."""

    adjustable: bool = Field(..., description="Whether this department can be adjusted")
    min_pct: float = Field(0.5, ge=0, le=2.0, description="Minimum adjustment multiplier")
    max_pct: float = Field(1.5, ge=0, le=2.0, description="Maximum adjustment multiplier")
    step_pct: float = Field(0.01, gt=0, description="Slider step size")
    constraints: list[str] = Field(
        default_factory=list, description="List of constraint reasons (e.g., 'Legally mandated')"
    )
    description: str = Field(..., description="Plain-language description for users")

    @field_validator("min_pct", "max_pct")
    @classmethod
    def validate_range(cls, v: float) -> float:
        """Ensure percentage multipliers are reasonable (0-2x)."""
        if v < 0 or v > 2.0:
            raise ValueError("Percentage multiplier must be between 0 and 2.0")
        return v


class Department(BaseModel):
    """A single department with its budget allocation."""

    id: str = Field(..., description="Unique department identifier (e.g., 'dept-police')")
    name: str = Field(..., description="Department name (e.g., 'Police')")
    code: str = Field(..., description="Department code from source data (e.g., '057')")
    amount: int = Field(..., description="Total budget amount in dollars (can be negative)")
    prior_year_amount: int | None = Field(
        None, description="Prior year amount for year-over-year comparison"
    )
    change_pct: float | None = Field(None, description="Year-over-year change percentage")
    fund_breakdown: list[FundBreakdown] = Field(
        default_factory=list, description="Breakdown by fund type (Local, Grant, etc.)"
    )
    subcategories: list[Subcategory] = Field(
        default_factory=list, description="Breakdown by appropriation account type"
    )
    simulation: SimulationConfig = Field(..., description="Simulation constraints for this dept")


class FundSummary(BaseModel):
    """Summary of a fund type across all departments."""

    id: str = Field(..., description="Fund identifier (e.g., 'fund-corporate')")
    name: str = Field(..., description="Fund name (e.g., 'Corporate Fund')")
    amount: int = Field(..., description="Total amount across all departments")
    fund_type: Literal["operating", "restricted", "capital", "grant"] = Field(
        ..., description="Fund type category"
    )


class Appropriations(BaseModel):
    """Complete appropriations structure."""

    by_department: list[Department] = Field(
        ..., description="Departments sorted by amount (largest first)"
    )
    by_fund: list[FundSummary] = Field(..., description="Fund summary across all departments")


class Metadata(BaseModel):
    """Metadata about the budget data."""

    entity_id: str = Field(..., description="Entity identifier (e.g., 'city-of-chicago')")
    entity_name: str = Field(..., description="Human-readable entity name")
    fiscal_year: str = Field(..., pattern=r"^fy\d{4}$", description="Fiscal year (e.g., 'fy2025')")
    fiscal_year_label: str = Field(..., description="Display label (e.g., 'FY2025')")
    fiscal_year_start: date = Field(..., description="Fiscal year start date")
    fiscal_year_end: date = Field(..., description="Fiscal year end date")

    # Comprehensive budget totals (all in dollars)
    gross_appropriations: int = Field(..., ge=0, description="Sum of all positive appropriations")
    accounting_adjustments: int = Field(
        0, description="Sum of negative amounts (budget reductions, typically <= 0)"
    )
    total_appropriations: int = Field(
        ..., description="Net total after adjustments (gross + adjustments)"
    )

    # Operating budget (excludes enterprise/grants/pensions)
    operating_appropriations: int | None = Field(
        None,
        description="Operating funds only (typically Corporate Fund + local operating funds)",
    )

    # Flexible breakdown by fund category (entity-specific categories defined in config)
    fund_category_breakdown: dict[str, int] = Field(
        default_factory=dict,
        description=(
            "Breakdown by fund category. Categories are entity-specific "
            "(e.g., Chicago: operating/enterprise/pension; CPS: operating/title_i/special_education)"
        ),
    )

    data_source: str = Field(..., description="Source of data (e.g., 'socrata_api', 'pdf')")
    source_dataset_id: str = Field(..., description="Source dataset identifier")
    extraction_date: date = Field(..., description="When data was extracted")
    pipeline_version: str = Field(..., description="Pipeline version (for schema migrations)")
    notes: str | None = Field(None, description="Additional context or caveats")
    total_revenue: int | None = Field(None, description="Total revenue (if revenue data available)")
    revenue_surplus_deficit: int | None = Field(
        None,
        description="Revenue minus appropriations (positive = surplus, negative = deficit)",
    )


class RevenueSource(BaseModel):
    """A single revenue source category (e.g., Property Tax, Sales Tax).

    Revenue sources are aggregated from raw line items into user-friendly categories.
    Each source contains subcategories for detailed breakdown and fund breakdown
    showing which funds receive this revenue.
    """

    id: str = Field(..., description="Unique source identifier (e.g., 'revenue-property-tax')")
    name: str = Field(..., description="Revenue source name (e.g., 'Property Tax')")
    amount: int = Field(..., ge=0, description="Total revenue from this source")
    subcategories: list[Subcategory] = Field(
        default_factory=list, description="Detailed breakdown within this source"
    )
    fund_breakdown: list[FundBreakdown] = Field(
        default_factory=list, description="Which funds receive this revenue"
    )


class Revenue(BaseModel):
    """Complete revenue structure.

    Contains revenue sources sorted by amount, fund summaries, and transparency
    metadata about data completeness (e.g., whether grant revenue is included).
    """

    by_source: list[RevenueSource] = Field(
        ..., description="Revenue sources sorted by amount (largest first)"
    )
    by_fund: list[FundSummary] = Field(..., description="Fund summary across all revenue sources")
    total_revenue: int = Field(..., ge=0, description="Total revenue")
    local_revenue_only: bool = Field(
        True, description="Whether this includes only local funds (excludes grants)"
    )
    grant_revenue_estimated: int | None = Field(
        None,
        description="Estimated grant revenue (not in dataset, calculated from appropriations)",
    )


class BudgetData(BaseModel):
    """Complete budget data for one entity for one fiscal year.

    This is the top-level schema for the JSON files consumed by the frontend.
    """

    metadata: Metadata = Field(..., description="Metadata about this dataset")
    appropriations: Appropriations = Field(..., description="Appropriations data structure")
    revenue: Revenue | None = Field(
        None, description="Revenue data (optional, available from v1.5+)"
    )
    schema_version: str = Field(
        default="1.0.0", pattern=r"^\d+\.\d+\.\d+$", description="Schema version"
    )

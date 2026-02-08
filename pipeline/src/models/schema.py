"""Pydantic models for Chicago Budget Explorer JSON schema."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class FundBreakdown(BaseModel):
    """How a department's budget breaks down by fund type."""

    fund_id: str = Field(..., description="Slugified fund identifier (e.g., 'fund-local')")
    fund_name: str = Field(..., description="Human-readable fund name (e.g., 'Corporate Fund')")
    amount: int = Field(..., ge=0, description="Dollar amount in this fund")


class Subcategory(BaseModel):
    """Budget subcategory within a department (e.g., Personnel Services, Contractual Services)."""

    id: str = Field(..., description="Unique subcategory identifier (slugified)")
    name: str = Field(..., description="Subcategory name")
    amount: int = Field(..., ge=0, description="Dollar amount")


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
    amount: int = Field(..., ge=0, description="Total budget amount in dollars")
    prior_year_amount: int | None = Field(
        None, ge=0, description="Prior year amount for year-over-year comparison"
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
    amount: int = Field(..., ge=0, description="Total amount across all departments")
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
    total_appropriations: int = Field(..., ge=0, description="Total gross budget amount")
    net_appropriations: int | None = Field(
        None, ge=0, description="Net after interfund transfers (if applicable)"
    )
    data_source: str = Field(..., description="Source of data (e.g., 'socrata_api', 'pdf')")
    source_dataset_id: str = Field(..., description="Source dataset identifier")
    extraction_date: date = Field(..., description="When data was extracted")
    pipeline_version: str = Field(..., description="Pipeline version (for schema migrations)")
    notes: str | None = Field(None, description="Additional context or caveats")


class BudgetData(BaseModel):
    """Complete budget data for one entity for one fiscal year.

    This is the top-level schema for the JSON files consumed by the frontend.
    """

    metadata: Metadata = Field(..., description="Metadata about this dataset")
    appropriations: Appropriations = Field(..., description="Appropriations data structure")
    schema_version: str = Field(
        default="1.0.0", pattern=r"^\d+\.\d+\.\d+$", description="Schema version"
    )

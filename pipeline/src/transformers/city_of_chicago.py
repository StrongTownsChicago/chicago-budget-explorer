"""Transformer for City of Chicago budget data from Socrata."""

import re
from datetime import date
from typing import Any

import pandas as pd

from ..models.schema import (
    Appropriations,
    BudgetData,
    Department,
    FundBreakdown,
    FundSummary,
    Metadata,
    Revenue,
    RevenueSource,
    SimulationConfig,
    Subcategory,
)
from .base import BaseTransformer


def slugify(text: str) -> str:
    """Convert text to slug format (lowercase, hyphens).

    Args:
        text: Input text

    Returns:
        Slugified text (e.g., "Police Department" -> "police-department")
    """
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


class CityOfChicagoTransformer(BaseTransformer):
    """Transformer for City of Chicago Socrata budget data."""

    def __init__(self, config: dict[str, Any]) -> None:
        """Initialize City of Chicago transformer.

        Args:
            config: Entity configuration with 'transform' section
        """
        super().__init__(config)

        if "transform" not in config:
            raise ValueError("Config must include 'transform' section")

        self.transform_config = config["transform"]
        self.acronyms = self.transform_config.get("acronyms", {})
        self.non_adjustable = set(self.transform_config.get("non_adjustable_departments", []))
        self.grant_threshold = self.transform_config.get("grant_funded_threshold", 0.9)

    def detect_amount_column(self, df: pd.DataFrame, fiscal_year: str) -> str:
        """Detect the amount column for a given fiscal year.

        Column names vary across years: "2025_ordinance", "ordinance_amount_2025", etc.

        Args:
            df: Raw DataFrame
            fiscal_year: Fiscal year (e.g., 'fy2025')

        Returns:
            Column name containing the amount

        Raises:
            ValueError: If amount column cannot be detected
        """
        year_num = fiscal_year.replace("fy", "")

        # Try patterns in order of specificity
        patterns = [
            f"{year_num}_ordinance",
            f"ordinance_amount_{year_num}",
            f"{year_num}_recommendation",
            "ordinance_amount",
            "estimated_revenue",
            "amount",
        ]

        for pattern in patterns:
            matches = [col for col in df.columns if pattern in col.lower()]
            if matches:
                return matches[0]

        raise ValueError(f"Could not detect amount column for {fiscal_year} in {list(df.columns)}")

    def title_case_with_acronyms(self, text: str) -> str:
        """Title-case text while preserving acronyms.

        Args:
            text: Input text (e.g., "OEMC", "BACP")

        Returns:
            Title-cased text with acronyms preserved (e.g., "OEMC", "BACP")
        """
        words = text.lower().split()
        result = []

        for word in words:
            if word in self.acronyms:
                result.append(self.acronyms[word])
            else:
                result.append(word.title())

        return " ".join(result)

    def calculate_fiscal_year_dates(self, fiscal_year: str) -> tuple[date, date]:
        """Calculate fiscal year start and end dates.

        For City of Chicago, fiscal year is calendar year (Jan 1 - Dec 31).

        Args:
            fiscal_year: Fiscal year (e.g., 'fy2025')

        Returns:
            Tuple of (start_date, end_date)
        """
        year = int(fiscal_year.replace("fy", ""))
        start = date(year, 1, 1)
        end = date(year, 12, 31)
        return start, end

    @staticmethod
    def _matches_fund_list(fund_name: str, fund_list: list[str]) -> bool:
        """Check if a fund name matches any entry in a fund list.

        Supports exact matches and wildcard patterns (e.g., "*Grant*").

        Args:
            fund_name: Fund name to check
            fund_list: List of fund names or wildcard patterns

        Returns:
            True if fund_name matches any entry
        """
        for pattern in fund_list:
            if "*" in pattern:
                pattern_text = pattern.strip("*").lower()
                if pattern_text in fund_name.lower():
                    return True
            elif fund_name == pattern:
                return True
        return False

    def categorize_fund(self, fund_name: str) -> str:
        """Categorize a fund into an entity-specific category.

        Uses configuration from entities.yaml to classify funds into categories.
        Supports exact matches and wildcard patterns (e.g., "*Grant*").

        Args:
            fund_name: Fund name from data (e.g., "Corporate Fund")

        Returns:
            Category string (e.g., "operating", "enterprise", "pension")
        """
        fund_categories = self.transform_config.get("fund_categories", {})

        for category, fund_list in fund_categories.items():
            if self._matches_fund_list(fund_name, fund_list):
                return str(category)

        # Default to operating if uncategorized
        return "operating"

    def determine_simulation_config(
        self, dept_name: str, fund_breakdown: list[FundBreakdown], total_amount: int
    ) -> SimulationConfig:
        """Determine simulation constraints for a department.

        Rules:
        - Finance General: non-adjustable (pensions, debt service)
        - Departments >90% grant-funded: tighter constraints (0.9-1.1)
        - All others: standard constraints (0.5-1.5)

        Args:
            dept_name: Department name (normalized)
            fund_breakdown: Fund breakdown for this department
            total_amount: Total department amount

        Returns:
            SimulationConfig with appropriate constraints
        """
        # Check if non-adjustable (Finance General)
        if dept_name.upper() in self.non_adjustable:
            return SimulationConfig(
                adjustable=False,
                min_pct=1.0,
                max_pct=1.0,
                step_pct=0.01,
                constraints=["Debt service and pension obligations are legally mandated"],
                description="This department cannot be adjusted due to legal obligations.",
            )

        # Check if grant-funded
        grant_amount = sum(fb.amount for fb in fund_breakdown if "grant" in fb.fund_name.lower())
        grant_pct = grant_amount / total_amount if total_amount > 0 else 0

        if grant_pct > self.grant_threshold:
            return SimulationConfig(
                adjustable=True,
                min_pct=0.9,
                max_pct=1.1,
                step_pct=0.01,
                constraints=[
                    f"Department is {grant_pct * 100:.0f}% grant-funded; "
                    "grants are restricted and cannot be reallocated"
                ],
                description="Limited adjustment due to restricted grant funding.",
            )

        # Standard constraints
        return SimulationConfig(
            adjustable=True,
            min_pct=0.5,
            max_pct=1.5,
            step_pct=0.01,
            constraints=[],
            description="This department can be adjusted within standard constraints.",
        )

    def categorize_revenue_source(self, source_name: str) -> str:
        """Categorize a revenue source into a high-level category.

        Uses configuration from entities.yaml to classify revenue sources.
        Matching is case-insensitive and uses substring matching.

        Args:
            source_name: Revenue source name from data

        Returns:
            Category key (e.g., "property_tax", "sales_tax", "other")
        """
        revenue_categories = self.transform_config.get("revenue_categories", {})

        for category, patterns in revenue_categories.items():
            for pattern in patterns:
                if pattern.lower() in source_name.lower():
                    return str(category)

        return "other"

    def transform_revenue(
        self,
        df: pd.DataFrame,
        fiscal_year: str,
    ) -> Revenue:
        """Transform revenue data to Revenue schema.

        Aggregates raw revenue line items into categories, computes fund breakdowns
        and subcategories for each category, and returns a complete Revenue model.

        Args:
            df: Raw revenue DataFrame from Socrata
            fiscal_year: Fiscal year (e.g., 'fy2025')

        Returns:
            Revenue model with categorized sources
        """
        # Handle empty DataFrame
        if df.empty:
            return Revenue(
                by_source=[],
                by_fund=[],
                total_revenue=0,
                local_revenue_only=True,
                grant_revenue_estimated=None,
            )

        # Detect amount column
        amount_col = self.detect_amount_column(df, fiscal_year)

        # Get column names from config
        rev_config = self.transform_config.get("revenue_columns", {})
        source_col = rev_config.get("source_column", "revenue_source").lower()
        fund_col = rev_config.get("fund_column", "fund_description").lower()

        # Convert amount to numeric
        df[amount_col] = pd.to_numeric(df[amount_col], errors="coerce")
        df = df[df[amount_col].notna()].copy()

        # Filter out zero amounts
        df = df[df[amount_col] != 0].copy()

        # Categorize each source
        df["source_category"] = df[source_col].apply(self.categorize_revenue_source)

        # Human-friendly category display names
        category_display_names = {
            "property_tax": "Property Tax",
            "sales_tax": "Sales Tax",
            "state_sharing": "State Shared Revenue",
            "utility_tax": "Utility Taxes",
            "transaction_tax": "Transaction Taxes",
            "transportation_tax": "Transportation Taxes",
            "fines_forfeitures": "Fines and Forfeitures",
            "licenses_permits": "Licenses and Permits",
            "charges_for_services": "Charges for Services",
            "debt_proceeds": "Debt Proceeds",
            "tif": "TIF Surplus",
            "other": "Other Revenue",
        }

        # Aggregate by category
        sources: list[RevenueSource] = []

        for category, cat_group in df.groupby("source_category", dropna=False):
            cat_total = int(cat_group[amount_col].sum())

            # Fund breakdown for this category
            fund_breakdown: list[FundBreakdown] = []
            if fund_col in cat_group.columns:
                for fund_name, fund_group in cat_group.groupby(fund_col, dropna=False):
                    fund_amount = int(fund_group[amount_col].sum())
                    fund_breakdown.append(
                        FundBreakdown(
                            fund_id=slugify(str(fund_name)),
                            fund_name=str(fund_name),
                            amount=fund_amount,
                        )
                    )

            # Subcategories (individual sources within category)
            subcategories: list[Subcategory] = []
            for source_name, source_group in cat_group.groupby(source_col, dropna=False):
                source_amount = int(source_group[amount_col].sum())
                subcategories.append(
                    Subcategory(
                        id=slugify(f"{category}-{source_name}"),
                        name=str(source_name),
                        amount=source_amount,
                    )
                )

            category_name = category_display_names.get(
                str(category), str(category).replace("_", " ").title()
            )

            sources.append(
                RevenueSource(
                    id=slugify(f"revenue-{category}"),
                    name=category_name,
                    amount=cat_total,
                    subcategories=sorted(subcategories, key=lambda x: x.amount, reverse=True),
                    fund_breakdown=sorted(fund_breakdown, key=lambda x: x.amount, reverse=True),
                )
            )

        # Sort sources by amount (descending)
        sources.sort(key=lambda x: x.amount, reverse=True)

        # Fund summary (aggregate across all sources)
        fund_totals: dict[str, int] = {}
        for source in sources:
            for fb in source.fund_breakdown:
                fund_totals[fb.fund_name] = fund_totals.get(fb.fund_name, 0) + fb.amount

        by_fund = [
            FundSummary(
                id=slugify(fund_name),
                name=fund_name,
                amount=amount,
                fund_type="operating",
            )
            for fund_name, amount in sorted(fund_totals.items(), key=lambda x: x[1], reverse=True)
        ]

        total_revenue = sum(s.amount for s in sources)

        return Revenue(
            by_source=sources,
            by_fund=by_fund,
            total_revenue=total_revenue,
            local_revenue_only=True,
            grant_revenue_estimated=None,
        )

    def transform(
        self,
        df: pd.DataFrame,
        fiscal_year: str,
        prior_df: pd.DataFrame | None = None,
        revenue_df: pd.DataFrame | None = None,
    ) -> BudgetData:
        """Transform City of Chicago Socrata data to BudgetData schema.

        Args:
            df: Raw Socrata DataFrame (appropriations)
            fiscal_year: Fiscal year (e.g., 'fy2025')
            prior_df: Optional prior year DataFrame for year-over-year comparison
            revenue_df: Optional revenue DataFrame for revenue processing

        Returns:
            Complete BudgetData model
        """
        # Detect amount column
        amount_col = self.detect_amount_column(df, fiscal_year)

        # Get column names from config
        dept_col = self.transform_config["department_column"].lower()
        dept_code_col = self.transform_config["department_code_column"].lower()
        fund_desc_col = self.transform_config["fund_description_column"].lower()
        acct_desc_col = self.transform_config["appropriation_account_description_column"].lower()

        # Convert amount to numeric, drop NaN (keep negatives as legitimate adjustments)
        df[amount_col] = pd.to_numeric(df[amount_col], errors="coerce")
        df = df[df[amount_col].notna()].copy()

        # Normalize department names
        df["dept_name_normalized"] = df[dept_col].apply(self.title_case_with_acronyms)

        # Aggregate by department
        departments: list[Department] = []

        for (dept_name, dept_code), dept_group in df.groupby(
            ["dept_name_normalized", dept_code_col], dropna=False
        ):
            dept_total = int(dept_group[amount_col].sum())

            # Fund breakdown
            fund_breakdown = []
            for fund_desc, fund_group in dept_group.groupby(fund_desc_col, dropna=False):
                fund_amount = int(fund_group[amount_col].sum())
                fund_breakdown.append(
                    FundBreakdown(
                        fund_id=slugify(fund_desc),
                        fund_name=str(fund_desc),
                        amount=fund_amount,
                    )
                )

            # Subcategories (by appropriation account)
            subcategories = []
            for acct_desc, acct_group in dept_group.groupby(acct_desc_col, dropna=False):
                acct_amount = int(acct_group[amount_col].sum())
                subcategories.append(
                    Subcategory(
                        id=slugify(f"{dept_name}-{acct_desc}"),
                        name=str(acct_desc),
                        amount=acct_amount,
                    )
                )

            # Simulation config
            simulation = self.determine_simulation_config(
                str(dept_name), fund_breakdown, dept_total
            )

            # Year-over-year comparison (if prior year provided)
            prior_year_amount: int | None = None
            change_pct: float | None = None

            if prior_df is not None:
                prior_amount_col = self.detect_amount_column(
                    prior_df, "fy" + str(int(fiscal_year.replace("fy", "")) - 1)
                )
                prior_df[prior_amount_col] = pd.to_numeric(
                    prior_df[prior_amount_col], errors="coerce"
                )
                prior_df["dept_name_normalized"] = prior_df[dept_col].apply(
                    self.title_case_with_acronyms
                )

                prior_match = prior_df[prior_df["dept_name_normalized"] == dept_name]
                if not prior_match.empty:
                    prior_year_amount = int(prior_match[prior_amount_col].sum())
                    if prior_year_amount > 0:
                        change_pct = ((dept_total - prior_year_amount) / prior_year_amount) * 100

            departments.append(
                Department(
                    id=slugify(f"dept-{dept_name}"),
                    name=str(dept_name),
                    code=str(dept_code),
                    amount=dept_total,
                    prior_year_amount=prior_year_amount,
                    change_pct=change_pct,
                    fund_breakdown=sorted(fund_breakdown, key=lambda x: x.amount, reverse=True),
                    subcategories=sorted(subcategories, key=lambda x: x.amount, reverse=True),
                    simulation=simulation,
                )
            )

        # Sort departments by amount (descending)
        departments.sort(key=lambda x: x.amount, reverse=True)

        # Fund summary (aggregate across all departments)
        fund_summary: dict[str, int] = {}
        for dept in departments:
            for fb in dept.fund_breakdown:
                if fb.fund_name not in fund_summary:
                    fund_summary[fb.fund_name] = 0
                fund_summary[fb.fund_name] += fb.amount

        by_fund = [
            FundSummary(
                id=slugify(fund_name),
                name=fund_name,
                amount=amount,
                fund_type="grant" if "grant" in fund_name.lower() else "operating",
            )
            for fund_name, amount in sorted(fund_summary.items(), key=lambda x: x[1], reverse=True)
        ]

        # Calculate comprehensive budget totals
        gross_appropriations = sum(d.amount for d in departments if d.amount > 0)
        accounting_adjustments = sum(d.amount for d in departments if d.amount < 0)
        total_appropriations = sum(d.amount for d in departments)

        # Calculate totals by fund category (dynamically based on config)
        category_breakdown: dict[str, int] = {}
        for dept in departments:
            for fb in dept.fund_breakdown:
                category = self.categorize_fund(fb.fund_name)
                category_breakdown[category] = category_breakdown.get(category, 0) + fb.amount

        # Operating appropriations = total minus explicitly non-operating funds.
        # For Chicago, the reported ~$16.6B operating budget excludes only airport funds.
        non_operating_funds = self.transform_config.get("non_operating_funds", [])
        if non_operating_funds:
            non_operating_total = 0
            for dept in departments:
                for fb in dept.fund_breakdown:
                    if self._matches_fund_list(fb.fund_name, non_operating_funds):
                        non_operating_total += fb.amount
            operating_total: int | None = total_appropriations - non_operating_total
        elif category_breakdown:
            # Fallback: use "operating" category if no non_operating_funds config
            operating_total = category_breakdown.get("operating")
        else:
            operating_total = None

        fy_start, fy_end = self.calculate_fiscal_year_dates(fiscal_year)

        # Calculate grant fund total for revenue transparency
        grant_total = sum(f.amount for f in by_fund if "grant" in f.name.lower())

        metadata = Metadata(
            entity_id=self.config.get("id", "city-of-chicago"),
            entity_name=self.config.get("name", "City of Chicago"),
            fiscal_year=fiscal_year,
            fiscal_year_label=fiscal_year.upper(),
            fiscal_year_start=fy_start,
            fiscal_year_end=fy_end,
            gross_appropriations=gross_appropriations,
            accounting_adjustments=accounting_adjustments,
            total_appropriations=total_appropriations,
            operating_appropriations=operating_total,
            fund_category_breakdown=category_breakdown,
            data_source="socrata_api",
            source_dataset_id=self.config.get("socrata", {})
            .get("datasets", {})
            .get(fiscal_year, {})
            .get("appropriations", "unknown"),
            extraction_date=date.today(),
            pipeline_version="1.0.0",
            notes=(
                "Total appropriations include accounting adjustments. "
                "Operating appropriations exclude non-operating funds (e.g., airports). "
                "Fund categories are entity-specific."
            ),
            total_revenue=None,
            revenue_surplus_deficit=None,
        )

        # Process revenue if provided
        revenue: Revenue | None = None
        if revenue_df is not None and not revenue_df.empty:
            revenue = self.transform_revenue(revenue_df, fiscal_year)
            revenue.grant_revenue_estimated = grant_total if grant_total > 0 else None
            metadata.total_revenue = revenue.total_revenue
            metadata.revenue_surplus_deficit = revenue.total_revenue - total_appropriations

        return BudgetData(
            metadata=metadata,
            appropriations=Appropriations(by_department=departments, by_fund=by_fund),
            revenue=revenue,
            schema_version="1.0.0",
        )

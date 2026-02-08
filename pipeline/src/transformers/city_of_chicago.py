"""Transformer for City of Chicago budget data from Socrata."""

import re
from datetime import date, timedelta
from typing import Any, Optional

import pandas as pd

from ..models.schema import (
    Appropriations,
    BudgetData,
    Department,
    FundBreakdown,
    FundSummary,
    Metadata,
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
        self.non_adjustable = set(
            self.transform_config.get("non_adjustable_departments", [])
        )
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
        lowercase_cols = df.columns.str.lower()

        # Try patterns in order of specificity
        patterns = [
            f"{year_num}_ordinance",
            f"ordinance_amount_{year_num}",
            f"{year_num}_recommendation",
            "ordinance_amount",
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
        grant_amount = sum(
            fb.amount for fb in fund_breakdown if "grant" in fb.fund_name.lower()
        )
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

    def transform(
        self,
        df: pd.DataFrame,
        fiscal_year: str,
        prior_df: Optional[pd.DataFrame] = None,
    ) -> BudgetData:
        """Transform City of Chicago Socrata data to BudgetData schema.

        Args:
            df: Raw Socrata DataFrame
            fiscal_year: Fiscal year (e.g., 'fy2025')
            prior_df: Optional prior year DataFrame for year-over-year comparison

        Returns:
            Complete BudgetData model
        """
        # Detect amount column
        amount_col = self.detect_amount_column(df, fiscal_year)

        # Get column names from config
        dept_col = self.transform_config["department_column"].lower()
        dept_code_col = self.transform_config["department_code_column"].lower()
        fund_type_col = self.transform_config["fund_type_column"].lower()
        fund_desc_col = self.transform_config["fund_description_column"].lower()
        acct_col = self.transform_config["appropriation_account_column"].lower()
        acct_desc_col = self.transform_config["appropriation_account_description_column"].lower()

        # Convert amount to numeric, drop zeros
        df[amount_col] = pd.to_numeric(df[amount_col], errors="coerce")
        df = df[df[amount_col] > 0].copy()

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
            prior_year_amount: Optional[int] = None
            change_pct: Optional[float] = None

            if prior_df is not None:
                prior_amount_col = self.detect_amount_column(prior_df, "fy" + str(int(fiscal_year.replace("fy", "")) - 1))
                prior_df[prior_amount_col] = pd.to_numeric(prior_df[prior_amount_col], errors="coerce")
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
            for fund_name, amount in sorted(
                fund_summary.items(), key=lambda x: x[1], reverse=True
            )
        ]

        # Metadata
        total_appropriations = sum(d.amount for d in departments)
        fy_start, fy_end = self.calculate_fiscal_year_dates(fiscal_year)

        metadata = Metadata(
            entity_id=self.config.get("id", "city-of-chicago"),
            entity_name=self.config.get("name", "City of Chicago"),
            fiscal_year=fiscal_year,
            fiscal_year_label=fiscal_year.upper(),
            fiscal_year_start=fy_start,
            fiscal_year_end=fy_end,
            total_appropriations=total_appropriations,
            net_appropriations=None,  # TODO: Calculate by subtracting interfund transfers
            data_source="socrata_api",
            source_dataset_id=self.config.get("socrata", {})
            .get("datasets", {})
            .get(fiscal_year, {})
            .get("appropriations", "unknown"),
            extraction_date=date.today(),
            pipeline_version="1.0.0",
            notes=None,
        )

        return BudgetData(
            metadata=metadata,
            appropriations=Appropriations(by_department=departments, by_fund=by_fund),
            schema_version="1.0.0",
        )

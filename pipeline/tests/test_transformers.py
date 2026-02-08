"""Tests for transformers."""

from datetime import date

import pandas as pd
import pytest

from src.models.schema import BudgetData
from src.transformers.city_of_chicago import CityOfChicagoTransformer, slugify


class TestSlugify:
    """Tests for slugify utility function."""

    def test_basic_slugify(self):
        """Test basic slugification."""
        assert slugify("Police Department") == "police-department"
        assert slugify("FIRE") == "fire"
        assert slugify("Office of the Mayor") == "office-of-the-mayor"

    def test_special_characters(self):
        """Test handling of special characters."""
        assert slugify("Department & Agency") == "department-agency"
        assert slugify("IT/Tech") == "it-tech"
        assert slugify("Dept. 123") == "dept-123"

    def test_multiple_spaces(self):
        """Test handling of multiple spaces."""
        assert slugify("Multiple   Spaces") == "multiple-spaces"

    def test_leading_trailing_hyphens(self):
        """Test removal of leading/trailing hyphens."""
        assert slugify("-Police-") == "police"
        assert slugify("--Test--") == "test"


class TestCityOfChicagoTransformer:
    """Tests for CityOfChicagoTransformer."""

    @pytest.fixture
    def config(self):
        """Create test configuration."""
        return {
            "id": "city-of-chicago",
            "name": "City of Chicago",
            "transform": {
                "department_column": "DEPARTMENT_NAME",
                "department_code_column": "DEPARTMENT_CODE",
                "fund_description_column": "FUND_DESCRIPTION",
                "appropriation_account_description_column": "APPROPRIATION_ACCOUNT_DESCRIPTION",
                "acronyms": {
                    "oemc": "OEMC",
                    "bacp": "BACP",
                    "copa": "COPA",
                },
                "non_adjustable_departments": ["FINANCE GENERAL"],
                "grant_funded_threshold": 0.9,
            },
            "socrata": {
                "domain": "data.cityofchicago.org",
                "datasets": {
                    "fy2025": {"appropriations": "test-2025"},
                },
            },
        }

    @pytest.fixture
    def sample_df(self):
        """Create sample DataFrame."""
        return pd.DataFrame(
            [
                {
                    "department_name": "POLICE",
                    "department_code": "057",
                    "fund_description": "Corporate Fund",
                    "appropriation_account_description": "Salaries and Wages",
                    "2025_ordinance": "1500000",
                },
                {
                    "department_name": "POLICE",
                    "department_code": "057",
                    "fund_description": "Corporate Fund",
                    "appropriation_account_description": "Contractual Services",
                    "2025_ordinance": "500000",
                },
                {
                    "department_name": "FIRE",
                    "department_code": "070",
                    "fund_description": "Corporate Fund",
                    "appropriation_account_description": "Salaries and Wages",
                    "2025_ordinance": "1000000",
                },
            ]
        )

    def test_init_requires_transform_config(self):
        """Test that initialization fails without transform config."""
        with pytest.raises(ValueError, match="must include 'transform' section"):
            CityOfChicagoTransformer({"id": "test"})

    def test_init_success(self, config):
        """Test successful initialization."""
        transformer = CityOfChicagoTransformer(config)
        assert transformer.transform_config is not None
        assert "FINANCE GENERAL" in transformer.non_adjustable
        assert transformer.grant_threshold == 0.9

    def test_detect_amount_column(self, config, sample_df):
        """Test detection of amount column."""
        transformer = CityOfChicagoTransformer(config)
        col = transformer.detect_amount_column(sample_df, "fy2025")
        assert col == "2025_ordinance"

    def test_detect_amount_column_various_patterns(self, config):
        """Test detection with various column name patterns."""
        transformer = CityOfChicagoTransformer(config)

        # Test different patterns
        df1 = pd.DataFrame(columns=["ordinance_amount_2025"])
        assert transformer.detect_amount_column(df1, "fy2025") == "ordinance_amount_2025"

        df2 = pd.DataFrame(columns=["2025_recommendation"])
        assert transformer.detect_amount_column(df2, "fy2025") == "2025_recommendation"

        df3 = pd.DataFrame(columns=["amount"])
        assert transformer.detect_amount_column(df3, "fy2025") == "amount"

    def test_detect_amount_column_not_found(self, config):
        """Test error when amount column cannot be detected."""
        transformer = CityOfChicagoTransformer(config)
        df = pd.DataFrame(columns=["some_other_column"])

        with pytest.raises(ValueError, match="Could not detect amount column"):
            transformer.detect_amount_column(df, "fy2025")

    def test_title_case_with_acronyms(self, config):
        """Test title casing with acronym preservation."""
        transformer = CityOfChicagoTransformer(config)

        assert transformer.title_case_with_acronyms("OEMC") == "OEMC"
        assert transformer.title_case_with_acronyms("BACP") == "BACP"
        assert transformer.title_case_with_acronyms("POLICE DEPARTMENT") == "Police Department"
        assert (
            transformer.title_case_with_acronyms("OFFICE OF EMERGENCY MANAGEMENT")
            == "Office Of Emergency Management"
        )

    def test_calculate_fiscal_year_dates(self, config):
        """Test fiscal year date calculation."""
        transformer = CityOfChicagoTransformer(config)
        start, end = transformer.calculate_fiscal_year_dates("fy2025")

        assert start == date(2025, 1, 1)
        assert end == date(2025, 12, 31)

    def test_determine_simulation_config_standard(self, config):
        """Test simulation config for standard department."""
        transformer = CityOfChicagoTransformer(config)
        from src.models.schema import FundBreakdown

        fund_breakdown = [
            FundBreakdown(fund_id="corporate", fund_name="Corporate Fund", amount=1000000)
        ]
        sim_config = transformer.determine_simulation_config("Police", fund_breakdown, 1000000)

        assert sim_config.adjustable is True
        assert sim_config.min_pct == 0.5
        assert sim_config.max_pct == 1.5
        assert len(sim_config.constraints) == 0

    def test_determine_simulation_config_non_adjustable(self, config):
        """Test simulation config for non-adjustable department."""
        transformer = CityOfChicagoTransformer(config)
        from src.models.schema import FundBreakdown

        fund_breakdown = [
            FundBreakdown(fund_id="corporate", fund_name="Corporate Fund", amount=1000000)
        ]
        sim_config = transformer.determine_simulation_config(
            "Finance General", fund_breakdown, 1000000
        )

        assert sim_config.adjustable is False
        assert sim_config.min_pct == 1.0
        assert sim_config.max_pct == 1.0
        assert len(sim_config.constraints) > 0

    def test_determine_simulation_config_grant_funded(self, config):
        """Test simulation config for grant-funded department."""
        transformer = CityOfChicagoTransformer(config)
        from src.models.schema import FundBreakdown

        fund_breakdown = [
            FundBreakdown(fund_id="grant", fund_name="Federal Grant", amount=950000),
            FundBreakdown(fund_id="corporate", fund_name="Corporate Fund", amount=50000),
        ]
        sim_config = transformer.determine_simulation_config("Grant Dept", fund_breakdown, 1000000)

        assert sim_config.adjustable is True
        assert sim_config.min_pct == 0.9
        assert sim_config.max_pct == 1.1
        assert any("grant" in c.lower() for c in sim_config.constraints)

    def test_transform_basic(self, config, sample_df):
        """Test basic transformation."""
        transformer = CityOfChicagoTransformer(config)
        result = transformer.transform(sample_df, "fy2025")

        assert isinstance(result, BudgetData)
        assert result.metadata.entity_id == "city-of-chicago"
        assert result.metadata.fiscal_year == "fy2025"
        assert len(result.appropriations.by_department) == 2  # Police and Fire

        # Check departments are sorted by amount (descending)
        police = result.appropriations.by_department[0]
        fire = result.appropriations.by_department[1]
        assert police.name == "Police"
        assert police.amount == 2000000  # 1500000 + 500000
        assert fire.name == "Fire"
        assert fire.amount == 1000000

    def test_transform_department_structure(self, config, sample_df):
        """Test department structure after transformation."""
        transformer = CityOfChicagoTransformer(config)
        result = transformer.transform(sample_df, "fy2025")

        police = result.appropriations.by_department[0]

        # Check basic fields
        assert police.id == "dept-police"
        assert police.code == "057"

        # Check fund breakdown
        assert len(police.fund_breakdown) == 1
        assert police.fund_breakdown[0].fund_name == "Corporate Fund"
        assert police.fund_breakdown[0].amount == 2000000

        # Check subcategories
        assert len(police.subcategories) == 2
        subcategory_names = {s.name for s in police.subcategories}
        assert "Salaries and Wages" in subcategory_names
        assert "Contractual Services" in subcategory_names

        # Check simulation config
        assert police.simulation.adjustable is True

    def test_transform_fund_summary(self, config, sample_df):
        """Test fund summary aggregation."""
        transformer = CityOfChicagoTransformer(config)
        result = transformer.transform(sample_df, "fy2025")

        assert len(result.appropriations.by_fund) == 1
        fund = result.appropriations.by_fund[0]
        assert fund.name == "Corporate Fund"
        assert fund.amount == 3000000  # Sum of all departments
        assert fund.fund_type == "operating"

    def test_transform_with_prior_year(self, config, sample_df):
        """Test transformation with prior year comparison."""
        # Create prior year DataFrame with lower amounts
        prior_df = sample_df.copy()
        prior_df["2024_ordinance"] = prior_df["2025_ordinance"].astype(float) * 0.9
        prior_df = prior_df.drop(columns=["2025_ordinance"])

        transformer = CityOfChicagoTransformer(config)
        result = transformer.transform(sample_df, "fy2025", prior_df=prior_df)

        police = result.appropriations.by_department[0]
        assert police.prior_year_amount is not None
        assert police.change_pct is not None
        # Should be positive change (increase)
        assert police.change_pct > 0

    def test_transform_metadata_completeness(self, config, sample_df):
        """Test that metadata is complete with comprehensive totals."""
        transformer = CityOfChicagoTransformer(config)
        result = transformer.transform(sample_df, "fy2025")

        metadata = result.metadata
        assert metadata.entity_id == "city-of-chicago"
        assert metadata.entity_name == "City of Chicago"
        assert metadata.fiscal_year == "fy2025"
        assert metadata.fiscal_year_label == "FY2025"
        assert metadata.fiscal_year_start == date(2025, 1, 1)
        assert metadata.fiscal_year_end == date(2025, 12, 31)

        # Comprehensive totals
        assert metadata.gross_appropriations == 3000000
        assert metadata.accounting_adjustments == 0
        assert metadata.total_appropriations == 3000000
        assert metadata.operating_appropriations is not None

        # Fund category breakdown
        assert isinstance(metadata.fund_category_breakdown, dict)
        assert len(metadata.fund_category_breakdown) > 0
        assert sum(metadata.fund_category_breakdown.values()) == metadata.total_appropriations

        assert metadata.data_source == "socrata_api"
        assert metadata.extraction_date == date.today()
        assert metadata.pipeline_version == "1.0.0"

    def test_transform_handles_zero_amounts(self, config):
        """Test that zero amounts are kept (not filtered out)."""
        df = pd.DataFrame(
            [
                {
                    "department_name": "POLICE",
                    "department_code": "057",
                    "fund_description": "Corporate Fund",
                    "appropriation_account_description": "Salaries",
                    "2025_ordinance": "1000000",
                },
                {
                    "department_name": "POLICE",
                    "department_code": "057",
                    "fund_description": "Corporate Fund",
                    "appropriation_account_description": "Empty",
                    "2025_ordinance": "0",
                },
            ]
        )

        transformer = CityOfChicagoTransformer(config)
        result = transformer.transform(df, "fy2025")

        police = result.appropriations.by_department[0]
        # Both subcategories kept (zero amounts no longer filtered)
        assert len(police.subcategories) == 2
        assert police.amount == 1000000

    def test_transform_preserves_negative_amounts(self, config):
        """Test that negative amounts (accounting adjustments) are preserved."""
        df = pd.DataFrame(
            [
                {
                    "department_name": "POLICE",
                    "department_code": "057",
                    "fund_description": "Corporate Fund",
                    "appropriation_account_description": "Salaries",
                    "2025_ordinance": "1000000",
                },
                {
                    "department_name": "ADJUSTMENTS",
                    "department_code": "999",
                    "fund_description": "Corporate Fund",
                    "appropriation_account_description": "Budget Reductions",
                    "2025_ordinance": "-50000",
                },
            ]
        )

        transformer = CityOfChicagoTransformer(config)
        result = transformer.transform(df, "fy2025")

        # Find adjustments department
        adjustments_dept = [d for d in result.appropriations.by_department if d.code == "999"]
        assert len(adjustments_dept) == 1
        assert adjustments_dept[0].amount == -50000

        # Check metadata calculations
        assert result.metadata.gross_appropriations == 1000000
        assert result.metadata.accounting_adjustments == -50000
        assert result.metadata.total_appropriations == 950000

    def test_categorize_fund(self, config):
        """Test fund categorization logic."""
        config["transform"]["fund_categories"] = {
            "operating": ["Corporate Fund", "Vehicle Tax Fund"],
            "enterprise": ["Water Fund", "Chicago O'Hare Airport Fund"],
            "pension": ["Policemen's Annuity and Benefit Fund"],
            "grant": ["*Grant*"],
            "debt": ["Bond Redemption*"],
        }

        transformer = CityOfChicagoTransformer(config)

        # Test exact matches
        assert transformer.categorize_fund("Corporate Fund") == "operating"
        assert transformer.categorize_fund("Water Fund") == "enterprise"
        assert transformer.categorize_fund("Policemen's Annuity and Benefit Fund") == "pension"

        # Test wildcard patterns
        assert transformer.categorize_fund("Federal Grant Fund") == "grant"
        assert transformer.categorize_fund("State Grant Program") == "grant"
        assert transformer.categorize_fund("Bond Redemption Series A") == "debt"

        # Test default (uncategorized -> operating)
        assert transformer.categorize_fund("Unknown Fund") == "operating"

    def test_categorize_fund_no_config(self, config):
        """Test fund categorization with no fund_categories config."""
        transformer = CityOfChicagoTransformer(config)
        # Should default to operating when no fund_categories defined
        assert transformer.categorize_fund("Any Fund") == "operating"

    def test_comprehensive_budget_totals(self, config):
        """Test calculation of comprehensive budget totals with multiple fund types."""
        config["transform"]["fund_categories"] = {
            "enterprise": ["Airport Fund"],
            "grant": ["*Grant*"],
        }
        config["transform"]["non_operating_funds"] = ["Airport Fund"]

        df = pd.DataFrame(
            [
                {
                    "department_name": "POLICE",
                    "department_code": "057",
                    "fund_description": "Corporate Fund",
                    "appropriation_account_description": "Salaries",
                    "2025_ordinance": "1000000",
                },
                {
                    "department_name": "AIRPORT",
                    "department_code": "100",
                    "fund_description": "Airport Fund",
                    "appropriation_account_description": "Operations",
                    "2025_ordinance": "500000",
                },
                {
                    "department_name": "GRANTS",
                    "department_code": "200",
                    "fund_description": "Federal Grant Fund",
                    "appropriation_account_description": "Programs",
                    "2025_ordinance": "300000",
                },
            ]
        )

        transformer = CityOfChicagoTransformer(config)
        result = transformer.transform(df, "fy2025")

        # Comprehensive totals
        assert result.metadata.gross_appropriations == 1800000
        assert result.metadata.total_appropriations == 1800000
        # Operating = total minus airport (non-operating) funds
        assert result.metadata.operating_appropriations == 1300000

        # Fund category breakdown
        assert result.metadata.fund_category_breakdown["operating"] == 1000000
        assert result.metadata.fund_category_breakdown["enterprise"] == 500000
        assert result.metadata.fund_category_breakdown["grant"] == 300000
        assert len(result.metadata.fund_category_breakdown) == 3


class TestRevenueTransformation:
    """Tests for revenue-related transformation methods."""

    @pytest.fixture
    def config_with_revenue(self):
        """Create test configuration with revenue categories."""
        return {
            "id": "city-of-chicago",
            "name": "City of Chicago",
            "transform": {
                "department_column": "DEPARTMENT_NAME",
                "department_code_column": "DEPARTMENT_CODE",
                "fund_description_column": "FUND_DESCRIPTION",
                "appropriation_account_description_column": "APPROPRIATION_ACCOUNT_DESCRIPTION",
                "acronyms": {},
                "non_adjustable_departments": [],
                "grant_funded_threshold": 0.9,
                "revenue_categories": {
                    "property_tax": ["Property Tax", "Tax Levy"],
                    "sales_tax": ["Sales Tax"],
                    "utility_tax": ["Electricity Tax", "Gas Tax", "Telecommunications Tax"],
                },
                "revenue_columns": {
                    "source_column": "revenue_source",
                    "fund_column": "fund_description",
                },
            },
            "socrata": {
                "domain": "data.cityofchicago.org",
                "datasets": {
                    "fy2025": {
                        "appropriations": "test-2025",
                        "revenue": "test-rev-2025",
                    },
                },
            },
        }

    def test_categorize_revenue_source_property_tax(self, config_with_revenue):
        """Categorize property tax sources correctly."""
        transformer = CityOfChicagoTransformer(config_with_revenue)
        assert transformer.categorize_revenue_source("Property Tax Levy") == "property_tax"

    def test_categorize_revenue_source_case_insensitive(self, config_with_revenue):
        """Categorization is case-insensitive."""
        transformer = CityOfChicagoTransformer(config_with_revenue)
        assert transformer.categorize_revenue_source("PROPERTY TAX LEVY") == "property_tax"
        assert transformer.categorize_revenue_source("property tax levy") == "property_tax"

    def test_categorize_revenue_source_unknown_defaults_to_other(self, config_with_revenue):
        """Unknown revenue sources default to 'other' category."""
        transformer = CityOfChicagoTransformer(config_with_revenue)
        assert transformer.categorize_revenue_source("Mystery Revenue Source") == "other"

    def test_transform_revenue_basic(self, config_with_revenue):
        """Transform revenue DataFrame to Revenue model."""
        transformer = CityOfChicagoTransformer(config_with_revenue)

        revenue_df = pd.DataFrame(
            [
                {
                    "revenue_source": "Property Tax Levy",
                    "fund_description": "Corporate Fund",
                    "2025_ordinance": "1500000000",
                },
                {
                    "revenue_source": "Sales Tax Revenue",
                    "fund_description": "Corporate Fund",
                    "2025_ordinance": "800000000",
                },
            ]
        )

        revenue = transformer.transform_revenue(revenue_df, "fy2025")

        assert len(revenue.by_source) == 2
        assert revenue.total_revenue == 2300000000
        # Sorted by amount: Property Tax first
        assert revenue.by_source[0].name == "Property Tax"
        assert revenue.by_source[0].amount == 1500000000
        assert revenue.by_source[1].name == "Sales Tax"
        assert revenue.by_source[1].amount == 800000000
        assert revenue.local_revenue_only is True

    def test_transform_revenue_aggregates_subcategories(self, config_with_revenue):
        """Revenue transformation aggregates multiple sources into categories."""
        transformer = CityOfChicagoTransformer(config_with_revenue)

        revenue_df = pd.DataFrame(
            [
                {
                    "revenue_source": "Electricity Tax",
                    "fund_description": "Corporate Fund",
                    "2025_ordinance": "100000000",
                },
                {
                    "revenue_source": "Gas Tax",
                    "fund_description": "Corporate Fund",
                    "2025_ordinance": "50000000",
                },
                {
                    "revenue_source": "Telecommunications Tax",
                    "fund_description": "Corporate Fund",
                    "2025_ordinance": "75000000",
                },
            ]
        )

        revenue = transformer.transform_revenue(revenue_df, "fy2025")

        assert len(revenue.by_source) == 1
        utility_category = revenue.by_source[0]
        assert utility_category.name == "Utility Taxes"
        assert utility_category.amount == 225000000
        assert len(utility_category.subcategories) == 3

    def test_transform_revenue_empty_dataframe(self, config_with_revenue):
        """Handle empty revenue DataFrame gracefully."""
        transformer = CityOfChicagoTransformer(config_with_revenue)
        empty_df = pd.DataFrame()

        revenue = transformer.transform_revenue(empty_df, "fy2025")
        assert revenue.by_source == []
        assert revenue.total_revenue == 0

    def test_transform_with_revenue_df(self, config_with_revenue):
        """Transform includes revenue when revenue_df is provided."""
        transformer = CityOfChicagoTransformer(config_with_revenue)

        approp_df = pd.DataFrame(
            [
                {
                    "department_name": "POLICE",
                    "department_code": "057",
                    "fund_description": "Corporate Fund",
                    "appropriation_account_description": "Salaries",
                    "2025_ordinance": "2000000",
                },
            ]
        )

        # Revenue DataFrame
        revenue_df = pd.DataFrame(
            [
                {
                    "revenue_source": "Property Tax Levy",
                    "fund_description": "Corporate Fund",
                    "2025_ordinance": "1500000",
                },
            ]
        )

        result = transformer.transform(approp_df, "fy2025", revenue_df=revenue_df)

        assert result.revenue is not None
        assert result.revenue.total_revenue == 1500000
        assert result.metadata.total_revenue == 1500000
        assert result.metadata.revenue_surplus_deficit == 1500000 - 2000000

    def test_transform_without_revenue_df(self, config_with_revenue):
        """Transform works without revenue_df (backward compatibility)."""
        transformer = CityOfChicagoTransformer(config_with_revenue)

        approp_df = pd.DataFrame(
            [
                {
                    "department_name": "POLICE",
                    "department_code": "057",
                    "fund_description": "Corporate Fund",
                    "appropriation_account_description": "Salaries",
                    "2025_ordinance": "2000000",
                },
            ]
        )

        result = transformer.transform(approp_df, "fy2025")

        assert result.revenue is None
        assert result.metadata.total_revenue is None

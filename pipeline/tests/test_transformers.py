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

        fund_breakdown = [FundBreakdown(fund_id="corporate", fund_name="Corporate Fund", amount=1000000)]
        sim_config = transformer.determine_simulation_config("Police", fund_breakdown, 1000000)

        assert sim_config.adjustable is True
        assert sim_config.min_pct == 0.5
        assert sim_config.max_pct == 1.5
        assert len(sim_config.constraints) == 0

    def test_determine_simulation_config_non_adjustable(self, config):
        """Test simulation config for non-adjustable department."""
        transformer = CityOfChicagoTransformer(config)
        from src.models.schema import FundBreakdown

        fund_breakdown = [FundBreakdown(fund_id="corporate", fund_name="Corporate Fund", amount=1000000)]
        sim_config = transformer.determine_simulation_config("Finance General", fund_breakdown, 1000000)

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
        """Test that metadata is complete."""
        transformer = CityOfChicagoTransformer(config)
        result = transformer.transform(sample_df, "fy2025")

        metadata = result.metadata
        assert metadata.entity_id == "city-of-chicago"
        assert metadata.entity_name == "City of Chicago"
        assert metadata.fiscal_year == "fy2025"
        assert metadata.fiscal_year_label == "FY2025"
        assert metadata.fiscal_year_start == date(2025, 1, 1)
        assert metadata.fiscal_year_end == date(2025, 12, 31)
        assert metadata.total_appropriations == 3000000
        assert metadata.data_source == "socrata_api"
        assert metadata.extraction_date == date.today()
        assert metadata.pipeline_version == "1.0.0"

    def test_transform_handles_zero_amounts(self, config):
        """Test that zero amounts are filtered out."""
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
        # Should only have 1 subcategory (zero filtered out)
        assert len(police.subcategories) == 1
        assert police.subcategories[0].name == "Salaries"

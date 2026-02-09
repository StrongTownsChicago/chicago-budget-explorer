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


class TestRevenueCategorization:
    """Tests for multi-level revenue categorization."""

    @pytest.fixture
    def config_with_categorization(self):
        """Config with the new revenue_categorization structure."""
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
                "revenue_categorization": {
                    "category_field_mapping": {
                        "Transportation Taxes": "transportation_tax",
                        "Municipal Public Utility Tax": "utility_tax",
                        "Recreation Taxes": "recreation_tax",
                        "Transaction Taxes": "transaction_tax",
                        "Business Taxes": "business_tax",
                        "Chicago Sales Tax / Home Rule Retailers' Occupation Tax": "sales_tax",
                        "Charges for Services": "charges_for_services",
                        "Fines, Forfeitures and Penalties": "fines_forfeitures",
                        "Licenses, Permits, and Certificates": "licenses_permits",
                        "Internal Service Earnings": "internal_earnings",
                        "Interest Income": "interest_income",
                        "Leases, Rentals and Sales": "leases_sales",
                        "Municipal Parking": "parking_revenue",
                        "Other Revenue": "other_local",
                        "State Income Tax": "state_sharing",
                        "Personal Property Replacement Tax": "state_sharing",
                        "Municipal Auto Rental Tax": "state_sharing",
                        "Reimbursements for City Services": "intergovernmental",
                        "Proceeds and Transfers In": "proceeds_transfers",
                    },
                    "fund_based_categories": {
                        "airport_enterprise": [
                            "Chicago O'Hare Airport Fund",
                            "Chicago Midway Airport Fund",
                        ],
                        "water_sewer": ["Water Fund", "Sewer Fund"],
                        "pension_allocations": [
                            "Municipal Employees' Annuity*",
                            "Policemen's Annuity*",
                            "Firemen's Annuity*",
                            "Laborers'*Annuity*",
                        ],
                        "property_tax_funds": [
                            "Bond Redemption and Interest*",
                            "Library Note Redemption*",
                        ],
                        "vehicle_transportation": [
                            "Vehicle Tax Fund",
                            "Motor Fuel Tax Fund",
                        ],
                        "emergency_comm": ["Emergency Communication Fund"],
                        "special_revenue": [
                            "Special Events*",
                            "Garbage Collection Fund",
                            "Library Fund",
                        ],
                    },
                    "source_overrides": {
                        "property_tax": ["Property Tax*", "Tax Levy*"],
                        "utility_tax": ["*Utility Tax*"],
                        "tif": ["Tax Increment*", "TIF*"],
                    },
                    "display_categories": {
                        "property_tax": {"name": "Property Tax", "revenue_type": "tax"},
                        "sales_tax": {"name": "Sales Tax", "revenue_type": "tax"},
                        "state_sharing": {
                            "name": "State Shared Revenue",
                            "revenue_type": "tax",
                        },
                        "utility_tax": {"name": "Utility Taxes", "revenue_type": "tax"},
                        "transaction_tax": {
                            "name": "Transaction Taxes",
                            "revenue_type": "tax",
                        },
                        "transportation_tax": {
                            "name": "Transportation Taxes",
                            "revenue_type": "tax",
                        },
                        "recreation_tax": {
                            "name": "Recreation & Sin Taxes",
                            "revenue_type": "tax",
                        },
                        "business_tax": {"name": "Business Taxes", "revenue_type": "tax"},
                        "vehicle_transportation": {
                            "name": "Vehicle & Motor Fuel Taxes",
                            "revenue_type": "tax",
                        },
                        "fines_forfeitures": {
                            "name": "Fines and Forfeitures",
                            "revenue_type": "fee",
                        },
                        "licenses_permits": {
                            "name": "Licenses and Permits",
                            "revenue_type": "fee",
                        },
                        "charges_for_services": {
                            "name": "Charges for Services",
                            "revenue_type": "fee",
                        },
                        "parking_revenue": {
                            "name": "Parking Revenue",
                            "revenue_type": "fee",
                        },
                        "emergency_comm": {
                            "name": "Telephone Surcharges",
                            "revenue_type": "fee",
                        },
                        "airport_enterprise": {
                            "name": "Airport Revenue",
                            "revenue_type": "enterprise",
                        },
                        "water_sewer": {
                            "name": "Water & Sewer Revenue",
                            "revenue_type": "enterprise",
                        },
                        "pension_allocations": {
                            "name": "Pension Fund Allocations",
                            "revenue_type": "internal_transfer",
                        },
                        "interest_income": {
                            "name": "Interest Income",
                            "revenue_type": "other",
                        },
                        "internal_earnings": {
                            "name": "Internal Service Earnings",
                            "revenue_type": "internal_transfer",
                        },
                        "proceeds_transfers": {
                            "name": "Proceeds & Transfers",
                            "revenue_type": "debt_proceeds",
                        },
                        "leases_sales": {
                            "name": "Leases, Rentals & Sales",
                            "revenue_type": "other",
                        },
                        "intergovernmental": {
                            "name": "Intergovernmental Revenue",
                            "revenue_type": "other",
                        },
                        "special_revenue": {
                            "name": "Special Revenue Funds",
                            "revenue_type": "other",
                        },
                        "property_tax_funds": {
                            "name": "Debt Service Funds",
                            "revenue_type": "debt_proceeds",
                        },
                        "other_local": {
                            "name": "Other Local Revenue",
                            "revenue_type": "other",
                        },
                        "tif": {"name": "TIF Surplus", "revenue_type": "other"},
                        "uncategorized": {
                            "name": "Uncategorized Revenue",
                            "revenue_type": "other",
                        },
                    },
                },
                "revenue_columns": {
                    "source_column": "revenue_source",
                    "fund_column": "fund_name",
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

    @pytest.fixture
    def transformer(self, config_with_categorization):
        """Create transformer with categorization config."""
        return CityOfChicagoTransformer(config_with_categorization)

    def test_corporate_fund_uses_revenue_category_field(self, transformer):
        """When revenue_category is populated, use category_field_mapping."""
        cat, rev_type = transformer.categorize_revenue_row(
            "Transportation Taxes", "Corporate Fund", "Ground Transportation Tax"
        )
        assert cat == "transportation_tax"
        assert rev_type == "tax"

    def test_water_fund_uses_fund_name_mapping(self, transformer):
        """When revenue_category is empty, use fund_based_categories."""
        cat, rev_type = transformer.categorize_revenue_row("", "Water Fund", "Water Rates")
        assert cat == "water_sewer"
        assert rev_type == "enterprise"

    def test_airport_categorized_as_enterprise(self, transformer):
        """Airport funds should be enterprise revenue."""
        cat, rev_type = transformer.categorize_revenue_row(
            "", "Chicago O'Hare Airport Fund", "Total From Rates and Charges"
        )
        assert cat == "airport_enterprise"
        assert rev_type == "enterprise"

    def test_pension_fund_allocation_is_internal(self, transformer):
        """Pension fund allocations should be internal transfers."""
        cat, rev_type = transformer.categorize_revenue_row(
            "", "Policemen's Annuity and Benefit Fund", "Corporate Fund Pension Allocation"
        )
        assert cat == "pension_allocations"
        assert rev_type == "internal_transfer"

    def test_property_tax_in_pension_fund_is_property_tax(self, transformer):
        """Property Tax Levy in pension fund should categorize as property_tax."""
        cat, rev_type = transformer.categorize_revenue_row(
            "", "Policemen's Annuity and Benefit Fund", "Property Tax Levy (Net Abatement)"
        )
        assert cat == "property_tax"
        assert rev_type == "tax"

    def test_property_tax_in_bond_fund_is_property_tax(self, transformer):
        """Property Tax Levy in bond fund should categorize as property_tax."""
        cat, rev_type = transformer.categorize_revenue_row(
            "", "Bond Redemption and Interest Series Fund", "Property Tax Levy (Net Abatement)"
        )
        assert cat == "property_tax"
        assert rev_type == "tax"

    def test_tif_categorization(self, transformer):
        """TIF revenue should be categorized separately."""
        cat, rev_type = transformer.categorize_revenue_row(
            "", "TIF Admin Fund", "Tax Increment Financing Administrative Reimbursement"
        )
        assert cat == "tif"
        assert rev_type == "other"

    def test_unknown_fund_falls_to_uncategorized(self, transformer):
        """Revenue from unknown fund with empty category should be uncategorized."""
        cat, rev_type = transformer.categorize_revenue_row(
            "", "Some New Unknown Fund", "Unknown Revenue"
        )
        assert cat == "uncategorized"
        assert rev_type == "other"

    def test_empty_revenue_category_treated_as_missing(self, transformer):
        """Empty and whitespace revenue_category should fall through to fund mapping."""
        cat, rev_type = transformer.categorize_revenue_row("   ", "Water Fund", "Water Rates")
        assert cat == "water_sewer"
        assert rev_type == "enterprise"

    def test_recreation_taxes_categorized(self, transformer):
        """Recreation taxes should group together via category_field_mapping."""
        cat, rev_type = transformer.categorize_revenue_row(
            "Recreation Taxes", "Corporate Fund", "Amusement Tax"
        )
        assert cat == "recreation_tax"
        assert rev_type == "tax"

    def test_utility_tax_from_pension_fund(self, transformer):
        """Utility Tax in pension fund should categorize as utility_tax via source_override."""
        cat, rev_type = transformer.categorize_revenue_row(
            "", "Municipal Employees' Annuity and Benefit Fund", "Water and Sewer Utility Tax"
        )
        assert cat == "utility_tax"
        assert rev_type == "tax"

    def test_sales_tax_via_category_field(self, transformer):
        """Sales tax via revenue_category mapping."""
        cat, rev_type = transformer.categorize_revenue_row(
            "Chicago Sales Tax / Home Rule Retailers' Occupation Tax",
            "Corporate Fund",
            "Chicago Home Rule Occupation Tax",
        )
        assert cat == "sales_tax"
        assert rev_type == "tax"

    def test_proceeds_and_transfers(self, transformer):
        """Proceeds and Transfers In should map to debt_proceeds type."""
        cat, rev_type = transformer.categorize_revenue_row(
            "Proceeds and Transfers In",
            "Corporate Fund",
            "Sales Tax Securitization Corporation Residual",
        )
        assert cat == "proceeds_transfers"
        assert rev_type == "debt_proceeds"

    def test_vehicle_tax_fund(self, transformer):
        """Vehicle Tax Fund should map to vehicle_transportation."""
        cat, rev_type = transformer.categorize_revenue_row("", "Vehicle Tax Fund", "Vehicle Tax")
        assert cat == "vehicle_transportation"
        assert rev_type == "tax"

    def test_emergency_comm_fund(self, transformer):
        """Emergency Communication Fund should map to fee type."""
        cat, rev_type = transformer.categorize_revenue_row(
            "", "Emergency Communication Fund", "Telephone Surcharge"
        )
        assert cat == "emergency_comm"
        assert rev_type == "fee"

    def test_all_display_categories_have_name(self, config_with_categorization):
        """Every category in display_categories must have a name field."""
        display = config_with_categorization["transform"]["revenue_categorization"][
            "display_categories"
        ]
        for key, cat_config in display.items():
            assert "name" in cat_config, f"display_categories[{key}] missing 'name'"

    def test_all_display_categories_have_revenue_type(self, config_with_categorization):
        """Every category in display_categories must have a revenue_type field."""
        display = config_with_categorization["transform"]["revenue_categorization"][
            "display_categories"
        ]
        for key, cat_config in display.items():
            assert "revenue_type" in cat_config, f"display_categories[{key}] missing 'revenue_type'"


class TestRevenueSourceModel:
    """Tests for RevenueSource schema changes."""

    def test_revenue_type_defaults_to_other(self):
        """RevenueSource should default revenue_type to 'other'."""
        from src.models.schema import RevenueSource

        source = RevenueSource(id="test", name="Test", amount=100)
        assert source.revenue_type == "other"

    def test_revenue_type_accepts_valid_values(self):
        """RevenueSource should accept known revenue_type values."""
        from src.models.schema import RevenueSource

        for rt in ("tax", "fee", "enterprise", "internal_transfer", "debt_proceeds", "other"):
            source = RevenueSource(id="test", name="Test", amount=100, revenue_type=rt)
            assert source.revenue_type == rt

    def test_existing_json_without_revenue_type_still_valid(self):
        """Existing JSON without revenue_type field should parse correctly."""
        from src.models.schema import RevenueSource

        data = {"id": "test", "name": "Test", "amount": 100}
        source = RevenueSource(**data)
        assert source.revenue_type == "other"


class TestTransformRevenueWithNewCategorization:
    """Tests for the full revenue transformation with new categorization."""

    @pytest.fixture
    def config_with_categorization(self):
        """Config with the new revenue_categorization structure."""
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
                "revenue_categorization": {
                    "category_field_mapping": {
                        "Transportation Taxes": "transportation_tax",
                        "Transaction Taxes": "transaction_tax",
                        "Proceeds and Transfers In": "proceeds_transfers",
                    },
                    "fund_based_categories": {
                        "airport_enterprise": [
                            "Chicago O'Hare Airport Fund",
                            "Chicago Midway Airport Fund",
                        ],
                        "water_sewer": ["Water Fund"],
                        "pension_allocations": ["Policemen's Annuity*"],
                    },
                    "source_overrides": {
                        "property_tax": ["Property Tax*", "Tax Levy*"],
                    },
                    "display_categories": {
                        "property_tax": {"name": "Property Tax", "revenue_type": "tax"},
                        "transportation_tax": {
                            "name": "Transportation Taxes",
                            "revenue_type": "tax",
                        },
                        "transaction_tax": {
                            "name": "Transaction Taxes",
                            "revenue_type": "tax",
                        },
                        "airport_enterprise": {
                            "name": "Airport Revenue",
                            "revenue_type": "enterprise",
                        },
                        "water_sewer": {
                            "name": "Water & Sewer Revenue",
                            "revenue_type": "enterprise",
                        },
                        "pension_allocations": {
                            "name": "Pension Fund Allocations",
                            "revenue_type": "internal_transfer",
                        },
                        "proceeds_transfers": {
                            "name": "Proceeds & Transfers",
                            "revenue_type": "debt_proceeds",
                        },
                        "uncategorized": {
                            "name": "Uncategorized Revenue",
                            "revenue_type": "other",
                        },
                    },
                },
                "revenue_columns": {
                    "source_column": "revenue_source",
                    "fund_column": "fund_name",
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

    @pytest.fixture
    def sample_revenue_df(self):
        """DataFrame mimicking real FY2025 revenue data structure."""
        return pd.DataFrame(
            [
                # Corporate Fund with revenue_category populated
                {
                    "fund_name": "Corporate Fund",
                    "revenue_category": "Transportation Taxes",
                    "revenue_source": "Ground Transportation Tax",
                    "estimated_revenue": "218602527",
                },
                {
                    "fund_name": "Corporate Fund",
                    "revenue_category": "Transaction Taxes",
                    "revenue_source": "Lease of Personal Property",
                    "estimated_revenue": "818125487",
                },
                {
                    "fund_name": "Corporate Fund",
                    "revenue_category": "Proceeds and Transfers In",
                    "revenue_source": "Sales Tax Securitization Residual",
                    "estimated_revenue": "572000000",
                },
                # Water Fund with empty category
                {
                    "fund_name": "Water Fund",
                    "revenue_category": "",
                    "revenue_source": "Water Rates",
                    "estimated_revenue": "829394847",
                },
                # Airport with empty category
                {
                    "fund_name": "Chicago O'Hare Airport Fund",
                    "revenue_category": "",
                    "revenue_source": "Total From Rates and Charges",
                    "estimated_revenue": "1941546908",
                },
                # Pension fund with property tax AND allocation
                {
                    "fund_name": "Policemen's Annuity and Benefit Fund",
                    "revenue_category": "",
                    "revenue_source": "Property Tax Levy (Net Abatement)",
                    "estimated_revenue": "813518000",
                },
                {
                    "fund_name": "Policemen's Annuity and Benefit Fund",
                    "revenue_category": "",
                    "revenue_source": "Corporate Fund Pension Allocation",
                    "estimated_revenue": "227650852",
                },
            ]
        )

    @pytest.fixture
    def transformer(self, config_with_categorization):
        """Create transformer."""
        return CityOfChicagoTransformer(config_with_categorization)

    def test_revenue_type_populated_on_all_sources(self, transformer, sample_revenue_df):
        """Every RevenueSource should have a valid revenue_type."""
        revenue = transformer.transform_revenue(sample_revenue_df, "fy2025")
        valid_types = {"tax", "fee", "enterprise", "internal_transfer", "debt_proceeds", "other"}
        for source in revenue.by_source:
            assert source.revenue_type in valid_types, (
                f"{source.name} has invalid revenue_type: {source.revenue_type}"
            )

    def test_airport_revenue_exists(self, transformer, sample_revenue_df):
        """Airport revenue should appear as its own category."""
        revenue = transformer.transform_revenue(sample_revenue_df, "fy2025")
        airport = [s for s in revenue.by_source if "airport" in s.id.lower()]
        assert len(airport) == 1
        assert airport[0].revenue_type == "enterprise"
        assert airport[0].amount == 1941546908

    def test_pension_allocations_marked_as_internal(self, transformer, sample_revenue_df):
        """Pension allocations should be marked as internal_transfer type."""
        revenue = transformer.transform_revenue(sample_revenue_df, "fy2025")
        pension = [s for s in revenue.by_source if "pension" in s.id.lower()]
        assert len(pension) == 1
        assert pension[0].revenue_type == "internal_transfer"
        assert pension[0].amount == 227650852

    def test_property_tax_aggregates_across_funds(self, transformer, sample_revenue_df):
        """Property tax from pension funds should aggregate into property_tax category."""
        revenue = transformer.transform_revenue(sample_revenue_df, "fy2025")
        prop_tax = [s for s in revenue.by_source if "property" in s.id.lower()]
        assert len(prop_tax) == 1
        assert prop_tax[0].amount == 813518000
        assert prop_tax[0].revenue_type == "tax"

    def test_subcategories_sum_to_source(self, transformer, sample_revenue_df):
        """For each source, subcategory amounts should sum to source amount."""
        revenue = transformer.transform_revenue(sample_revenue_df, "fy2025")
        for source in revenue.by_source:
            if source.subcategories:
                subcat_sum = sum(sc.amount for sc in source.subcategories)
                assert abs(subcat_sum - source.amount) <= 1, (
                    f"{source.name}: subcategory sum {subcat_sum} != source amount {source.amount}"
                )

    def test_total_revenue_equals_row_sum(self, transformer, sample_revenue_df):
        """Total revenue should match the sum of all input rows."""
        revenue = transformer.transform_revenue(sample_revenue_df, "fy2025")
        row_total = int(
            pd.to_numeric(sample_revenue_df["estimated_revenue"], errors="coerce").sum()
        )
        assert abs(revenue.total_revenue - row_total) <= 1

    def test_transform_revenue_empty_dataframe(self, transformer):
        """Handle empty revenue DataFrame gracefully."""
        empty_df = pd.DataFrame()
        revenue = transformer.transform_revenue(empty_df, "fy2025")
        assert revenue.by_source == []
        assert revenue.total_revenue == 0

    def test_missing_revenue_category_column_handled(self, transformer):
        """DataFrame without revenue_category column should work via fund_name categorization."""
        df = pd.DataFrame(
            [
                {
                    "fund_name": "Water Fund",
                    "revenue_source": "Water Rates",
                    "estimated_revenue": "500000000",
                },
                {
                    "fund_name": "Chicago O'Hare Airport Fund",
                    "revenue_source": "Total From Rates and Charges",
                    "estimated_revenue": "2000000000",
                },
            ]
        )
        revenue = transformer.transform_revenue(df, "fy2025")
        assert revenue.total_revenue == 2500000000
        # Both should be categorized (not uncategorized)
        uncategorized = [s for s in revenue.by_source if "uncategorized" in s.id.lower()]
        assert len(uncategorized) == 0

    def test_transform_with_revenue_df_integration(self, config_with_categorization):
        """Transform includes revenue when revenue_df is provided."""
        transformer = CityOfChicagoTransformer(config_with_categorization)

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

        revenue_df = pd.DataFrame(
            [
                {
                    "fund_name": "Corporate Fund",
                    "revenue_category": "Transportation Taxes",
                    "revenue_source": "Ground Transportation Tax",
                    "estimated_revenue": "1500000",
                },
            ]
        )

        result = transformer.transform(approp_df, "fy2025", revenue_df=revenue_df)

        assert result.revenue is not None
        assert result.revenue.total_revenue == 1500000
        assert result.metadata.total_revenue == 1500000
        assert result.metadata.revenue_surplus_deficit == 1500000 - 2000000
        assert result.revenue.by_source[0].revenue_type == "tax"

    def test_transform_without_revenue_df(self, config_with_categorization):
        """Transform works without revenue_df (backward compatibility)."""
        transformer = CityOfChicagoTransformer(config_with_categorization)

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

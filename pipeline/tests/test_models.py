"""Tests for Pydantic schema models."""

from datetime import date

import pytest
from pydantic import ValidationError

from src.models.schema import (
    Appropriations,
    BudgetData,
    Department,
    FundBreakdown,
    FundSummary,
    Metadata,
    SimulationConfig,
    Subcategory,
)


class TestFundBreakdown:
    """Tests for FundBreakdown model."""

    def test_valid_fund_breakdown(self):
        """Test creating valid FundBreakdown."""
        fb = FundBreakdown(fund_id="corporate", fund_name="Corporate Fund", amount=1000000)
        assert fb.fund_id == "corporate"
        assert fb.fund_name == "Corporate Fund"
        assert fb.amount == 1000000

    def test_negative_amount_allowed(self):
        """Test that negative amounts are allowed (accounting adjustments)."""
        fb = FundBreakdown(fund_id="corporate", fund_name="Corporate Fund", amount=-1000)
        assert fb.amount == -1000


class TestSubcategory:
    """Tests for Subcategory model."""

    def test_valid_subcategory(self):
        """Test creating valid Subcategory."""
        sub = Subcategory(id="salaries", name="Salaries and Wages", amount=500000)
        assert sub.id == "salaries"
        assert sub.name == "Salaries and Wages"
        assert sub.amount == 500000

    def test_negative_amount_allowed(self):
        """Test that negative amounts are allowed (budget reductions)."""
        sub = Subcategory(id="test", name="Test", amount=-100)
        assert sub.amount == -100


class TestSimulationConfig:
    """Tests for SimulationConfig model."""

    def test_valid_adjustable_config(self):
        """Test creating valid adjustable config."""
        config = SimulationConfig(
            adjustable=True,
            min_pct=0.5,
            max_pct=1.5,
            description="Standard department",
        )
        assert config.adjustable is True
        assert config.min_pct == 0.5
        assert config.max_pct == 1.5
        assert config.step_pct == 0.01  # Default

    def test_valid_non_adjustable_config(self):
        """Test creating valid non-adjustable config."""
        config = SimulationConfig(
            adjustable=False,
            min_pct=1.0,
            max_pct=1.0,
            constraints=["Legally mandated"],
            description="Finance General",
        )
        assert config.adjustable is False
        assert config.constraints == ["Legally mandated"]

    def test_percentage_out_of_range(self):
        """Test that percentages out of range are rejected."""
        with pytest.raises(ValidationError):
            SimulationConfig(
                adjustable=True,
                min_pct=3.0,  # Too high
                max_pct=1.5,
                description="Test",
            )

        with pytest.raises(ValidationError):
            SimulationConfig(
                adjustable=True,
                min_pct=0.5,
                max_pct=-0.5,  # Negative
                description="Test",
            )


class TestDepartment:
    """Tests for Department model."""

    def test_minimal_department(self):
        """Test creating department with minimal required fields."""
        dept = Department(
            id="dept-police",
            name="Police",
            code="057",
            amount=1000000,
            simulation=SimulationConfig(
                adjustable=True,
                min_pct=0.5,
                max_pct=1.5,
                description="Standard department",
            ),
        )
        assert dept.id == "dept-police"
        assert dept.name == "Police"
        assert dept.amount == 1000000
        assert dept.fund_breakdown == []  # Default empty list
        assert dept.subcategories == []  # Default empty list

    def test_department_with_breakdowns(self):
        """Test department with fund breakdown and subcategories."""
        dept = Department(
            id="dept-police",
            name="Police",
            code="057",
            amount=2000000,
            fund_breakdown=[
                FundBreakdown(fund_id="corporate", fund_name="Corporate Fund", amount=2000000)
            ],
            subcategories=[
                Subcategory(id="salaries", name="Salaries", amount=1500000),
                Subcategory(id="services", name="Services", amount=500000),
            ],
            simulation=SimulationConfig(
                adjustable=True,
                min_pct=0.5,
                max_pct=1.5,
                description="Standard department",
            ),
        )
        assert len(dept.fund_breakdown) == 1
        assert len(dept.subcategories) == 2

    def test_department_with_prior_year(self):
        """Test department with prior year comparison."""
        dept = Department(
            id="dept-police",
            name="Police",
            code="057",
            amount=2000000,
            prior_year_amount=1800000,
            change_pct=11.11,
            simulation=SimulationConfig(
                adjustable=True,
                min_pct=0.5,
                max_pct=1.5,
                description="Standard department",
            ),
        )
        assert dept.prior_year_amount == 1800000
        assert dept.change_pct == 11.11

    def test_negative_amount_allowed(self):
        """Test that negative amounts are allowed (budget adjustments)."""
        dept = Department(
            id="dept-test",
            name="Test",
            code="999",
            amount=-1000,
            simulation=SimulationConfig(
                adjustable=True,
                min_pct=0.5,
                max_pct=1.5,
                description="Test",
            ),
        )
        assert dept.amount == -1000


class TestFundSummary:
    """Tests for FundSummary model."""

    def test_operating_fund(self):
        """Test creating operating fund summary."""
        fund = FundSummary(
            id="corporate",
            name="Corporate Fund",
            amount=10000000,
            fund_type="operating",
        )
        assert fund.fund_type == "operating"

    def test_grant_fund(self):
        """Test creating grant fund summary."""
        fund = FundSummary(
            id="federal-grant",
            name="Federal Grant",
            amount=1000000,
            fund_type="grant",
        )
        assert fund.fund_type == "grant"

    def test_invalid_fund_type(self):
        """Test that invalid fund types are rejected."""
        with pytest.raises(ValidationError):
            FundSummary(
                id="test",
                name="Test Fund",
                amount=1000000,
                fund_type="invalid",  # Not in allowed values
            )


class TestMetadata:
    """Tests for Metadata model."""

    def test_valid_metadata(self):
        """Test creating valid metadata with comprehensive totals."""
        metadata = Metadata(
            entity_id="city-of-chicago",
            entity_name="City of Chicago",
            fiscal_year="fy2025",
            fiscal_year_label="FY2025",
            fiscal_year_start=date(2025, 1, 1),
            fiscal_year_end=date(2025, 12, 31),
            gross_appropriations=16700000000,
            accounting_adjustments=-100000000,
            total_appropriations=16600000000,
            operating_appropriations=14000000000,
            fund_category_breakdown={"operating": 14000000000, "enterprise": 2600000000},
            data_source="socrata_api",
            source_dataset_id="test-id",
            extraction_date=date.today(),
            pipeline_version="1.0.0",
        )
        assert metadata.entity_id == "city-of-chicago"
        assert metadata.fiscal_year == "fy2025"
        assert metadata.gross_appropriations == 16700000000
        assert metadata.accounting_adjustments == -100000000
        assert metadata.total_appropriations == 16600000000
        assert metadata.operating_appropriations == 14000000000
        assert metadata.fund_category_breakdown["operating"] == 14000000000

    def test_metadata_defaults(self):
        """Test that optional fields have correct defaults."""
        metadata = Metadata(
            entity_id="test",
            entity_name="Test",
            fiscal_year="fy2025",
            fiscal_year_label="FY2025",
            fiscal_year_start=date(2025, 1, 1),
            fiscal_year_end=date(2025, 12, 31),
            gross_appropriations=1000000,
            total_appropriations=1000000,
            data_source="test",
            source_dataset_id="test-id",
            extraction_date=date.today(),
            pipeline_version="1.0.0",
        )
        assert metadata.accounting_adjustments == 0
        assert metadata.operating_appropriations is None
        assert metadata.fund_category_breakdown == {}
        assert metadata.notes is None

    def test_fiscal_year_pattern_validation(self):
        """Test that fiscal year must match pattern."""
        with pytest.raises(ValidationError):
            Metadata(
                entity_id="city-of-chicago",
                entity_name="City of Chicago",
                fiscal_year="2025",  # Wrong format, should be "fy2025"
                fiscal_year_label="FY2025",
                fiscal_year_start=date(2025, 1, 1),
                fiscal_year_end=date(2025, 12, 31),
                gross_appropriations=1000000,
                total_appropriations=1000000,
                data_source="test",
                source_dataset_id="test-id",
                extraction_date=date.today(),
                pipeline_version="1.0.0",
            )

    def test_negative_gross_rejected(self):
        """Test that negative gross_appropriations is rejected."""
        with pytest.raises(ValidationError):
            Metadata(
                entity_id="city-of-chicago",
                entity_name="City of Chicago",
                fiscal_year="fy2025",
                fiscal_year_label="FY2025",
                fiscal_year_start=date(2025, 1, 1),
                fiscal_year_end=date(2025, 12, 31),
                gross_appropriations=-1000000,  # Negative gross not allowed
                total_appropriations=1000000,
                data_source="test",
                source_dataset_id="test-id",
                extraction_date=date.today(),
                pipeline_version="1.0.0",
            )

    def test_negative_total_allowed(self):
        """Test that negative total_appropriations is allowed (rare but valid)."""
        metadata = Metadata(
            entity_id="test",
            entity_name="Test",
            fiscal_year="fy2025",
            fiscal_year_label="FY2025",
            fiscal_year_start=date(2025, 1, 1),
            fiscal_year_end=date(2025, 12, 31),
            gross_appropriations=0,
            accounting_adjustments=-50000,
            total_appropriations=-50000,
            data_source="test",
            source_dataset_id="test-id",
            extraction_date=date.today(),
            pipeline_version="1.0.0",
        )
        assert metadata.total_appropriations == -50000

    def test_negative_accounting_adjustments_allowed(self):
        """Test that negative accounting_adjustments is allowed."""
        metadata = Metadata(
            entity_id="test",
            entity_name="Test",
            fiscal_year="fy2025",
            fiscal_year_label="FY2025",
            fiscal_year_start=date(2025, 1, 1),
            fiscal_year_end=date(2025, 12, 31),
            gross_appropriations=1000000,
            accounting_adjustments=-50000,
            total_appropriations=950000,
            data_source="test",
            source_dataset_id="test-id",
            extraction_date=date.today(),
            pipeline_version="1.0.0",
        )
        assert metadata.accounting_adjustments == -50000


class TestBudgetData:
    """Tests for BudgetData (top-level model)."""

    def test_valid_budget_data(self):
        """Test creating valid complete BudgetData."""
        budget = BudgetData(
            metadata=Metadata(
                entity_id="city-of-chicago",
                entity_name="City of Chicago",
                fiscal_year="fy2025",
                fiscal_year_label="FY2025",
                fiscal_year_start=date(2025, 1, 1),
                fiscal_year_end=date(2025, 12, 31),
                gross_appropriations=3000000,
                total_appropriations=3000000,
                data_source="test",
                source_dataset_id="test-id",
                extraction_date=date.today(),
                pipeline_version="1.0.0",
            ),
            appropriations=Appropriations(
                by_department=[
                    Department(
                        id="dept-police",
                        name="Police",
                        code="057",
                        amount=2000000,
                        simulation=SimulationConfig(
                            adjustable=True,
                            min_pct=0.5,
                            max_pct=1.5,
                            description="Test",
                        ),
                    ),
                    Department(
                        id="dept-fire",
                        name="Fire",
                        code="070",
                        amount=1000000,
                        simulation=SimulationConfig(
                            adjustable=True,
                            min_pct=0.5,
                            max_pct=1.5,
                            description="Test",
                        ),
                    ),
                ],
                by_fund=[
                    FundSummary(
                        id="corporate",
                        name="Corporate Fund",
                        amount=3000000,
                        fund_type="operating",
                    )
                ],
            ),
        )

        assert budget.schema_version == "1.0.0"  # Default
        assert len(budget.appropriations.by_department) == 2
        assert len(budget.appropriations.by_fund) == 1

    def test_json_serialization(self):
        """Test that BudgetData can be serialized to JSON."""
        budget = BudgetData(
            metadata=Metadata(
                entity_id="city-of-chicago",
                entity_name="City of Chicago",
                fiscal_year="fy2025",
                fiscal_year_label="FY2025",
                fiscal_year_start=date(2025, 1, 1),
                fiscal_year_end=date(2025, 12, 31),
                gross_appropriations=1000000,
                total_appropriations=1000000,
                data_source="test",
                source_dataset_id="test-id",
                extraction_date=date.today(),
                pipeline_version="1.0.0",
            ),
            appropriations=Appropriations(
                by_department=[],
                by_fund=[],
            ),
        )

        json_str = budget.model_dump_json()
        assert isinstance(json_str, str)
        assert "city-of-chicago" in json_str
        assert "fy2025" in json_str

"""Tests for budget validator."""

from datetime import date

import pytest

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
from src.validators.budget import BudgetValidator


@pytest.fixture
def valid_budget_data():
    """Create valid BudgetData for testing."""
    return BudgetData(
        metadata=Metadata(
            entity_id="city-of-chicago",
            entity_name="City of Chicago",
            fiscal_year="fy2025",
            fiscal_year_label="FY2025",
            fiscal_year_start=date(2025, 1, 1),
            fiscal_year_end=date(2025, 12, 31),
            gross_appropriations=3000000000,
            total_appropriations=3000000000,
            operating_appropriations=3000000000,
            fund_category_breakdown={"operating": 3000000000},
            data_source="test",
            source_dataset_id="test",
            extraction_date=date.today(),
            pipeline_version="1.0.0",
        ),
        appropriations=Appropriations(
            by_department=[
                Department(
                    id="dept-police",
                    name="Police",
                    code="057",
                    amount=2000000000,
                    fund_breakdown=[
                        FundBreakdown(
                            fund_id="fund-local", fund_name="Corporate Fund", amount=2000000000
                        )
                    ],
                    subcategories=[
                        Subcategory(
                            id="police-salaries", name="Salaries and Wages", amount=1500000000
                        ),
                        Subcategory(
                            id="police-contracts", name="Contractual Services", amount=500000000
                        ),
                    ],
                    simulation=SimulationConfig(
                        adjustable=True,
                        min_pct=0.5,
                        max_pct=1.5,
                        description="Police department budget",
                    ),
                ),
                Department(
                    id="dept-fire",
                    name="Fire",
                    code="070",
                    amount=1000000000,
                    fund_breakdown=[
                        FundBreakdown(
                            fund_id="fund-local", fund_name="Corporate Fund", amount=1000000000
                        )
                    ],
                    subcategories=[
                        Subcategory(
                            id="fire-salaries", name="Salaries and Wages", amount=900000000
                        ),
                        Subcategory(id="fire-equipment", name="Equipment", amount=100000000),
                    ],
                    simulation=SimulationConfig(
                        adjustable=True, min_pct=0.5, max_pct=1.5, description="Fire department"
                    ),
                ),
            ],
            by_fund=[
                FundSummary(
                    id="fund-local",
                    name="Corporate Fund",
                    amount=3000000000,
                    fund_type="operating",
                )
            ],
        ),
    )


class TestBudgetValidator:
    """Tests for BudgetValidator."""

    def test_valid_data_passes(self, valid_budget_data):
        """Test that valid data passes validation."""
        validator = BudgetValidator()
        result = validator.validate(valid_budget_data)

        assert result is True
        assert len(validator.errors) == 0

    def test_department_sum_mismatch_fails(self, valid_budget_data):
        """Test that department sum != total fails validation."""
        # Change total to not match sum of departments
        valid_budget_data.metadata.total_appropriations = 9999999999

        validator = BudgetValidator()
        result = validator.validate(valid_budget_data)

        assert result is False
        assert len(validator.errors) > 0
        assert "Department sum" in validator.errors[0]

    def test_subcategory_sum_mismatch_fails(self, valid_budget_data):
        """Test that subcategory sum != department fails validation."""
        # Change Police subcategories to not sum to department total
        valid_budget_data.appropriations.by_department[0].subcategories[0].amount = 1

        validator = BudgetValidator()
        result = validator.validate(valid_budget_data)

        assert result is False
        assert "Subcategory sum" in validator.errors[0]
        assert "Police" in validator.errors[0]

    def test_fund_breakdown_sum_mismatch_warns(self, valid_budget_data):
        """Test that fund breakdown sum != department creates warning."""
        # Change fund breakdown to not match
        valid_budget_data.appropriations.by_department[0].fund_breakdown[0].amount = 1

        validator = BudgetValidator()
        result = validator.validate(valid_budget_data)

        # Should still pass but with warning
        assert result is True
        assert len(validator.warnings) > 0
        assert "Fund breakdown" in validator.warnings[0]

    def test_duplicate_department_ids_fails(self, valid_budget_data):
        """Test that duplicate department IDs fail validation."""
        # Duplicate the first department
        valid_budget_data.appropriations.by_department.append(
            valid_budget_data.appropriations.by_department[0]
        )
        # Adjust totals to match
        valid_budget_data.metadata.gross_appropriations = 5000000000
        valid_budget_data.metadata.total_appropriations = 5000000000
        valid_budget_data.appropriations.by_fund[0].amount = 5000000000

        validator = BudgetValidator()
        result = validator.validate(valid_budget_data)

        assert result is False
        assert any("duplicate" in err.lower() for err in validator.errors)

    def test_tolerance_allows_rounding(self, valid_budget_data):
        """Test that small differences (rounding) are tolerated."""
        # Off by 50 cents
        valid_budget_data.metadata.total_appropriations = 3000000001

        validator = BudgetValidator(tolerance=1.0)
        result = validator.validate(valid_budget_data)

        # Should pass with tolerance
        assert result is True

    def test_validator_accepts_negative_amounts(self):
        """Test that validator allows negative amounts (accounting adjustments)."""
        budget_data = BudgetData(
            metadata=Metadata(
                entity_id="test",
                entity_name="Test Entity",
                fiscal_year="fy2025",
                fiscal_year_label="FY2025",
                fiscal_year_start=date(2025, 1, 1),
                fiscal_year_end=date(2025, 12, 31),
                gross_appropriations=1000000,
                accounting_adjustments=-50000,
                total_appropriations=950000,
                operating_appropriations=800000,
                fund_category_breakdown={"operating": 800000, "enterprise": 150000},
                data_source="test",
                source_dataset_id="test",
                extraction_date=date.today(),
                pipeline_version="1.0.0",
            ),
            appropriations=Appropriations(
                by_department=[
                    Department(
                        id="dept-a",
                        name="Department A",
                        code="001",
                        amount=1000000,
                        fund_breakdown=[
                            FundBreakdown(
                                fund_id="fund-local",
                                fund_name="Corporate Fund",
                                amount=1000000,
                            )
                        ],
                        subcategories=[
                            Subcategory(id="a-salaries", name="Salaries", amount=1000000)
                        ],
                        simulation=SimulationConfig(
                            adjustable=True,
                            description="Test dept",
                        ),
                    ),
                    Department(
                        id="dept-adjustments",
                        name="Adjustments",
                        code="999",
                        amount=-50000,
                        fund_breakdown=[
                            FundBreakdown(
                                fund_id="fund-local",
                                fund_name="Corporate Fund",
                                amount=-50000,
                            )
                        ],
                        subcategories=[
                            Subcategory(
                                id="adj-reductions",
                                name="Budget Reductions",
                                amount=-50000,
                            )
                        ],
                        simulation=SimulationConfig(
                            adjustable=False,
                            min_pct=1.0,
                            max_pct=1.0,
                            description="Budget adjustments",
                        ),
                    ),
                ],
                by_fund=[
                    FundSummary(
                        id="fund-local",
                        name="Corporate Fund",
                        amount=950000,
                        fund_type="operating",
                    )
                ],
            ),
        )

        validator = BudgetValidator()
        result = validator.validate(budget_data)

        assert result is True
        assert len(validator.errors) == 0

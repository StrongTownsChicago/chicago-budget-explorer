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
    Revenue,
    RevenueSource,
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
            total_appropriations=3000000000,
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
        # Adjust total to match
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


class TestRevenueValidation:
    """Tests for revenue validation."""

    @pytest.fixture
    def budget_with_revenue(self):
        """Create BudgetData with valid revenue."""
        return BudgetData(
            metadata=Metadata(
                entity_id="city-of-chicago",
                entity_name="City of Chicago",
                fiscal_year="fy2025",
                fiscal_year_label="FY2025",
                fiscal_year_start=date(2025, 1, 1),
                fiscal_year_end=date(2025, 12, 31),
                total_appropriations=3000000000,
                data_source="test",
                source_dataset_id="test",
                extraction_date=date.today(),
                pipeline_version="1.0.0",
                total_revenue=2300000000,
                revenue_surplus_deficit=-700000000,
            ),
            appropriations=Appropriations(
                by_department=[
                    Department(
                        id="dept-police",
                        name="Police",
                        code="057",
                        amount=3000000000,
                        simulation=SimulationConfig(
                            adjustable=True, min_pct=0.5, max_pct=1.5, description="Test"
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
            revenue=Revenue(
                by_source=[
                    RevenueSource(
                        id="revenue-property-tax",
                        name="Property Tax",
                        amount=1500000000,
                        subcategories=[
                            Subcategory(id="prop-levy", name="Tax Levy", amount=1500000000),
                        ],
                    ),
                    RevenueSource(
                        id="revenue-sales-tax",
                        name="Sales Tax",
                        amount=800000000,
                        subcategories=[
                            Subcategory(
                                id="sales-home-rule",
                                name="Home Rule Sales Tax",
                                amount=800000000,
                            ),
                        ],
                    ),
                ],
                by_fund=[],
                total_revenue=2300000000,
                local_revenue_only=True,
                grant_revenue_estimated=None,
            ),
        )

    def test_valid_revenue_passes(self, budget_with_revenue):
        """Revenue sources sum to total_revenue correctly."""
        validator = BudgetValidator()
        result = validator.validate(budget_with_revenue)
        assert result is True
        # Only warnings about revenue vs appropriations gap (>10%)
        revenue_errors = [e for e in validator.errors if "Revenue" in e or "revenue" in e]
        assert len(revenue_errors) == 0

    def test_revenue_hierarchical_sums_fail(self, budget_with_revenue):
        """Revenue sources that do not sum to total trigger error."""
        budget_with_revenue.revenue.total_revenue = 9999999999

        validator = BudgetValidator()
        validator.validate(budget_with_revenue)

        sum_errors = [e for e in validator.errors if "sources sum" in e.lower()]
        assert len(sum_errors) == 1

    def test_revenue_balance_warning(self, budget_with_revenue):
        """Revenue significantly different from appropriations triggers warning."""
        # Revenue is 2.3B vs 3B appropriations (23% gap > 10%)
        validator = BudgetValidator()
        validator.validate(budget_with_revenue)

        balance_warnings = [w for w in validator.warnings if "differ by" in w.lower()]
        assert len(balance_warnings) == 1

    def test_grant_transparency_warning(self, budget_with_revenue):
        """Grant revenue estimated triggers transparency warning."""
        budget_with_revenue.revenue.grant_revenue_estimated = 2500000000

        validator = BudgetValidator()
        validator.validate(budget_with_revenue)

        grant_warnings = [w for w in validator.warnings if "grant" in w.lower()]
        assert len(grant_warnings) == 1

    def test_subcategory_sum_mismatch_fails(self, budget_with_revenue):
        """Revenue source subcategories must sum to source total."""
        # Break subcategory sum for Property Tax
        budget_with_revenue.revenue.by_source[0].subcategories[0].amount = 1

        validator = BudgetValidator()
        validator.validate(budget_with_revenue)

        subcat_errors = [e for e in validator.errors if "subcategories sum" in e.lower()]
        assert len(subcat_errors) == 1

    def test_no_revenue_skips_validation(self):
        """Validation passes when revenue is None."""
        budget = BudgetData(
            metadata=Metadata(
                entity_id="city-of-chicago",
                entity_name="City of Chicago",
                fiscal_year="fy2025",
                fiscal_year_label="FY2025",
                fiscal_year_start=date(2025, 1, 1),
                fiscal_year_end=date(2025, 12, 31),
                total_appropriations=1000000,
                data_source="test",
                source_dataset_id="test",
                extraction_date=date.today(),
                pipeline_version="1.0.0",
            ),
            appropriations=Appropriations(
                by_department=[
                    Department(
                        id="dept-test",
                        name="Test",
                        code="001",
                        amount=1000000,
                        simulation=SimulationConfig(
                            adjustable=True, min_pct=0.5, max_pct=1.5, description="Test"
                        ),
                    ),
                ],
                by_fund=[
                    FundSummary(
                        id="fund-local",
                        name="Corporate Fund",
                        amount=1000000,
                        fund_type="operating",
                    )
                ],
            ),
            revenue=None,
        )

        validator = BudgetValidator()
        result = validator.validate(budget)
        assert result is True

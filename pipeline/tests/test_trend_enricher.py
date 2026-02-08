"""Tests for trend enricher post-processor."""

import json
from pathlib import Path

from src.models.schema import (
    Appropriations,
    BudgetData,
    Department,
    FundSummary,
    Metadata,
    SimulationConfig,
    TrendPoint,
)
from src.transformers.trend_enricher import (
    build_department_index,
    enrich_entity,
    enrich_with_trends,
)


def make_department(
    name: str, code: str, amount: int, trend: list[TrendPoint] | None = None
) -> Department:
    """Create a test department with minimal required fields."""
    return Department(
        id=f"dept-{name.lower().replace(' ', '-')}",
        name=name,
        code=code,
        amount=amount,
        prior_year_amount=None,
        change_pct=None,
        fund_breakdown=[],
        subcategories=[],
        simulation=SimulationConfig(
            adjustable=True,
            min_pct=0.5,
            max_pct=1.5,
            step_pct=0.01,
            constraints=[],
            description="Test department",
        ),
        trend=trend,
    )


def make_budget_data(fiscal_year: str, departments: list[Department]) -> BudgetData:
    """Create a test BudgetData with minimal required fields."""
    total = sum(d.amount for d in departments)
    return BudgetData(
        metadata=Metadata(
            entity_id="city-of-chicago",
            entity_name="City of Chicago",
            fiscal_year=fiscal_year,
            fiscal_year_label=fiscal_year.upper(),
            fiscal_year_start=f"{fiscal_year.replace('fy', '')}-01-01",
            fiscal_year_end=f"{fiscal_year.replace('fy', '')}-12-31",
            gross_appropriations=total,
            accounting_adjustments=0,
            total_appropriations=total,
            operating_appropriations=total,
            fund_category_breakdown={"operating": total},
            data_source="test",
            source_dataset_id="test-dataset",
            extraction_date="2026-01-01",
            pipeline_version="1.0.0",
            notes=None,
            total_revenue=None,
            revenue_surplus_deficit=None,
        ),
        appropriations=Appropriations(
            by_department=departments,
            by_fund=[
                FundSummary(
                    id="corporate",
                    name="Corporate Fund",
                    amount=total,
                    fund_type="operating",
                )
            ],
        ),
        schema_version="1.0.0",
    )


class TestBuildDepartmentIndex:
    """Tests for building department trend index."""

    def test_matching_departments_all_years(self):
        """Departments present in all years get complete trend arrays."""
        year_data = {
            "fy2023": make_budget_data(
                "fy2023",
                [
                    make_department("Police", "057", 1_900_000_000),
                    make_department("Fire", "070", 900_000_000),
                ],
            ),
            "fy2024": make_budget_data(
                "fy2024",
                [
                    make_department("Police", "057", 1_950_000_000),
                    make_department("Fire", "070", 920_000_000),
                ],
            ),
            "fy2025": make_budget_data(
                "fy2025",
                [
                    make_department("Police", "057", 2_000_000_000),
                    make_department("Fire", "070", 950_000_000),
                ],
            ),
        }

        index = build_department_index(year_data)

        assert len(index["057"]) == 3
        assert index["057"][0].fiscal_year == "fy2023"
        assert index["057"][0].amount == 1_900_000_000
        assert index["057"][1].fiscal_year == "fy2024"
        assert index["057"][2].fiscal_year == "fy2025"
        assert index["057"][2].amount == 2_000_000_000

        assert len(index["070"]) == 3

    def test_department_missing_in_one_year(self):
        """Department missing in one year gets partial trend."""
        year_data = {
            "fy2023": make_budget_data(
                "fy2023",
                [make_department("Police", "057", 1_900_000_000)],
            ),
            "fy2024": make_budget_data(
                "fy2024",
                [
                    make_department("Police", "057", 1_950_000_000),
                    make_department("New Office", "200", 50_000_000),
                ],
            ),
            "fy2025": make_budget_data(
                "fy2025",
                [make_department("Police", "057", 2_000_000_000)],
            ),
        }

        index = build_department_index(year_data)

        # Police present in all 3 years
        assert len(index["057"]) == 3

        # New Office only in fy2024
        assert len(index["200"]) == 1
        assert index["200"][0].fiscal_year == "fy2024"

    def test_new_department_appears_partway(self):
        """Department that appears partway through gets partial trend."""
        year_data = {
            "fy2023": make_budget_data(
                "fy2023",
                [make_department("Police", "057", 1_900_000_000)],
            ),
            "fy2024": make_budget_data(
                "fy2024",
                [
                    make_department("Police", "057", 1_950_000_000),
                    make_department("Ethics", "300", 5_000_000),
                ],
            ),
            "fy2025": make_budget_data(
                "fy2025",
                [
                    make_department("Police", "057", 2_000_000_000),
                    make_department("Ethics", "300", 6_000_000),
                ],
            ),
        }

        index = build_department_index(year_data)

        assert len(index["300"]) == 2
        assert index["300"][0].fiscal_year == "fy2024"
        assert index["300"][1].fiscal_year == "fy2025"

    def test_single_year(self):
        """Single year of data produces single-point trends."""
        year_data = {
            "fy2025": make_budget_data(
                "fy2025",
                [
                    make_department("Police", "057", 2_000_000_000),
                    make_department("Fire", "070", 950_000_000),
                ],
            ),
        }

        index = build_department_index(year_data)

        assert len(index["057"]) == 1
        assert index["057"][0].fiscal_year == "fy2025"

    def test_sorts_by_year_ascending(self):
        """Trend points are always sorted oldest-to-newest."""
        # Provide years in reverse order to test sorting
        year_data = {
            "fy2025": make_budget_data(
                "fy2025",
                [make_department("Police", "057", 2_000_000_000)],
            ),
            "fy2023": make_budget_data(
                "fy2023",
                [make_department("Police", "057", 1_900_000_000)],
            ),
            "fy2024": make_budget_data(
                "fy2024",
                [make_department("Police", "057", 1_950_000_000)],
            ),
        }

        index = build_department_index(year_data)

        years = [tp.fiscal_year for tp in index["057"]]
        assert years == ["fy2023", "fy2024", "fy2025"]

    def test_department_code_match_with_name_difference(self):
        """Departments matched by code even when names differ across years."""
        year_data = {
            "fy2023": make_budget_data(
                "fy2023",
                [make_department("Police Department", "057", 1_900_000_000)],
            ),
            "fy2024": make_budget_data(
                "fy2024",
                [make_department("Police", "057", 1_950_000_000)],
            ),
        }

        index = build_department_index(year_data)

        # Same code "057" matches both years despite different names
        assert len(index["057"]) == 2


class TestEnrichWithTrends:
    """Tests for enriching BudgetData with trends."""

    def test_injects_trend_arrays(self):
        """Enrichment injects trend arrays into departments."""
        year_data = {
            "fy2023": make_budget_data(
                "fy2023",
                [make_department("Police", "057", 1_900_000_000)],
            ),
            "fy2024": make_budget_data(
                "fy2024",
                [make_department("Police", "057", 1_950_000_000)],
            ),
        }

        enriched = enrich_with_trends(year_data)

        # Both years' Police departments should have the same trend
        for fy, data in enriched.items():
            police = data.appropriations.by_department[0]
            assert police.trend is not None
            assert len(police.trend) == 2
            assert police.trend[0].fiscal_year == "fy2023"
            assert police.trend[1].fiscal_year == "fy2024"

    def test_preserves_existing_fields(self):
        """Enrichment does not corrupt existing BudgetData fields."""
        dept = make_department("Police", "057", 2_000_000_000)
        dept.prior_year_amount = 1_900_000_000
        dept.change_pct = 5.26

        year_data = {
            "fy2025": make_budget_data("fy2025", [dept]),
        }

        enriched = enrich_with_trends(year_data)

        police = enriched["fy2025"].appropriations.by_department[0]

        # Existing fields preserved
        assert police.name == "Police"
        assert police.code == "057"
        assert police.amount == 2_000_000_000
        assert police.prior_year_amount == 1_900_000_000
        assert police.change_pct == 5.26

        # Metadata preserved
        assert enriched["fy2025"].metadata.entity_id == "city-of-chicago"
        assert enriched["fy2025"].metadata.fiscal_year == "fy2025"
        assert enriched["fy2025"].schema_version == "1.0.0"

    def test_idempotent(self):
        """Running enricher twice produces identical output."""
        year_data = {
            "fy2023": make_budget_data(
                "fy2023",
                [make_department("Police", "057", 1_900_000_000)],
            ),
            "fy2024": make_budget_data(
                "fy2024",
                [make_department("Police", "057", 1_950_000_000)],
            ),
        }

        first_result = enrich_with_trends(year_data)

        # Serialize and deserialize to get clean copies
        serialized = {
            fy: BudgetData(**json.loads(data.model_dump_json()))
            for fy, data in first_result.items()
        }

        second_result = enrich_with_trends(serialized)

        for fy in first_result:
            first_json = first_result[fy].model_dump_json()
            second_json = second_result[fy].model_dump_json()
            assert first_json == second_json

    def test_empty_year_data(self):
        """Empty year_data returns empty dict without error."""
        result = enrich_with_trends({})
        assert result == {}


class TestEnrichEntity:
    """Tests for full entity enrichment including file I/O."""

    def test_enriches_files_on_disk(self, tmp_path: Path):
        """Enricher reads, enriches, and writes back JSON files."""
        entity_dir = tmp_path / "city-of-chicago"
        entity_dir.mkdir()

        # Create test JSON files
        fy2023_data = make_budget_data(
            "fy2023",
            [
                make_department("Police", "057", 1_900_000_000),
                make_department("Fire", "070", 900_000_000),
            ],
        )
        fy2024_data = make_budget_data(
            "fy2024",
            [
                make_department("Police", "057", 1_950_000_000),
                make_department("Fire", "070", 920_000_000),
            ],
        )

        for fy, data in [("fy2023", fy2023_data), ("fy2024", fy2024_data)]:
            with open(entity_dir / f"{fy}.json", "w") as f:
                json.dump(data.model_dump(mode="json"), f, default=str)

        count = enrich_entity(entity_dir)

        assert count == 2

        # Read back and verify trend arrays
        with open(entity_dir / "fy2024.json") as f:
            result = BudgetData(**json.load(f))

        police = next(d for d in result.appropriations.by_department if d.code == "057")
        assert police.trend is not None
        assert len(police.trend) == 2
        assert police.trend[0].fiscal_year == "fy2023"
        assert police.trend[1].fiscal_year == "fy2024"

    def test_empty_directory(self, tmp_path: Path):
        """Empty output directory completes without error."""
        entity_dir = tmp_path / "empty-entity"
        entity_dir.mkdir()

        count = enrich_entity(entity_dir)
        assert count == 0

    def test_single_file(self, tmp_path: Path):
        """Single year file gets single-point trend arrays."""
        entity_dir = tmp_path / "city-of-chicago"
        entity_dir.mkdir()

        data = make_budget_data(
            "fy2025",
            [make_department("Police", "057", 2_000_000_000)],
        )
        with open(entity_dir / "fy2025.json", "w") as f:
            json.dump(data.model_dump(mode="json"), f, default=str)

        count = enrich_entity(entity_dir)
        assert count == 1

        with open(entity_dir / "fy2025.json") as f:
            result = BudgetData(**json.load(f))

        police = result.appropriations.by_department[0]
        assert police.trend is not None
        assert len(police.trend) == 1
        assert police.trend[0].fiscal_year == "fy2025"

    def test_output_validates_against_schema(self, tmp_path: Path):
        """Enriched output validates against BudgetData schema."""
        entity_dir = tmp_path / "city-of-chicago"
        entity_dir.mkdir()

        data = make_budget_data(
            "fy2025",
            [
                make_department("Police", "057", 2_000_000_000),
                make_department("Fire", "070", 950_000_000),
            ],
        )
        with open(entity_dir / "fy2025.json", "w") as f:
            json.dump(data.model_dump(mode="json"), f, default=str)

        enrich_entity(entity_dir)

        # This should not raise a validation error
        with open(entity_dir / "fy2025.json") as f:
            result = BudgetData(**json.load(f))

        assert result.appropriations.by_department[0].trend is not None


class TestTrendPointModel:
    """Tests for TrendPoint Pydantic model."""

    def test_valid_trend_point(self):
        """Valid TrendPoint creates successfully."""
        tp = TrendPoint(fiscal_year="fy2025", amount=1_000_000)
        assert tp.fiscal_year == "fy2025"
        assert tp.amount == 1_000_000

    def test_negative_amount_allowed(self):
        """Negative amounts are allowed (accounting adjustments)."""
        tp = TrendPoint(fiscal_year="fy2025", amount=-50_000)
        assert tp.amount == -50_000

    def test_department_with_trend(self):
        """Department model accepts optional trend field."""
        # Without trend (backward compatible)
        dept_no_trend = make_department("Police", "057", 1_000_000)
        assert dept_no_trend.trend is None

        # With empty trend
        dept_empty = make_department("Police", "057", 1_000_000, trend=[])
        assert dept_empty.trend == []

        # With populated trend
        trend_data = [
            TrendPoint(fiscal_year="fy2023", amount=900_000),
            TrendPoint(fiscal_year="fy2024", amount=950_000),
        ]
        dept_with_trend = make_department("Police", "057", 1_000_000, trend=trend_data)
        assert dept_with_trend.trend is not None
        assert len(dept_with_trend.trend) == 2

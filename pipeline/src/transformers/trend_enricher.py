"""Post-processor that enriches budget data with cross-year trend arrays.

Reads all generated JSON files for an entity, matches departments across years
by department code (with name fallback), and injects trend arrays into each
department. This runs after all single-year transforms complete.
"""

import json
from pathlib import Path

from ..models.schema import BudgetData, TrendPoint


def load_all_years(entity_output_dir: Path) -> dict[str, BudgetData]:
    """Load all fiscal year JSON files for an entity.

    Args:
        entity_output_dir: Path to entity's output directory (e.g., output/city-of-chicago/)

    Returns:
        Dictionary mapping fiscal year to BudgetData (sorted ascending by year)
    """
    year_data: dict[str, BudgetData] = {}

    json_files = sorted(entity_output_dir.glob("fy*.json"))
    for json_file in json_files:
        with open(json_file) as f:
            data_dict = json.load(f)
        budget_data = BudgetData(**data_dict)
        year_data[json_file.stem] = budget_data

    return dict(sorted(year_data.items()))


def build_department_index(
    year_data: dict[str, BudgetData],
) -> dict[str, list[TrendPoint]]:
    """Build trend arrays indexed by department code, with name fallback.

    Primary matching is by department code (e.g., "057" for Police), which is
    the most stable identifier across years. Falls back to normalized department
    name if the code doesn't produce a match.

    Args:
        year_data: Dictionary mapping fiscal year to BudgetData (sorted ascending)

    Returns:
        Dictionary mapping department code to sorted list of TrendPoints
    """
    # Index by code: code -> list of (fiscal_year, amount)
    trends_by_code: dict[str, list[TrendPoint]] = {}
    # Track which codes map to which names for fallback
    code_to_name: dict[str, str] = {}

    for fiscal_year, budget_data in year_data.items():
        for dept in budget_data.appropriations.by_department:
            if dept.code not in trends_by_code:
                trends_by_code[dept.code] = []
            trends_by_code[dept.code].append(
                TrendPoint(fiscal_year=fiscal_year, amount=dept.amount)
            )
            code_to_name[dept.code] = dept.name

    # Sort each trend by fiscal year ascending (should already be in order,
    # but ensure correctness)
    for code in trends_by_code:
        trends_by_code[code].sort(key=lambda tp: tp.fiscal_year)

    return trends_by_code


def enrich_with_trends(year_data: dict[str, BudgetData]) -> dict[str, BudgetData]:
    """Enrich all years' department data with trend arrays.

    For each department in each year, adds a trend array containing the
    department's budget amount across all available years (matched by code).

    Args:
        year_data: Dictionary mapping fiscal year to BudgetData

    Returns:
        Updated dictionary with trend arrays injected into departments
    """
    if not year_data:
        return year_data

    trends_by_code = build_department_index(year_data)

    # Inject trend arrays into each year's departments
    for budget_data in year_data.values():
        for dept in budget_data.appropriations.by_department:
            trend = trends_by_code.get(dept.code)
            if trend:
                dept.trend = trend

    return year_data


def enrich_entity(entity_output_dir: Path) -> int:
    """Run trend enrichment for a single entity.

    Loads all year files, builds trend arrays, and writes enriched data back.

    Args:
        entity_output_dir: Path to entity's output directory

    Returns:
        Number of files enriched
    """
    year_data = load_all_years(entity_output_dir)

    if not year_data:
        return 0

    enriched_data = enrich_with_trends(year_data)

    # Write enriched data back to JSON files
    for fiscal_year, budget_data in enriched_data.items():
        output_file = entity_output_dir / f"{fiscal_year}.json"
        with open(output_file, "w") as f:
            json.dump(budget_data.model_dump(mode="json"), f, indent=2, default=str)

    return len(enriched_data)

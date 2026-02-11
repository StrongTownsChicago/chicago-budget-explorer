# Pipeline Context for AI Agents

## Overview

Python data pipeline for the Chicago Budget Explorer. Extracts budget data from sources (primarily Socrata API), transforms into normalized JSON schema, validates data quality.

## Quick Reference

**Run pipeline**: `make all` (fetch + transform + validate + copy to frontend)
**Test**: `make test`
**Lint**: `make lint`
**Format**: `make format`

## Architecture

### Data Flow

```
Socrata API → Extractor → DataFrame → Transformer → BudgetData → Validator → JSON
                                                         ↓
                                                   Trend Enricher (cross-year trends)
```

1. **Extract** (src/extractors/): Fetch raw data from source
2. **Transform** (src/transformers/): Convert to BudgetData schema, aggregate by department
3. **Enrich** (src/transformers/trend_enricher.py): Add cross-year trend data to departments, revenue sources, and subcategories
4. **Validate** (src/validators/): Check hierarchical sums, cross-year consistency, revenue
5. **Output**: JSON files to `output/` (copied to frontend/src/data)

### Key Concepts

**Entity**: A government body (City of Chicago, CPS, etc.). Configured in `config/entities.yaml`.

**Fiscal Year**: Identifier like "fy2025". Budget data specific to one fiscal year.

**BudgetData**: Top-level Pydantic model. One JSON file per entity per fiscal year.

**Department**: Aggregated budget for one department. Includes fund breakdown, subcategories, simulation constraints.

**Hierarchical Sums**: Departments sum to total, subcategories sum to department, etc. Validator enforces.

## File Organization

```
pipeline/
├── config/
│   └── entities.yaml          # Entity configuration (Socrata datasets, transform rules)
├── src/
│   ├── models/
│   │   ├── schema.py          # BudgetData Pydantic models (THE schema)
│   │   └── manifest.py        # Manifest model (list of entities/years)
│   ├── extractors/
│   │   ├── base.py            # Abstract extractor
│   │   └── socrata.py         # Socrata API extractor
│   ├── transformers/
│   │   ├── base.py            # Abstract transformer
│   │   ├── city_of_chicago.py # City-specific transformation logic
│   │   └── trend_enricher.py  # Cross-year trend enrichment
│   ├── validators/
│   │   └── budget.py          # Data quality validation
│   └── cli.py                 # CLI commands
├── output/                    # Generated JSON (gitignored, copied to frontend)
└── tests/                     # Tests (pytest)
```

## Common Tasks

### Add a New Fiscal Year

1. Find Socrata dataset ID on data.cityofchicago.org
2. Add to `config/entities.yaml` under `city-of-chicago.socrata.datasets`:
   ```yaml
   fy2026:
     appropriations: "xxxx-xxxx"
   ```
3. Run `make fetch` and `make transform`

### Add a New Entity

1. Add config to `config/entities.yaml`
2. Implement entity-specific transformer (or reuse CityOfChicagoTransformer if structure similar)
3. Run `make all`

### Debug Transformation Issues

**Symptom**: "Could not detect amount column"
**Fix**: Column name pattern changed. Update `detect_amount_column()` in transformer.

**Symptom**: "Department sum does not match total"
**Fix**: Interfund transfers or data issue. Check `interfund_transfer_codes` in config.

**Symptom**: "Subcategory sum mismatch"
**Fix**: Data quality issue. Review raw CSV, check aggregation logic.

## Validation Rules

1. **Schema**: Pydantic enforces types, required fields, constraints (amounts allow negatives for accounting adjustments)
2. **Hierarchical sums**: sum(departments) == total (within $1 tolerance)
3. **Subcategory sums**: sum(subcategories) == department amount
4. **Fund breakdown**: Warning if doesn't match (not error, as funds can overlap)
5. **ID uniqueness**: No duplicate department IDs
6. **Revenue validation**: Source sums, revenue vs appropriations gap, grant transparency
7. **Cross-year consistency**: Flag departments with >50% change (warning, not error)

## Type Safety

**Strict mypy**: All functions typed. Run `make lint` to check.

**Pydantic v2**: Models enforce runtime validation. If Pydantic raises, data is malformed.

**Pattern**: DataFrame in, BudgetData out (transformer returns Pydantic model).

## Testing

**Unit tests**: `tests/test_*.py` (pytest)
**Coverage target**: ≥90% for transformers/validators

**Run tests**: `make test`

**Pattern**:
```python
def test_feature():
    # Arrange: Set up test data
    # Act: Call function
    # Assert: Check result
```

## CLI Commands

```bash
python -m src.cli fetch city-of-chicago --year fy2025
python -m src.cli transform city-of-chicago --year fy2025 --prior-year fy2024
python -m src.cli enrich city-of-chicago   # Add cross-year trends
python -m src.cli validate
python -m src.cli manifest  # Generate manifest.json
python -m src.cli all       # Full pipeline
```

## Gotchas

1. **Socrata column names vary by year**: Transformer detects dynamically
2. **Finance General is special**: Non-adjustable, contains pensions/debt
3. **Acronyms in department names**: OEMC, BACP, etc. must stay uppercase
4. **Rounding**: Use tolerance ($1) for sum validation
5. **Prior year comparison**: Handle departments that don't exist in both years

## Where to Look

**Schema changes**: `src/models/schema.py` (Pydantic models)
**Aggregation logic**: `src/transformers/city_of_chicago.py` (transform method)
**Validation logic**: `src/validators/budget.py`
**Dataset mappings**: `config/entities.yaml`
**Generated JSON**: `output/` (copied to `frontend/src/data`)

## Dependencies

- `pandas`: Data manipulation
- `pydantic`: Schema validation, type safety
- `sodapy`: Socrata API client
- `pytest`: Testing
- `ruff`: Linting and formatting
- `mypy`: Static type checking

## Contact/Issues

If validation fails, check the report. Errors fail the build. Warnings are logged but don't block.

For new entities, follow the pattern in `city_of_chicago.py`. Most logic is reusable.

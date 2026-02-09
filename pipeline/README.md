# Chicago Budget Pipeline

Python data pipeline for extracting, transforming, and validating budget data.

## Overview

The pipeline:
1. **Extracts** data from Socrata API (Chicago Open Data Portal)
2. **Transforms** raw CSV into normalized JSON schema
3. **Validates** data quality (hierarchical sums, cross-year consistency)
4. **Outputs** JSON files for the frontend

## Commands

```bash
make install    # Install dependencies with uv
make fetch      # Fetch data from Socrata API
make transform  # Transform raw data to JSON
make enrich     # Add cross-year trend data
make manifest   # Generate manifest.json
make validate   # Validate transformed data
make all        # Run full pipeline (fetch + transform + enrich + validate + copy)
make clean      # Remove generated files
make test       # Run tests with coverage
make lint       # Run linting (ruff + mypy)
make format     # Format code with ruff
```

## Configuration

### Entity Configuration (`config/entities.yaml`)

Defines entities (City of Chicago, CPS, etc.) and their data sources.

**Key fields:**
- `socrata.datasets` - Maps fiscal years to Socrata dataset IDs
- `transform.*` - Column mappings for transformation
- `transform.acronyms` - Department name acronyms to preserve
- `transform.non_adjustable_departments` - Departments that can't be adjusted in simulator

### Adding a New Fiscal Year

1. Find the dataset ID on data.cityofchicago.org
2. Add to `entities.yaml`:
   ```yaml
   socrata:
     datasets:
       fy2026:
         appropriations: "xxxx-xxxx"  # New dataset ID
   ```
3. Run `make fetch` and `make transform`

### Adding a New Entity

1. Add entity config to `entities.yaml`:
   ```yaml
   chicago-public-schools:
     name: "Chicago Public Schools"
     status: "active"
     socrata:
       domain: "data.cityofchicago.org"
       datasets:
         fy2025:
           appropriations: "xxxx-xxxx"
   ```
2. Implement entity-specific transformer if needed
3. Run pipeline

## Architecture

### Extractors (`src/extractors/`)

**Purpose**: Fetch raw data from sources

- `base.py` - Abstract base class
- `socrata.py` - Socrata API implementation
- `pdf.py` - PDF extraction (future)

**Pattern**: Return pandas DataFrame with raw data

### Transformers (`src/transformers/`)

**Purpose**: Convert raw data to JSON schema

- `base.py` - Abstract base class
- `city_of_chicago.py` - City-specific transformation logic
- `trend_enricher.py` - Cross-year trend enrichment (adds historical trend data to departments)

**Responsibilities:**
- Normalize department names (title-case with acronym preservation)
- Aggregate by department
- Calculate fund breakdowns
- Calculate subcategories (appropriation accounts)
- Categorize and transform revenue data
- Compute year-over-year changes
- Apply simulation constraints

**Pattern**: Input DataFrame → Output `BudgetData` (Pydantic model)

### Validators (`src/validators/`)

**Purpose**: Ensure data quality

- `budget.py` - Hierarchical sum validation, revenue validation, cross-year consistency checks

**Validation checks:**
1. Schema validation (Pydantic models enforce)
2. Hierarchical sums: departments sum to total, subcategories sum to department, fund summaries match
3. Revenue validation: source sums match total, revenue vs appropriations gap check, grant transparency
4. Cross-year consistency: flag departments with >50% change
5. ID uniqueness: no duplicate department IDs

**Pattern**: Fail build on errors, log warnings

### Models (`src/models/`)

**Purpose**: Define JSON schema with Pydantic

- `schema.py` - Complete BudgetData schema
- `manifest.py` - Manifest schema (list of available entities/years)

**Key models:**
- `BudgetData` - Complete budget for one entity for one fiscal year
- `Department` - Single department with amount, fund breakdown, subcategories, trends
- `SimulationConfig` - Simulation constraints per department
- `Metadata` - Entity info, fiscal year, data source, totals (gross/adjustments/total appropriations)
- `Revenue` - Revenue by source and by fund
- `RevenueSource` - Individual revenue source with subcategories and fund breakdown

### CLI (`src/cli.py`)

**Commands:**
- `python -m src.cli fetch <entity> --year <fy>`
- `python -m src.cli transform <entity> --year <fy> --prior-year <fy>`
- `python -m src.cli enrich <entity>` - Add cross-year trends
- `python -m src.cli validate`
- `python -m src.cli manifest` - Generate manifest.json
- `python -m src.cli all` - Run full pipeline

## Testing

**Unit tests** (`tests/test_*.py`):
- `test_extractors.py` - API mocking, column detection
- `test_transformers.py` - Aggregation logic, constraint application, revenue transformation
- `test_validators.py` - Validation error handling
- `test_models.py` - Pydantic schema model tests
- `test_trend_enricher.py` - Cross-year trend enrichment tests

**Run tests:**
```bash
make test
```

**Coverage target**: ≥90% for transformers and validators

## Troubleshooting

**"Could not detect amount column for fy2026"**
- Column name pattern changed. Update `detect_amount_column()` in transformer.

**"Department sum does not match total (off by $X)"**
- Check for interfund transfers. Update `interfund_transfer_codes` in config.

**"Validation failed: Subcategory sum mismatch"**
- Rounding error or data quality issue. Review raw data.

## Development Workflow

1. Make changes to extractor/transformer
2. Run `make format` to format code
3. Run `make lint` to check for issues
4. Run `make test` to verify tests pass
5. Run `make all` to generate new JSON
6. Manually verify output in `output/` directory
7. Commit changes (including generated JSON in `frontend/src/data/`)

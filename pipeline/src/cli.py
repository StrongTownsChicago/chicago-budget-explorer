"""Command-line interface for Chicago Budget Pipeline."""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

import yaml

from .extractors.socrata import SocrataExtractor
from .models.manifest import EntityEntry, Manifest
from .models.schema import BudgetData
from .transformers.city_of_chicago import CityOfChicagoTransformer
from .validators.budget import BudgetValidator


def load_config() -> dict:
    """Load entities configuration from YAML.

    Returns:
        Configuration dictionary
    """
    config_path = Path(__file__).parent.parent / "config" / "entities.yaml"
    with open(config_path) as f:
        return yaml.safe_load(f)


def get_entity_config(entity_id: str) -> dict:
    """Get configuration for a specific entity.

    Args:
        entity_id: Entity identifier (e.g., 'city-of-chicago')

    Returns:
        Entity configuration dictionary

    Raises:
        ValueError: If entity not found in config
    """
    config = load_config()
    if entity_id not in config["entities"]:
        available = list(config["entities"].keys())
        raise ValueError(
            f"Entity '{entity_id}' not found in config. Available: {', '.join(available)}"
        )

    entity_config = config["entities"][entity_id].copy()
    entity_config["id"] = entity_id
    return entity_config


def fetch_command(args: argparse.Namespace) -> int:
    """Fetch raw data from source.

    Args:
        args: Parsed command-line arguments

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    try:
        print(f"Fetching {args.entity} data for {args.year}...")

        entity_config = get_entity_config(args.entity)
        extractor = SocrataExtractor(entity_config)

        df = extractor.extract(args.year)

        # Save raw data
        output_dir = Path("output") / args.entity / "raw"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / f"{args.year}.csv"

        df.to_csv(output_file, index=False)
        print(f"✅ Saved raw data to {output_file} ({len(df)} rows)")

        return 0

    except Exception as e:
        print(f"❌ Error fetching data: {e}", file=sys.stderr)
        return 1


def transform_command(args: argparse.Namespace) -> int:
    """Transform raw data to JSON schema.

    Args:
        args: Parsed command-line arguments

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    try:
        print(f"Transforming {args.entity} data for {args.year}...")

        entity_config = get_entity_config(args.entity)

        # Load raw data (fetch if needed)
        raw_file = Path("output") / args.entity / "raw" / f"{args.year}.csv"
        if not raw_file.exists():
            print("Raw data not found, fetching...")
            extractor = SocrataExtractor(entity_config)
            df = extractor.extract(args.year)
        else:
            import pandas as pd

            df = pd.read_csv(raw_file)

        # Load prior year data if requested
        prior_df = None
        if args.prior_year:
            prior_raw_file = Path("output") / args.entity / "raw" / f"{args.prior_year}.csv"
            if prior_raw_file.exists():
                import pandas as pd

                prior_df = pd.read_csv(prior_raw_file)
            else:
                print(f"Warning: Prior year {args.prior_year} not found, skipping comparison")

        # Transform
        transformer = CityOfChicagoTransformer(entity_config)
        budget_data = transformer.transform(df, args.year, prior_df)

        # Validate
        validator = BudgetValidator()
        if not validator.validate(budget_data):
            print("\n⚠️  Validation warnings/errors:")
            print(validator.get_report())
            if validator.errors:
                print("\n❌ Validation failed with errors. Fix issues before proceeding.")
                return 1

        if validator.warnings:
            print("\n⚠️  Validation warnings:")
            print(validator.get_report())

        # Save JSON
        output_dir = Path("output") / args.entity
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / f"{args.year}.json"

        with open(output_file, "w") as f:
            json.dump(budget_data.model_dump(mode="json"), f, indent=2, default=str)

        print(f"\n✅ Saved transformed data to {output_file}")
        print(f"   Total appropriations: ${budget_data.metadata.total_appropriations:,}")
        print(f"   Departments: {len(budget_data.appropriations.by_department)}")

        return 0

    except Exception as e:
        print(f"❌ Error transforming data: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        return 1


def validate_command(args: argparse.Namespace) -> int:
    """Validate all generated JSON files.

    Args:
        args: Parsed command-line arguments

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    try:
        print("Validating all generated JSON files...")

        output_dir = Path("output")
        json_files = list(output_dir.glob("**/fy*.json"))

        if not json_files:
            print("No JSON files found to validate")
            return 0

        all_valid = True
        for json_file in json_files:
            print(f"\nValidating {json_file}...")

            with open(json_file) as f:
                data_dict = json.load(f)

            # Parse with Pydantic (validates schema)
            budget_data = BudgetData(**data_dict)

            # Run additional validation
            validator = BudgetValidator()
            if not validator.validate(budget_data):
                print(validator.get_report())
                if validator.errors:
                    all_valid = False

        if all_valid:
            print(f"\n✅ All {len(json_files)} files validated successfully")
            return 0
        else:
            print("\n❌ Some files failed validation")
            return 1

    except Exception as e:
        print(f"❌ Error validating: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        return 1


def generate_manifest(args: argparse.Namespace) -> int:
    """Generate manifest.json listing all available entities and years.

    Args:
        args: Parsed command-line arguments

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    try:
        print("Generating manifest...")

        config = load_config()
        output_dir = Path("output")

        entities: list[EntityEntry] = []

        for entity_id, entity_config in config["entities"].items():
            # Check which years have generated JSON
            entity_output_dir = output_dir / entity_id
            available_years = []

            if entity_output_dir.exists():
                json_files = list(entity_output_dir.glob("fy*.json"))
                available_years = [f.stem for f in json_files]
                available_years.sort(reverse=True)

            # Get default year (from config or latest available)
            default_year = entity_config.get("default_year", "fy2025")
            if available_years and default_year not in available_years:
                default_year = available_years[0]

            entities.append(
                EntityEntry(
                    id=entity_id,
                    name=entity_config["name"],
                    entity_type=entity_config.get("entity_type", "unknown"),
                    status=entity_config.get("status", "coming_soon"),
                    default_year=default_year,
                    available_years=available_years,
                    property_tax_share_pct=entity_config.get("property_tax_share_pct", 0),
                    color=entity_config.get("color", "#000000"),
                )
            )

        manifest = Manifest(
            entities=entities,
            last_updated=datetime.now().isoformat(),
            pipeline_version="1.0.0",
        )

        manifest_file = output_dir / "manifest.json"
        with open(manifest_file, "w") as f:
            json.dump(manifest.model_dump(mode="json"), f, indent=2)

        print(f"✅ Generated {manifest_file}")
        print(f"   Entities: {len(entities)}")
        print(f"   Active: {sum(1 for e in entities if e.status == 'active')}")

        return 0

    except Exception as e:
        print(f"❌ Error generating manifest: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        return 1


def all_command(args: argparse.Namespace) -> int:
    """Run full pipeline for all active entities.

    Args:
        args: Parsed command-line arguments

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    print("=== Running Full Pipeline ===\n")

    config = load_config()

    # Only process active entities
    active_entities = [
        (entity_id, entity_config)
        for entity_id, entity_config in config["entities"].items()
        if entity_config.get("status") == "active"
    ]

    if not active_entities:
        print("No active entities found")
        return 1

    for entity_id, entity_config in active_entities:
        print(f"\n=== Processing {entity_id} ===")

        # Get available years from config
        datasets = entity_config.get("socrata", {}).get("datasets", {})
        years = list(datasets.keys())
        years.sort(reverse=True)  # Newest first

        # Fetch all years
        for year in years:
            fetch_args = argparse.Namespace(entity=entity_id, year=year)
            if fetch_command(fetch_args) != 0:
                return 1

        # Transform all years (with prior year comparison)
        for i, year in enumerate(years):
            prior_year = years[i + 1] if i + 1 < len(years) else None
            transform_args = argparse.Namespace(entity=entity_id, year=year, prior_year=prior_year)
            if transform_command(transform_args) != 0:
                return 1

    # Generate manifest
    manifest_args = argparse.Namespace()
    if generate_manifest(manifest_args) != 0:
        return 1

    # Validate all
    validate_args = argparse.Namespace()
    if validate_command(validate_args) != 0:
        return 1

    print("\n✅ Pipeline complete!")
    return 0


def main() -> int:
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Chicago Budget Pipeline - Extract, transform, and validate budget data"
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Fetch command
    fetch_parser = subparsers.add_parser("fetch", help="Fetch raw data from source")
    fetch_parser.add_argument("entity", help="Entity ID (e.g., city-of-chicago)")
    fetch_parser.add_argument("--year", required=True, help="Fiscal year (e.g., fy2025)")

    # Transform command
    transform_parser = subparsers.add_parser("transform", help="Transform raw data to JSON")
    transform_parser.add_argument("entity", help="Entity ID")
    transform_parser.add_argument("--year", required=True, help="Fiscal year")
    transform_parser.add_argument(
        "--prior-year", help="Prior fiscal year for year-over-year comparison"
    )

    # Validate command
    subparsers.add_parser("validate", help="Validate all generated JSON files")

    # Generate manifest command
    subparsers.add_parser("manifest", help="Generate manifest.json")

    # All command (full pipeline)
    subparsers.add_parser("all", help="Run full pipeline for all active entities")

    args = parser.parse_args()

    if args.command == "fetch":
        return fetch_command(args)
    elif args.command == "transform":
        return transform_command(args)
    elif args.command == "validate":
        return validate_command(args)
    elif args.command == "manifest":
        return generate_manifest(args)
    elif args.command == "all":
        return all_command(args)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())

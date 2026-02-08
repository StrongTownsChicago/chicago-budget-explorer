"""Socrata API extractor for Chicago Open Data Portal."""

from typing import Any

import pandas as pd
from sodapy import Socrata

from .base import BaseExtractor


class SocrataExtractor(BaseExtractor):
    """Extractor for Socrata Open Data API.

    Fetches budget data from Chicago's data portal (data.cityofchicago.org).
    """

    def __init__(self, config: dict[str, Any]) -> None:
        """Initialize Socrata extractor.

        Args:
            config: Entity configuration with 'socrata' section
        """
        super().__init__(config)

        if "socrata" not in config:
            raise ValueError("Config must include 'socrata' section")

        self.domain = config["socrata"]["domain"]
        self.datasets = config["socrata"]["datasets"]
        self.client: Socrata | None = None

    def _get_client(self) -> Socrata:
        """Get or create Socrata client (lazy initialization)."""
        if self.client is None:
            # No authentication needed for Chicago's public data
            # If rate limits become an issue, can add app_token here
            self.client = Socrata(self.domain, None)
        return self.client

    def extract(
        self, fiscal_year: str, dataset_type: str = "appropriations", **kwargs: Any
    ) -> pd.DataFrame:
        """Extract budget data from Socrata API.

        Args:
            fiscal_year: Fiscal year (e.g., 'fy2025')
            dataset_type: Type of dataset ('appropriations' or 'revenue')
            **kwargs: Additional arguments (unused)

        Returns:
            DataFrame with raw Socrata data

        Raises:
            ValueError: If fiscal year not in config or dataset type not available
        """
        if fiscal_year not in self.datasets:
            available = list(self.datasets.keys())
            raise ValueError(
                f"Fiscal year '{fiscal_year}' not configured. "
                f"Available years: {', '.join(available)}"
            )

        year_config = self.datasets[fiscal_year]

        if dataset_type not in year_config:
            available_types = list(year_config.keys())
            raise ValueError(
                f"Dataset type '{dataset_type}' not available for {fiscal_year}. "
                f"Available types: {', '.join(available_types)}"
            )

        dataset_id = year_config[dataset_type]
        client = self._get_client()

        # Fetch data with high limit to avoid pagination issues
        # Socrata default is 1000 rows, but budgets have 5000-8000 rows
        # Set limit to 50000 to be safe
        results = client.get(dataset_id, limit=50000)

        # Convert to DataFrame
        df = pd.DataFrame.from_records(results)

        # Normalize column names to lowercase for consistency
        df.columns = df.columns.str.lower()

        return df

    def extract_all(self, fiscal_year: str) -> dict[str, pd.DataFrame]:
        """Extract all available datasets for a fiscal year.

        Args:
            fiscal_year: Fiscal year (e.g., 'fy2025')

        Returns:
            Dictionary mapping dataset type to DataFrame.
            Example: {"appropriations": df1, "revenue": df2}

        Raises:
            ValueError: If fiscal year not configured
        """
        if fiscal_year not in self.datasets:
            available = list(self.datasets.keys())
            raise ValueError(
                f"Fiscal year '{fiscal_year}' not configured. "
                f"Available years: {', '.join(available)}"
            )

        year_config = self.datasets[fiscal_year]
        result: dict[str, pd.DataFrame] = {}

        for dataset_type in year_config:
            result[dataset_type] = self.extract(fiscal_year, dataset_type)

        return result

    def available_years(self) -> list[str]:
        """Get list of available fiscal years from config.

        Returns:
            Sorted list of fiscal years (descending, newest first)
        """
        years = list(self.datasets.keys())
        # Sort descending (fy2025, fy2024, fy2023, ...)
        years.sort(reverse=True)
        return years

    def __del__(self) -> None:
        """Close Socrata client on cleanup."""
        if hasattr(self, "client") and self.client is not None:
            self.client.close()

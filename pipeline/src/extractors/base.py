"""Abstract base extractor for data sources."""

from abc import ABC, abstractmethod
from typing import Any

import pandas as pd


class BaseExtractor(ABC):
    """Abstract base class for data extractors.

    Extractors are responsible for fetching raw data from various sources
    (Socrata API, PDFs, manual CSV files, etc.) and returning it as a pandas DataFrame.
    """

    def __init__(self, config: dict[str, Any]) -> None:
        """Initialize extractor with configuration.

        Args:
            config: Entity configuration dictionary from entities.yaml
        """
        self.config = config

    @abstractmethod
    def extract(self, fiscal_year: str, **kwargs: Any) -> pd.DataFrame:
        """Extract raw budget data for a given fiscal year.

        Args:
            fiscal_year: Fiscal year identifier (e.g., 'fy2025')
            **kwargs: Additional extractor-specific arguments

        Returns:
            DataFrame with raw budget data

        Raises:
            ValueError: If fiscal year not available or extraction fails
        """
        pass

    @abstractmethod
    def available_years(self) -> list[str]:
        """Get list of available fiscal years.

        Returns:
            List of fiscal year identifiers (e.g., ['fy2025', 'fy2024'])
        """
        pass

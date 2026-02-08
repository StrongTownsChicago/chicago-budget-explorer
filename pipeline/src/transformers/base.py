"""Abstract base transformer for entity-specific transformations."""

from abc import ABC, abstractmethod
from typing import Any, Optional

import pandas as pd

from ..models.schema import BudgetData


class BaseTransformer(ABC):
    """Abstract base class for budget data transformers.

    Transformers convert raw data (DataFrames) into the standardized BudgetData schema.
    Each entity may have different column names, data structures, and business rules,
    so transformers encapsulate entity-specific logic.
    """

    def __init__(self, config: dict[str, Any]) -> None:
        """Initialize transformer with configuration.

        Args:
            config: Entity configuration dictionary from entities.yaml
        """
        self.config = config

    @abstractmethod
    def transform(
        self,
        df: pd.DataFrame,
        fiscal_year: str,
        prior_df: Optional[pd.DataFrame] = None,
    ) -> BudgetData:
        """Transform raw DataFrame to BudgetData schema.

        Args:
            df: Raw data DataFrame from extractor
            fiscal_year: Fiscal year identifier (e.g., 'fy2025')
            prior_df: Optional prior year DataFrame for year-over-year comparison

        Returns:
            Complete BudgetData model

        Raises:
            ValueError: If transformation fails due to data quality issues
        """
        pass

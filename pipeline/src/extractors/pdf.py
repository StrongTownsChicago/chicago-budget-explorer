"""PDF extractor for entities without Socrata data (future implementation).

This is a stub for v1. PDF extraction will be implemented in v3+
for entities like CPS, Park District, CTA that don't publish structured data.

Planned approach:
- pdfplumber for deterministic table extraction
- Claude API (via Anthropic SDK) for cleanup and validation
- instructor library for retry-on-validation-failure
"""

from typing import Any

import pandas as pd

from .base import BaseExtractor


class PDFExtractor(BaseExtractor):
    """PDF extractor (not implemented yet)."""

    def extract(self, fiscal_year: str, **kwargs: Any) -> pd.DataFrame:
        """Extract budget data from PDF (not implemented).

        Args:
            fiscal_year: Fiscal year
            **kwargs: PDF path, etc.

        Raises:
            NotImplementedError: Always (v1 stub)
        """
        raise NotImplementedError("PDF extraction will be implemented in v3+")

    def available_years(self) -> list[str]:
        """Get available years (not implemented).

        Returns:
            Empty list (no years available yet)
        """
        return []

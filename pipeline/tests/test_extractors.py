"""Tests for extractors."""

from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from src.extractors.socrata import SocrataExtractor


class TestSocrataExtractor:
    """Tests for SocrataExtractor."""

    @pytest.fixture
    def config(self):
        """Create test configuration."""
        return {
            "id": "city-of-chicago",
            "name": "City of Chicago",
            "socrata": {
                "domain": "data.cityofchicago.org",
                "datasets": {
                    "fy2025": {"appropriations": "test-2025", "revenue": "rev-2025"},
                    "fy2024": {"appropriations": "test-2024"},
                },
            },
        }

    def test_init_requires_socrata_config(self):
        """Test that initialization fails without socrata config."""
        with pytest.raises(ValueError, match="must include 'socrata' section"):
            SocrataExtractor({"id": "test"})

    def test_init_success(self, config):
        """Test successful initialization."""
        extractor = SocrataExtractor(config)
        assert extractor.domain == "data.cityofchicago.org"
        assert "fy2025" in extractor.datasets
        assert extractor.client is None  # Lazy initialization

    @patch("src.extractors.socrata.Socrata")
    def test_extract_success(self, mock_socrata_class, config):
        """Test successful data extraction."""
        # Mock Socrata client
        mock_client = MagicMock()
        mock_client.get.return_value = [
            {
                "DEPARTMENT_NAME": "POLICE",
                "FUND_DESCRIPTION": "Corporate Fund",
                "APPROPRIATION_AMOUNT": "1000000",
            },
            {
                "DEPARTMENT_NAME": "FIRE",
                "FUND_DESCRIPTION": "Corporate Fund",
                "APPROPRIATION_AMOUNT": "500000",
            },
        ]
        mock_socrata_class.return_value = mock_client

        extractor = SocrataExtractor(config)
        df = extractor.extract("fy2025")

        # Verify Socrata client called correctly
        mock_socrata_class.assert_called_once_with("data.cityofchicago.org", None)
        mock_client.get.assert_called_once_with("test-2025", limit=50000)

        # Verify DataFrame
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 2
        # Column names should be lowercased
        assert "department_name" in df.columns
        assert "fund_description" in df.columns

    def test_extract_invalid_year(self, config):
        """Test extraction with invalid fiscal year."""
        extractor = SocrataExtractor(config)

        with pytest.raises(ValueError, match="Fiscal year 'fy2099' not configured"):
            extractor.extract("fy2099")

    def test_available_years(self, config):
        """Test getting available years."""
        extractor = SocrataExtractor(config)
        years = extractor.available_years()

        assert years == ["fy2025", "fy2024"]  # Sorted descending
        assert isinstance(years, list)

    @patch("src.extractors.socrata.Socrata")
    def test_client_lazy_initialization(self, mock_socrata_class, config):
        """Test that Socrata client is created lazily."""
        extractor = SocrataExtractor(config)
        assert extractor.client is None

        # Trigger client creation
        mock_client = MagicMock()
        mock_socrata_class.return_value = mock_client
        client = extractor._get_client()

        assert client is not None
        assert extractor.client is client
        mock_socrata_class.assert_called_once()

    @patch("src.extractors.socrata.Socrata")
    def test_client_reused(self, mock_socrata_class, config):
        """Test that client is reused after first call."""
        mock_client = MagicMock()
        mock_socrata_class.return_value = mock_client

        extractor = SocrataExtractor(config)
        client1 = extractor._get_client()
        client2 = extractor._get_client()

        assert client1 is client2
        # Socrata should only be called once
        assert mock_socrata_class.call_count == 1

    @patch("src.extractors.socrata.Socrata")
    def test_cleanup_closes_client(self, mock_socrata_class, config):
        """Test that client is closed on cleanup."""
        mock_client = MagicMock()
        mock_socrata_class.return_value = mock_client

        extractor = SocrataExtractor(config)
        extractor._get_client()

        # Trigger cleanup
        extractor.__del__()

        mock_client.close.assert_called_once()

    @patch("src.extractors.socrata.Socrata")
    def test_extract_revenue_dataset(self, mock_socrata_class, config):
        """Test extracting revenue data with dataset_type parameter."""
        mock_client = MagicMock()
        mock_client.get.return_value = [
            {
                "REVENUE_SOURCE": "Property Tax",
                "FUND_DESCRIPTION": "Corporate Fund",
                "REVENUE_AMOUNT": "500000",
            },
        ]
        mock_socrata_class.return_value = mock_client

        extractor = SocrataExtractor(config)
        df = extractor.extract("fy2025", dataset_type="revenue")

        # Should use revenue dataset ID
        mock_client.get.assert_called_once_with("rev-2025", limit=50000)
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 1
        assert "revenue_source" in df.columns

    def test_extract_missing_dataset_type(self, config):
        """Test error when dataset type not configured for a fiscal year."""
        extractor = SocrataExtractor(config)

        # fy2024 only has appropriations, not revenue
        with pytest.raises(ValueError, match="Dataset type 'revenue' not available"):
            extractor.extract("fy2024", dataset_type="revenue")

    @patch("src.extractors.socrata.Socrata")
    def test_extract_all(self, mock_socrata_class, config):
        """Test extracting all datasets for a fiscal year."""
        mock_client = MagicMock()
        mock_client.get.side_effect = [
            # First call: appropriations
            [{"DEPARTMENT_NAME": "POLICE", "APPROPRIATION_AMOUNT": "1000000"}],
            # Second call: revenue
            [{"REVENUE_SOURCE": "Property Tax", "REVENUE_AMOUNT": "500000"}],
        ]
        mock_socrata_class.return_value = mock_client

        extractor = SocrataExtractor(config)
        result = extractor.extract_all("fy2025")

        # Should return both datasets
        assert "appropriations" in result
        assert "revenue" in result
        assert isinstance(result["appropriations"], pd.DataFrame)
        assert isinstance(result["revenue"], pd.DataFrame)
        assert mock_client.get.call_count == 2

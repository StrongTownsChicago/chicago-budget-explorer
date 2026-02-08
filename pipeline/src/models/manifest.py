"""Manifest model for listing available entities and fiscal years."""

from typing import Literal

from pydantic import BaseModel, Field


class EntityEntry(BaseModel):
    """Single entity entry in the manifest."""

    id: str = Field(..., description="Entity identifier (e.g., 'city-of-chicago')")
    name: str = Field(..., description="Human-readable entity name")
    entity_type: str = Field(..., description="Type (e.g., 'city', 'school_district')")
    status: Literal["active", "coming_soon", "hidden"] = Field(..., description="Entity status")
    default_year: str = Field(..., description="Default fiscal year to display (e.g., 'fy2025')")
    available_years: list[str] = Field(..., description="List of available fiscal years")
    property_tax_share_pct: float = Field(
        ..., description="Percentage of property tax bill (for context)"
    )
    color: str = Field(..., description="Brand color for this entity (hex code)")


class Manifest(BaseModel):
    """Manifest listing all available entities and fiscal years."""

    entities: list[EntityEntry] = Field(..., description="List of all entities")
    last_updated: str = Field(..., description="ISO 8601 timestamp of last update")
    pipeline_version: str = Field(..., description="Pipeline version that generated this manifest")

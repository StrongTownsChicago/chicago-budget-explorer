/**
 * Data loading utilities for Chicago Budget Explorer.
 *
 * Handles loading budget data and manifest from static JSON files.
 */

import type { BudgetData, Manifest, EntityEntry, Department } from "./types";
import manifestData from "../data/manifest.json";

/**
 * Get the manifest listing all entities and available years.
 *
 * @returns Manifest object
 */
export function getManifest(): Manifest {
  return manifestData as Manifest;
}

/**
 * Get all active entities (status === "active").
 *
 * @returns List of active entity entries
 */
export function getActiveEntities(): EntityEntry[] {
  const manifest = getManifest();
  return manifest.entities.filter((e) => e.status === "active");
}

/**
 * Get all visible entities (status !== "hidden").
 *
 * @returns List of visible entity entries (active + coming_soon)
 */
export function getAllVisibleEntities(): EntityEntry[] {
  const manifest = getManifest();
  return manifest.entities.filter((e) => e.status !== "hidden");
}

/**
 * Load budget data for a specific entity and fiscal year.
 *
 * Uses dynamic imports for code-splitting.
 *
 * @param entityId - Entity identifier (e.g., "city-of-chicago")
 * @param fiscalYear - Fiscal year (e.g., "fy2025")
 * @returns Promise resolving to BudgetData
 */
export async function loadBudgetData(
  entityId: string,
  fiscalYear: string
): Promise<BudgetData> {
  try {
    // Dynamic import for code-splitting (loads only when needed)
    const module = await import(`../data/${entityId}/${fiscalYear}.json`);
    return module.default as BudgetData;
  } catch (error) {
    throw new Error(
      `Failed to load budget data for ${entityId} ${fiscalYear}: ${error}`
    );
  }
}

/**
 * Find a department by ID within a BudgetData object.
 *
 * @param data - BudgetData to search
 * @param departmentId - Department ID to find
 * @returns Department if found, undefined otherwise
 */
export function getDepartmentById(
  data: BudgetData,
  departmentId: string
): Department | undefined {
  return data.appropriations.by_department.find((d) => d.id === departmentId);
}

/**
 * Get total budget amount from BudgetData.
 *
 * @param data - BudgetData
 * @returns Total appropriations
 */
export function getTotalBudget(data: BudgetData): number {
  return data.metadata.total_appropriations;
}

/**
 * Get entity entry from manifest by ID.
 *
 * @param entityId - Entity ID
 * @returns EntityEntry if found, undefined otherwise
 */
export function getEntityById(entityId: string): EntityEntry | undefined {
  const manifest = getManifest();
  return manifest.entities.find((e) => e.id === entityId);
}

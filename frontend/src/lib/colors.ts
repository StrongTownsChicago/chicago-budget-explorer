/**
 * Color palette for Chicago Budget Explorer.
 */

export const CHICAGO_COLORS = {
  // Chicago flag colors
  blue: "#0051A5",
  red: "#CE1126",
  lightBlue: "#6CACE4",
  white: "#FFFFFF",

  // Budget categories (for charts)
  categories: [
    "#0051A5", // Chicago blue
    "#CE1126", // Chicago red
    "#2E7D32", // Green (parks)
    "#FF6F00", // Orange (education)
    "#5E35B1", // Purple (public safety)
    "#00897B", // Teal (infrastructure)
    "#C62828", // Dark red
    "#6A1B9A", // Dark purple
  ],
} as const;

/**
 * Get color for a department by index.
 *
 * @param index - Department index (0-based)
 * @returns Hex color code
 */
export function getDepartmentColor(index: number): string {
  return CHICAGO_COLORS.categories[index % CHICAGO_COLORS.categories.length]!;
}

/**
 * Get color for budget delta (surplus/deficit).
 *
 * @param delta - Dollar amount (positive = over, negative = under)
 * @returns Color class name for Tailwind
 */
export function getDeltaColor(delta: number): string {
  if (Math.abs(delta) < 1000) {
    return "text-green-600"; // Balanced
  }
  return delta > 0 ? "text-red-600" : "text-yellow-600";
}

/**
 * Get background color for budget delta.
 *
 * @param delta - Dollar amount
 * @returns Background color class name for Tailwind
 */
export function getDeltaBackground(delta: number): string {
  if (Math.abs(delta) < 1000) {
    return "bg-green-50 border-green-500";
  }
  return delta > 0 ? "bg-red-50 border-red-500" : "bg-yellow-50 border-yellow-500";
}

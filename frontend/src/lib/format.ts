/**
 * Formatting utilities for displaying currency, percentages, and numbers.
 */

/**
 * Format a dollar amount with proper suffixes (K, M, B).
 *
 * @param amount - Dollar amount
 * @param showCents - Whether to show cents (default: false)
 * @returns Formatted string (e.g., "$1.2B", "$123,456")
 */
export function formatCurrency(
  amount: number,
  showCents: boolean = false
): string {
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  // Billions
  if (absAmount >= 1_000_000_000) {
    const billions = absAmount / 1_000_000_000;
    return `${sign}$${billions.toFixed(1)}B`;
  }

  // Millions
  if (absAmount >= 1_000_000) {
    const millions = absAmount / 1_000_000;
    return `${sign}$${millions.toFixed(1)}M`;
  }

  // Thousands (optional, usually we show full number for smaller amounts)
  if (absAmount >= 10_000) {
    return `${sign}$${Math.round(absAmount).toLocaleString()}`;
  }

  // Small amounts
  if (showCents) {
    return `${sign}$${absAmount.toFixed(2)}`;
  }

  return `${sign}$${Math.round(absAmount).toLocaleString()}`;
}

/**
 * Format a percentage with sign and decimal places.
 *
 * @param value - Percentage value (e.g., 5.5 for 5.5%)
 * @param decimals - Number of decimal places (default: 1)
 * @param includeSign - Whether to include + for positive (default: true)
 * @returns Formatted string (e.g., "+5.5%", "-2.1%")
 */
export function formatPercent(
  value: number,
  decimals: number = 1,
  includeSign: boolean = true
): string {
  const sign = includeSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format a change between two values (amount + percentage).
 *
 * @param current - Current value
 * @param prior - Prior value
 * @returns Formatted string (e.g., "+$100M (+10.2%)")
 */
export function formatChange(current: number, prior: number): string {
  const delta = current - prior;
  const pct = prior !== 0 ? (delta / prior) * 100 : 0;

  const deltaStr = formatCompact(Math.abs(delta));
  const pctStr = formatPercent(Math.abs(pct), 1, false);

  if (delta > 0) {
    return `+${deltaStr} (+${pctStr})`;
  } else if (delta < 0) {
    return `-${deltaStr} (-${pctStr})`;
  } else {
    return `$0 (0.0%)`;
  }
}

/**
 * Format a number compactly with K/M/B suffixes.
 *
 * Similar to formatCurrency but without dollar sign.
 *
 * @param amount - Number to format
 * @returns Formatted string (e.g., "1.2B", "45M", "123K")
 */
export function formatCompact(amount: number): string {
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (absAmount >= 1_000_000_000) {
    return `${sign}$${(absAmount / 1_000_000_000).toFixed(1)}B`;
  }

  if (absAmount >= 1_000_000) {
    return `${sign}$${(absAmount / 1_000_000).toFixed(1)}M`;
  }

  if (absAmount >= 1_000) {
    return `${sign}$${Math.round(absAmount / 1_000)}K`;
  }

  return `${sign}$${Math.round(absAmount)}`;
}

/**
 * Format a large number with commas.
 *
 * @param value - Number to format
 * @returns Formatted string (e.g., "1,234,567")
 */
export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

/**
 * Format a date string (ISO) to readable format.
 *
 * @param isoDate - ISO date string
 * @returns Formatted date (e.g., "Jan 1, 2025")
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

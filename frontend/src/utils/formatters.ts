/**
 * Centralized Display-Only Numeric Value Formatters for Rakshak Frontend.
 *
 * Rules:
 * - Floating point/decimal values (scores, risks, rates, averages, percentages): 2 decimal places.
 * - Counts, quantities, IDs: integer representation.
 * - Handles null, undefined, NaN, Infinity gracefully without crashing or rendering artifacts.
 */

/**
 * Format any numeric or decimal value to a fixed number of decimal places (default 2).
 * Examples:
 *   formatNumber(28.959999999) -> "28.96"
 *   formatNumber(58.439999999) -> "58.44"
 *   formatNumber(100) -> "100.00"
 *   formatNumber(0) -> "0.00"
 *   formatNumber(null) -> "0.00"
 */
export function formatNumber(
  value: number | string | null | undefined,
  decimals: number = 2,
  fallback: string = '0.00'
): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }

  return num.toFixed(decimals);
}

/**
 * Specialized formatter for Security Health Scores, Risk Scores, and CVSS scores.
 * Always renders exactly 2 decimal places.
 * Examples:
 *   formatScore(28.959999999) -> "28.96"
 *   formatScore(98) -> "98.00"
 *   formatScore(100) -> "100.00"
 */
export function formatScore(
  value: number | string | null | undefined,
  decimals: number = 2,
  fallback: string = '0.00'
): string {
  return formatNumber(value, decimals, fallback);
}

/**
 * Specialized formatter for percentages.
 * Examples:
 *   formatPercentage(98.123456) -> "98.12%"
 *   formatPercentage(75) -> "75.00%"
 *   formatPercentage(75, 2, false) -> "75.00"
 */
export function formatPercentage(
  value: number | string | null | undefined,
  decimals: number = 2,
  includeSymbol: boolean = true,
  fallback: string = '0.00%'
): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }

  const formatted = num.toFixed(decimals);
  return includeSymbol ? `${formatted}%` : formatted;
}

/**
 * Specialized formatter for integer counts (findings count, vulnerabilities count, unread count).
 * Preserves integer representation without trailing zeros.
 * Examples:
 *   formatCount(25) -> "25"
 *   formatCount(3.0) -> "3"
 *   formatCount(null) -> "0"
 */
export function formatCount(
  value: number | string | null | undefined,
  fallback: string = '0'
): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }

  return Math.round(num).toString();
}

/**
 * Formats duration measurements in seconds with 2 decimal places.
 * Examples:
 *   formatDuration(1.2345) -> "1.23s"
 *   formatDuration(0) -> "0.00s"
 */
export function formatDuration(
  value: number | string | null | undefined,
  decimals: number = 2,
  fallback: string = '0.00s'
): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }

  return `${num.toFixed(decimals)}s`;
}

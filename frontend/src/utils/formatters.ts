/**
 * Centralized Display-Only Numeric Value Formatters for Rakshak Frontend.
 *
 * Rules:
 * - Floating point/decimal values (scores, risks, rates, averages, percentages): maximum 2 decimal places.
 * - Do NOT force trailing zeroes (e.g. 100 -> "100", 29.3 -> "29.3", 28.959999999 -> "28.96").
 * - Counts, quantities, IDs: integer representation (e.g. 25 -> "25", 0 -> "0").
 * - Handles null, undefined, NaN, Infinity gracefully without crashing or rendering artifacts.
 */

/**
 * Format any numeric or decimal value up to a maximum number of decimal places (default 2),
 * omitting unnecessary trailing zeros.
 * Examples:
 *   formatNumber(100) -> "100"
 *   formatNumber(98) -> "98"
 *   formatNumber(29.35) -> "29.35"
 *   formatNumber(29.30) -> "29.3"
 *   formatNumber(28.959999999) -> "28.96"
 *   formatNumber(57.99999999999999) -> "58"
 *   formatNumber(0) -> "0"
 *   formatNumber(null) -> "0"
 */
export function formatNumber(
  value: number | string | null | undefined,
  maxDecimals: number = 2,
  fallback: string = '0'
): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
    useGrouping: false,
  }).format(num);
}

/**
 * Specialized formatter for Security Health Scores, Risk Scores, and CVSS scores.
 * Rounds to at most 2 decimal places and strips trailing zeros.
 * Examples:
 *   formatScore(100) -> "100"
 *   formatScore(98) -> "98"
 *   formatScore(29.35) -> "29.35"
 *   formatScore(29.3) -> "29.3"
 *   formatScore(28.959999999) -> "28.96"
 *   formatScore(57.99999999999999) -> "58"
 */
export function formatScore(
  value: number | string | null | undefined,
  maxDecimals: number = 2,
  fallback: string = '0'
): string {
  return formatNumber(value, maxDecimals, fallback);
}

/**
 * Specialized formatter for percentages.
 * Examples:
 *   formatPercentage(98.123456) -> "98.12%"
 *   formatPercentage(75) -> "75%"
 *   formatPercentage(100) -> "100%"
 *   formatPercentage(75, 2, false) -> "75"
 */
export function formatPercentage(
  value: number | string | null | undefined,
  maxDecimals: number = 2,
  includeSymbol: boolean = true,
  fallback: string = '0%'
): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }

  const formatted = formatNumber(num, maxDecimals, '0');
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
 * Formats duration measurements in seconds with up to 2 decimal places.
 * Examples:
 *   formatDuration(1.2345) -> "1.23s"
 *   formatDuration(2) -> "2s"
 *   formatDuration(0) -> "0s"
 */
export function formatDuration(
  value: number | string | null | undefined,
  maxDecimals: number = 2,
  fallback: string = '0s'
): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }

  const formatted = formatNumber(num, maxDecimals, '0');
  return `${formatted}s`;
}

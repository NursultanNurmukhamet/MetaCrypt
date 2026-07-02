/** Small presentation helpers used across the UI. */

/** 1234567 → "1.18 MB" (binary units, 2 significant decimals). */
export function formatBytes(size: number): string {
  if (size === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log2(size) / 10), units.length - 1);
  const value = size / 2 ** (10 * i);
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(2)} ${units[i]}`;
}

/** ISO / EXIF datetime → localized human string; falls back to raw input. */
export function formatDate(value: string, locale: string): string {
  // EXIF dates look like "2024:05:01 13:37:00" — normalize to ISO first.
  const normalized = value.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Truncate long metadata values for table cells (full value in tooltip). */
export function truncateMiddle(s: string, max = 80): string {
  if (s.length <= max) return s;
  const half = Math.floor((max - 1) / 2);
  return `${s.slice(0, half)}…${s.slice(-half)}`;
}

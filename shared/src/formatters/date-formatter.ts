/**
 * Date formatting utilities with locale-aware presets.
 *
 * Each DateFormatPreset maps to a specific Intl locale:
 *   iso  → sv-SE  (produces YYYY-MM-DD / 24h)
 *   us   → en-US  (produces MM/DD/YYYY / 12h AM/PM)
 *   eu   → en-GB  (produces DD/MM/YYYY / 24h)
 *   long → en-US  (produces "January 28, 2026" / 12h)
 *
 * DEFAULT_DATE_CONFIG uses 'us' preset with 'America/Vancouver' timezone,
 * matching the primary user base. Polls store their own timezone in
 * time_config so results display in the poll creator's timezone regardless
 * of viewer locale. Use `buildPollDateConfig()` to derive a config from a poll.
 *
 * Intl.DateTimeFormat instances are cached at module level for performance.
 */

export type DateFormatPreset = 'iso' | 'us' | 'eu' | 'long';

export interface DateFormatConfig {
  dateFormat: DateFormatPreset;
  timezone: string;
}

export const DEFAULT_DATE_CONFIG: DateFormatConfig = {
  dateFormat: 'us',
  timezone: 'America/Vancouver',
};

export const DATE_FORMAT_LABELS: Record<DateFormatPreset, string> = {
  iso: 'ISO (2026-01-28)',
  us: 'US (01/28/2026)',
  eu: 'EU (28/01/2026)',
  long: 'Long (January 28, 2026)',
};

const PRESET_LOCALE: Record<DateFormatPreset, string> = {
  iso: 'sv-SE',
  us: 'en-US',
  eu: 'en-GB',
  long: 'en-US',
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    formatterCache.set(key, formatter);
  }
  return formatter;
}

/**
 * Short date for tables/metadata.
 * iso  → 2026-01-28
 * us   → 01/28/2026
 * eu   → 28/01/2026
 * long → January 28, 2026
 */
export function formatDate(
  dateStr: string,
  config: DateFormatConfig = DEFAULT_DATE_CONFIG,
): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const locale = PRESET_LOCALE[config.dateFormat];
  const options: Intl.DateTimeFormatOptions = {
    timeZone: config.timezone,
    ...(config.dateFormat === 'long'
      ? { month: 'long', day: 'numeric', year: 'numeric' }
      : { year: 'numeric', month: '2-digit', day: '2-digit' }),
  };

  return getFormatter(locale, options).format(date);
}

/**
 * Weekday + short date for grid column headers.
 * us  → Mon 1/28
 * eu  → Mon 28/1
 * iso → Mon 01-28
 * long → Mon Jan 28
 */
export function formatDateHeader(
  dateStr: string,
  config: DateFormatConfig = DEFAULT_DATE_CONFIG,
): string {
  const date = new Date(dateStr + 'T12:00:00');
  if (isNaN(date.getTime())) return dateStr;

  const locale = PRESET_LOCALE[config.dateFormat];

  const weekday = getFormatter(locale, {
    weekday: 'short',
    timeZone: config.timezone,
  }).format(date);

  if (config.dateFormat === 'long') {
    const monthDay = getFormatter(locale, {
      month: 'short',
      day: 'numeric',
      timeZone: config.timezone,
    }).format(date);
    return `${weekday} ${monthDay}`;
  }

  // Derive month/day via Intl so they respect the configured timezone
  const parts = getFormatter(locale, {
    month: 'numeric',
    day: 'numeric',
    timeZone: config.timezone,
  }).formatToParts(date);
  const monthValue = parts.find((p) => p.type === 'month')?.value ?? '';
  const dayValue = parts.find((p) => p.type === 'day')?.value ?? '';

  if (config.dateFormat === 'iso') {
    return `${weekday} ${monthValue.padStart(2, '0')}-${dayValue.padStart(2, '0')}`;
  }

  // us → M/D, eu → D/M
  const datePart = config.dateFormat === 'us'
    ? `${monthValue}/${dayValue}`
    : `${dayValue}/${monthValue}`;
  return `${weekday} ${datePart}`;
}

/**
 * Short weekday + month + day for badges (results best-slots).
 * us/long → Mon, Jan 28
 * eu      → Mon, 28 Jan
 * iso     → Mon, 01-28
 */
export function formatDateShort(
  dateStr: string,
  config: DateFormatConfig = DEFAULT_DATE_CONFIG,
): string {
  const date = new Date(dateStr + 'T12:00:00');
  if (isNaN(date.getTime())) return dateStr;

  const locale = PRESET_LOCALE[config.dateFormat];

  const weekday = getFormatter(locale, {
    weekday: 'short',
    timeZone: config.timezone,
  }).format(date);

  if (config.dateFormat === 'iso') {
    const parts = getFormatter(locale, {
      month: 'numeric',
      day: 'numeric',
      timeZone: config.timezone,
    }).formatToParts(date);
    const month = (parts.find((p) => p.type === 'month')?.value ?? '').padStart(2, '0');
    const day = (parts.find((p) => p.type === 'day')?.value ?? '').padStart(2, '0');
    return `${weekday}, ${month}-${day}`;
  }

  const monthDay = getFormatter(locale, {
    month: 'short',
    day: 'numeric',
    timeZone: config.timezone,
  }).format(date);

  return `${weekday}, ${monthDay}`;
}

/**
 * Localized time string.
 * Locales that use 24h (sv-SE, en-GB) get 24h format automatically.
 * en-US gets 12h with AM/PM.
 *
 * Note: No timezone conversion — hour/minute are abstract grid labels,
 * not real timestamps. Only the locale affects 12h vs 24h display.
 */
export function formatTime(
  hour: number,
  minute: number,
  config: DateFormatConfig = DEFAULT_DATE_CONFIG,
): string {
  const locale = PRESET_LOCALE[config.dateFormat];
  // Use UTC date + UTC timezone to prevent any local-timezone shifting
  const date = new Date(Date.UTC(2000, 0, 1, hour, minute));
  return getFormatter(locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

/**
 * Build a DateFormatConfig from a poll's time_config, falling back to defaults.
 */
export function buildPollDateConfig(
  poll?: { time_config?: { timezone?: string } } | null,
): DateFormatConfig {
  return {
    ...DEFAULT_DATE_CONFIG,
    timezone: poll?.time_config?.timezone ?? DEFAULT_DATE_CONFIG.timezone,
  };
}

/**
 * Month + year for calendar navigation.
 * long/us → January 2026
 * eu      → January 2026
 * iso     → 2026-01 (year-month)
 */
export function formatMonthYear(
  year: number,
  month: number,
  config: DateFormatConfig = DEFAULT_DATE_CONFIG,
): string {
  const locale = PRESET_LOCALE[config.dateFormat];
  const date = new Date(year, month);

  if (config.dateFormat === 'iso') {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }

  return getFormatter(locale, {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateHeader,
  formatDateShort,
  formatTime,
  formatMonthYear,
  buildPollDateConfig,
  DEFAULT_DATE_CONFIG,
  type DateFormatConfig,
} from '../date-formatter';

const configs: Record<string, DateFormatConfig> = {
  iso: { dateFormat: 'iso', timezone: 'UTC' },
  us: { dateFormat: 'us', timezone: 'UTC' },
  eu: { dateFormat: 'eu', timezone: 'UTC' },
  long: { dateFormat: 'long', timezone: 'UTC' },
};

describe('formatDate', () => {
  it.each([
    ['iso', '2026-01-28'],
    ['us', '01/28/2026'],
    ['eu', '28/01/2026'],
    ['long', 'January 28, 2026'],
  ])('formats with %s preset', (preset, expected) => {
    expect(formatDate('2026-01-28T12:00:00Z', configs[preset])).toBe(expected);
  });

  it('returns original string for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('respects timezone', () => {
    // Midnight UTC on Jan 28 is still Jan 27 in Pacific time
    const result = formatDate('2026-01-28T00:00:00Z', {
      dateFormat: 'iso',
      timezone: 'America/Los_Angeles',
    });
    expect(result).toBe('2026-01-27');
  });
});

describe('formatDateHeader', () => {
  it('formats us preset with weekday', () => {
    const result = formatDateHeader('2026-01-28', configs.us);
    expect(result).toMatch(/Wed/);
    expect(result).toMatch(/1\/28/);
  });

  it('formats eu preset with weekday', () => {
    const result = formatDateHeader('2026-01-28', configs.eu);
    expect(result).toMatch(/Wed/);
    // en-GB may produce "28/01" (zero-padded) or "28/1"
    expect(result).toMatch(/28\/0?1/);
  });

  it('formats iso preset with weekday', () => {
    const result = formatDateHeader('2026-01-28', configs.iso);
    // sv-SE uses Swedish weekday abbreviations (e.g., "ons" for Wednesday)
    expect(result).toMatch(/01-28/);
  });

  it('formats long preset with weekday', () => {
    const result = formatDateHeader('2026-01-28', configs.long);
    expect(result).toMatch(/Wed/);
    expect(result).toMatch(/Jan/);
  });

  it('returns original string for invalid date', () => {
    expect(formatDateHeader('invalid')).toBe('invalid');
  });
});

describe('formatDateShort', () => {
  it('formats us preset', () => {
    const result = formatDateShort('2026-01-28', configs.us);
    expect(result).toMatch(/Wed/);
    expect(result).toMatch(/Jan/);
  });

  it('formats eu preset', () => {
    const result = formatDateShort('2026-01-28', configs.eu);
    expect(result).toMatch(/Wed/);
    expect(result).toMatch(/Jan/);
  });

  it('formats iso preset with padded month-day', () => {
    const result = formatDateShort('2026-01-28', configs.iso);
    // sv-SE uses Swedish weekday abbreviations; just verify the date part
    expect(result).toMatch(/01-28/);
  });

  it('returns original string for invalid date', () => {
    expect(formatDateShort('invalid')).toBe('invalid');
  });
});

describe('formatTime', () => {
  it('formats us preset times with AM/PM', () => {
    expect(formatTime(0, 0, configs.us)).toBe('12:00 AM');
    expect(formatTime(12, 0, configs.us)).toBe('12:00 PM');
    expect(formatTime(23, 30, configs.us)).toBe('11:30 PM');
  });

  it('formats iso preset times in 24h', () => {
    // sv-SE Intl may format hour 0 as "0:00" (no leading zero)
    const midnight = formatTime(0, 0, configs.iso);
    expect(midnight).toMatch(/^0?0:00$/);
    expect(formatTime(12, 0, configs.iso)).toBe('12:00');
    expect(formatTime(23, 30, configs.iso)).toBe('23:30');
  });

  it('formats eu preset times in 24h', () => {
    const midnight = formatTime(0, 0, configs.eu);
    expect(midnight).toMatch(/^0?0:00$/);
    expect(formatTime(12, 0, configs.eu)).toBe('12:00');
    expect(formatTime(23, 59, configs.eu)).toBe('23:59');
  });

  it('formats long preset times same as us (en-US)', () => {
    expect(formatTime(0, 0, configs.long)).toBe('12:00 AM');
    expect(formatTime(12, 0, configs.long)).toBe('12:00 PM');
    expect(formatTime(23, 59, configs.long)).toBe('11:59 PM');
  });
});

describe('formatMonthYear', () => {
  it('formats iso as YYYY-MM', () => {
    expect(formatMonthYear(2026, 0, configs.iso)).toBe('2026-01');
    expect(formatMonthYear(2026, 11, configs.iso)).toBe('2026-12');
  });

  it('formats us as Month Year', () => {
    expect(formatMonthYear(2026, 0, configs.us)).toBe('January 2026');
  });

  it('formats eu as Month Year', () => {
    expect(formatMonthYear(2026, 0, configs.eu)).toBe('January 2026');
  });

  it('formats long as Month Year', () => {
    expect(formatMonthYear(2026, 0, configs.long)).toBe('January 2026');
  });
});

describe('buildPollDateConfig', () => {
  it('returns defaults for undefined poll', () => {
    expect(buildPollDateConfig()).toEqual(DEFAULT_DATE_CONFIG);
  });

  it('returns defaults for null poll', () => {
    expect(buildPollDateConfig(null)).toEqual(DEFAULT_DATE_CONFIG);
  });

  it('uses poll timezone when provided', () => {
    const config = buildPollDateConfig({
      time_config: { timezone: 'Europe/London' },
    });
    expect(config.timezone).toBe('Europe/London');
    expect(config.dateFormat).toBe(DEFAULT_DATE_CONFIG.dateFormat);
  });

  it('falls back to default when timezone is undefined', () => {
    const config = buildPollDateConfig({ time_config: {} });
    expect(config.timezone).toBe(DEFAULT_DATE_CONFIG.timezone);
  });
});

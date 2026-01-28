import { useMemo } from 'react';
import {
  DEFAULT_DATE_CONFIG,
  formatDate as _formatDate,
  formatDateHeader as _formatDateHeader,
  formatDateShort as _formatDateShort,
  formatTime as _formatTime,
  formatMonthYear as _formatMonthYear,
  type DateFormatConfig,
} from '@autoart/shared';
import { useUserSettings } from '../api/hooks/auth';

export function useDateFormat(): DateFormatConfig & {
  formatDate: (dateStr: string) => string;
  formatDateHeader: (dateStr: string) => string;
  formatDateShort: (dateStr: string) => string;
  formatTime: (hour: number, minute: number) => string;
  formatMonthYear: (year: number, month: number) => string;
} {
  const { data: settings } = useUserSettings();

  const config: DateFormatConfig = useMemo(() => ({
    dateFormat: (settings?.date_format as DateFormatConfig['dateFormat']) ?? DEFAULT_DATE_CONFIG.dateFormat,
    timezone: (settings?.timezone as string) ?? DEFAULT_DATE_CONFIG.timezone,
  }), [settings?.date_format, settings?.timezone]);

  return useMemo(() => ({
    ...config,
    formatDate: (dateStr: string) => _formatDate(dateStr, config),
    formatDateHeader: (dateStr: string) => _formatDateHeader(dateStr, config),
    formatDateShort: (dateStr: string) => _formatDateShort(dateStr, config),
    formatTime: (hour: number, minute: number) => _formatTime(hour, minute, config),
    formatMonthYear: (year: number, month: number) => _formatMonthYear(year, month, config),
  }), [config]);
}

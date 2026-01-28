import { useState, useEffect, useCallback, useMemo } from 'react';
import { Clock, Globe } from 'lucide-react';
import { useUserSettings, useSetUserSetting } from '../../api/hooks/auth';
import {
  DATE_FORMAT_LABELS,
  DEFAULT_DATE_CONFIG,
  type DateFormatPreset,
} from '@autoart/shared';

const DATE_FORMAT_OPTIONS = (Object.keys(DATE_FORMAT_LABELS) as DateFormatPreset[]).map(
  (key) => ({ value: key, label: DATE_FORMAT_LABELS[key] })
);

const TIMEZONE_LIST: string[] = (() => {
  try {
    return (Intl as any).supportedValuesOf('timeZone') as string[];
  } catch {
    // Fallback for older environments
    return ['America/Vancouver', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney', 'Pacific/Auckland'];
  }
})();

export function DateTimeSection() {
  const { data: settings } = useUserSettings();
  const setSetting = useSetUserSetting();

  const savedFormat = (settings?.date_format as DateFormatPreset) || DEFAULT_DATE_CONFIG.dateFormat;
  const savedTimezone = (settings?.timezone as string) || DEFAULT_DATE_CONFIG.timezone;

  const [timezoneInput, setTimezoneInput] = useState(savedTimezone);

  useEffect(() => {
    setTimezoneInput(savedTimezone);
  }, [savedTimezone]);

  const handleFormatChange = useCallback((value: string) => {
    setSetting.mutate({ key: 'date_format', value });
  }, [setSetting]);

  const handleTimezoneBlur = useCallback(() => {
    const trimmed = timezoneInput.trim();
    if (trimmed && TIMEZONE_LIST.includes(trimmed) && trimmed !== savedTimezone) {
      setSetting.mutate({ key: 'timezone', value: trimmed });
    } else if (!trimmed || !TIMEZONE_LIST.includes(trimmed)) {
      // Reset to saved value if invalid
      setTimezoneInput(savedTimezone);
    }
  }, [timezoneInput, savedTimezone, setSetting]);

  const datalistId = useMemo(() => 'tz-list', []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Date & Time</h2>
        <p className="text-sm text-slate-500 mt-1">
          Configure how dates and times are displayed
        </p>
      </div>

      {/* Date Format */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-medium text-slate-900">Date Format</h3>
            <p className="text-sm text-slate-500">
              Choose how dates are displayed throughout the application
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {DATE_FORMAT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleFormatChange(option.value)}
              className={`
                flex flex-col p-3 rounded-lg border-2 transition-all text-left
                ${savedFormat === option.value
                  ? 'border-indigo-500 bg-indigo-50/50'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }
              `}
            >
              <span className="text-sm font-medium text-slate-900">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Timezone */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-medium text-slate-900">Timezone</h3>
            <p className="text-sm text-slate-500">
              Dates will be displayed in this timezone
            </p>
          </div>
        </div>

        <input
          type="text"
          list={datalistId}
          value={timezoneInput}
          onChange={(e) => setTimezoneInput(e.target.value)}
          onBlur={handleTimezoneBlur}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          placeholder="e.g. America/Vancouver"
        />
        <datalist id={datalistId}>
          {TIMEZONE_LIST.map((tz) => (
            <option key={tz} value={tz} />
          ))}
        </datalist>
      </div>
    </div>
  );
}

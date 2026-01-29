import { clsx } from 'clsx';
import { forwardRef, InputHTMLAttributes, useCallback, useState } from 'react';

interface CurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'value' | 'onChange'> {
    label?: string;
    description?: string;
    hint?: string;
    error?: string;
    size?: 'sm' | 'md' | 'lg';
    /** Amount in minor units (cents). 15000 = $150.00 */
    value?: number | null;
    /** ISO 4217 currency code. Defaults to 'CAD'. */
    currency?: string;
    /** Called with amount in minor units (cents) */
    onChange?: (amount: number) => void;
}

/**
 * Currency input that stores integer minor units (cents).
 * Displays formatted dollars, stores/emits integer cents.
 * Same approach as Stripe — avoids IEEE 754 float issues.
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
    ({ className, label, description, hint, error, required, size = 'md', id, value, currency = 'CAD', onChange, onBlur, ...props }, ref) => {
        const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

        // Display value: convert cents to dollars string
        const toDisplay = (cents: number | null | undefined): string => {
            if (cents === null || cents === undefined) return '';
            return (cents / 100).toFixed(2);
        };

        const [displayValue, setDisplayValue] = useState(toDisplay(value));

        // Sync external value changes
        const externalDisplay = toDisplay(value);
        if (value !== undefined && displayValue !== externalDisplay && document.activeElement !== document.getElementById(inputId ?? '')) {
            setDisplayValue(externalDisplay);
        }

        const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
            const raw = e.target.value;
            // Allow typing: digits, decimal, minus
            if (/^-?[0-9]*\.?[0-9]{0,2}$/.test(raw) || raw === '' || raw === '-') {
                setDisplayValue(raw);
            }
        }, []);

        const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
            const cleaned = displayValue.replace(/[^0-9.\-]/g, '');
            const parsed = parseFloat(cleaned);
            if (!isNaN(parsed)) {
                const cents = Math.round(parsed * 100);
                setDisplayValue((cents / 100).toFixed(2));
                onChange?.(cents);
            } else {
                setDisplayValue('');
                onChange?.(0);
            }
            onBlur?.(e);
        }, [displayValue, onChange, onBlur]);

        const currencySymbol = getCurrencySymbol(currency);

        return (
            <div className="flex flex-col gap-1">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="text-sm font-medium text-slate-700"
                    >
                        {label}
                        {required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                )}
                {description && (
                    <p className="text-xs text-slate-500">{description}</p>
                )}
                <div className="relative">
                    <span className={clsx(
                        'absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none',
                        {
                            'pl-2 text-xs': size === 'sm',
                            'pl-3 text-sm': size === 'md',
                            'pl-4 text-base': size === 'lg',
                        },
                    )}>
                        {currencySymbol}
                    </span>
                    <input
                        ref={ref}
                        id={inputId}
                        type="text"
                        inputMode="decimal"
                        value={displayValue}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className={clsx(
                            'w-full rounded-lg border transition-colors font-mono',
                            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                            'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
                            error
                                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                                : 'border-slate-300',
                            {
                                'pl-6 pr-2 py-1 text-xs': size === 'sm',
                                'pl-7 pr-3 py-2 text-sm': size === 'md',
                                'pl-8 pr-4 py-2.5 text-base': size === 'lg',
                            },
                            className
                        )}
                        aria-invalid={!!error}
                        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
                        {...props}
                    />
                </div>
                {hint && !error && (
                    <p id={`${inputId}-hint`} className="text-xs text-slate-500">
                        {hint}
                    </p>
                )}
                {error && (
                    <p id={`${inputId}-error`} className="text-xs text-red-600">
                        {error}
                    </p>
                )}
            </div>
        );
    }
);

CurrencyInput.displayName = 'CurrencyInput';

function getCurrencySymbol(code: string): string {
    switch (code) {
        case 'CAD':
        case 'USD':
        case 'AUD':
            return '$';
        case 'EUR':
            return '\u20AC';
        case 'GBP':
            return '\u00A3';
        default:
            return code;
    }
}

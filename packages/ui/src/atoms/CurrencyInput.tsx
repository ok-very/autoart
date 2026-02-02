import { clsx } from 'clsx';
import { forwardRef, InputHTMLAttributes, useCallback, useRef, useState } from 'react';

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
        const isFocusedRef = useRef(false);

        // Sync external value changes
        const externalDisplay = toDisplay(value);
        if (value !== undefined && displayValue !== externalDisplay && !isFocusedRef.current) {
            setDisplayValue(externalDisplay);
        }

        const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
            const raw = e.target.value;
            // Allow typing: digits, decimal, minus
            if (/^-?[0-9]*\.?[0-9]{0,2}$/.test(raw) || raw === '' || raw === '-') {
                setDisplayValue(raw);
            }
        }, []);

        const handleFocus = useCallback(() => {
            isFocusedRef.current = true;
        }, []);

        const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
            isFocusedRef.current = false;
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
                        className="text-sm font-medium text-[var(--ws-fg,#1e293b)]"
                    >
                        {label}
                        {required && <span className="text-[var(--ws-color-error,#8c4a4a)] ml-0.5">*</span>}
                    </label>
                )}
                {description && (
                    <p className="text-xs text-[var(--ws-text-secondary,#5a5a57)]">{description}</p>
                )}
                <div className="relative">
                    <span className={clsx(
                        'absolute left-0 top-1/2 -translate-y-1/2 text-[var(--ws-text-disabled,#8c8c88)] pointer-events-none',
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
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        className={clsx(
                            'w-full rounded-lg border transition-colors font-mono',
                            'focus:outline-none focus:ring-2 focus:ring-[var(--ws-accent,#3b82f6)] focus:border-[var(--ws-accent,#3b82f6)]',
                            'disabled:bg-[var(--ws-bg,#f8fafc)] disabled:text-[var(--ws-text-disabled,#8c8c88)] disabled:cursor-not-allowed',
                            error
                                ? 'border-[var(--ws-color-error,#8c4a4a)] focus:ring-[var(--ws-color-error,#8c4a4a)] focus:border-[var(--ws-color-error,#8c4a4a)]'
                                : 'border-[var(--ws-panel-border,#e2e8f0)]',
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
                    <p id={`${inputId}-hint`} className="text-xs text-[var(--ws-text-secondary,#5a5a57)]">
                        {hint}
                    </p>
                )}
                {error && (
                    <p id={`${inputId}-error`} className="text-xs text-[var(--ws-color-error,#8c4a4a)]">
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

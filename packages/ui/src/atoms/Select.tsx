import { clsx } from 'clsx';
import { forwardRef } from 'react';

interface SelectOption {
    value: string;
    label: string;
}

interface SelectProps {
    value: string | null;
    onChange: (value: string | null) => void;
    data: SelectOption[];
    placeholder?: string;
    label?: string;
    description?: string;
    disabled?: boolean;
    className?: string;
    id?: string;
    size?: 'sm' | 'md' | 'lg';
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, value, onChange, data, placeholder, label, description, disabled, size = 'md', id, ...props }, ref) => {
        const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

        return (
            <div className="flex flex-col gap-1">
                {label && (
                    <label
                        htmlFor={selectId}
                        className="text-sm font-medium text-[var(--ws-fg,#1e293b)]"
                    >
                        {label}
                    </label>
                )}
                {description && (
                    <p className="text-xs text-[var(--ws-text-secondary,#5a5a57)]">{description}</p>
                )}
                <select
                    ref={ref}
                    id={selectId}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value || null)}
                    disabled={disabled}
                    className={clsx(
                        'w-full rounded-lg border transition-colors bg-[var(--ws-panel-bg,#fff)] font-sans',
                        'focus:outline-none focus:ring-2 focus:ring-[var(--ws-accent,#3b82f6)] focus:border-[var(--ws-accent,#3b82f6)]',
                        'disabled:bg-[var(--ws-bg,#f8fafc)] disabled:text-[var(--ws-text-disabled,#8c8c88)] disabled:cursor-not-allowed',
                        'border-[var(--ws-panel-border,#e2e8f0)]',
                        {
                            'px-2 py-1 text-xs': size === 'sm',
                            'px-3 py-2 text-sm': size === 'md',
                            'px-4 py-2.5 text-base': size === 'lg',
                        },
                        className
                    )}
                    {...props}
                >
                    {placeholder && (
                        <option value="" disabled>
                            {placeholder}
                        </option>
                    )}
                    {data.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
        );
    }
);

Select.displayName = 'Select';

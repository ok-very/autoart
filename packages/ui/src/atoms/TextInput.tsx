import { clsx } from 'clsx';
import { forwardRef, InputHTMLAttributes } from 'react';

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
    label?: string;
    description?: string;
    hint?: string;
    error?: string;
    size?: 'sm' | 'md' | 'lg';
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
    ({ className, label, description, hint, error, required, size = 'md', id, ...props }, ref) => {
        const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

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
                <input
                    ref={ref}
                    id={inputId}
                    className={clsx(
                        'w-full rounded-lg border transition-colors font-sans',
                        'focus:outline-none focus:ring-2 focus:ring-[var(--ws-accent,#3b82f6)] focus:border-[var(--ws-accent,#3b82f6)]',
                        'disabled:bg-[var(--ws-bg,#f8fafc)] disabled:text-[var(--ws-text-disabled,#8c8c88)] disabled:cursor-not-allowed',
                        error
                            ? 'border-[var(--ws-color-error,#8c4a4a)] focus:ring-[var(--ws-color-error,#8c4a4a)] focus:border-[var(--ws-color-error,#8c4a4a)]'
                            : 'border-[var(--ws-panel-border,#e2e8f0)]',
                        {
                            'px-2 py-1 text-xs': size === 'sm',
                            'px-3 py-2 text-sm': size === 'md',
                            'px-4 py-2.5 text-base': size === 'lg',
                        },
                        className
                    )}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
                    {...props}
                />
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

TextInput.displayName = 'TextInput';


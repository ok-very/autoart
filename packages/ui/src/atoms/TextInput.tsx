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
                        className="text-sm font-medium text-slate-700"
                    >
                        {label}
                        {required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                )}
                {description && (
                    <p className="text-xs text-slate-500">{description}</p>
                )}
                <input
                    ref={ref}
                    id={inputId}
                    className={clsx(
                        'w-full rounded-lg border transition-colors font-sans',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                        'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
                        error
                            ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                            : 'border-slate-300',
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

TextInput.displayName = 'TextInput';


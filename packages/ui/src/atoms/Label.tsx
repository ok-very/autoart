import { clsx } from 'clsx';

interface LabelProps {
    /** Label text */
    children: React.ReactNode;
    /** Whether the field is required */
    required?: boolean;
    /** Whether the field is disabled */
    disabled?: boolean;
    /** HTML for attribute */
    htmlFor?: string;
    /** Additional className */
    className?: string;
    /** Size variant */
    size?: 'sm' | 'md';
}

/**
 * Label - Field label atom
 * 
 * Pure presentational label with optional required indicator.
 */
export function Label({
    children,
    required = false,
    disabled = false,
    htmlFor,
    className,
    size = 'md'
}: LabelProps) {
    return (
        <label
            htmlFor={htmlFor}
            className={clsx(
                'font-medium block',
                size === 'sm' ? 'text-xs' : 'text-sm',
                disabled ? 'text-[var(--ws-text-disabled,#8c8c88)]' : 'text-[var(--ws-fg,#1e293b)]',
                className
            )}
        >
            {children}
            {required && (
                <span className="text-[var(--ws-color-error,#8c4a4a)] ml-0.5" aria-label="required">*</span>
            )}
        </label>
    );
}

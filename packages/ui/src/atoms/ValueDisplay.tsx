import { clsx } from 'clsx';

interface ValueDisplayProps {
    /** The value to display */
    children: React.ReactNode;
    /** Whether the value is empty/placeholder */
    isEmpty?: boolean;
    /** Placeholder text when empty */
    placeholder?: string;
    /** Whether value is truncated */
    truncate?: boolean;
    /** Additional className */
    className?: string;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
}

/**
 * ValueDisplay - Read-only value display atom
 * 
 * Pure presentational component for displaying field values.
 * Handles empty states with placeholder text.
 */
export function ValueDisplay({
    children,
    isEmpty = false,
    placeholder = '—',
    truncate = false,
    className,
    size = 'md'
}: ValueDisplayProps) {
    const sizeClasses = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base'
    };

    if (isEmpty || children === null || children === undefined || children === '') {
        return (
            <span className={clsx(
                'text-slate-400 italic',
                sizeClasses[size],
                className
            )}>
                {placeholder}
            </span>
        );
    }

    return (
        <span className={clsx(
            'text-slate-900',
            sizeClasses[size],
            truncate && 'truncate block',
            className
        )}>
            {children}
        </span>
    );
}

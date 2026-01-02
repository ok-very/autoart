import { clsx } from 'clsx';
import { AlertCircle } from 'lucide-react';

interface InlineErrorProps {
    /** Error message to display */
    message: string;
    /** Additional className */
    className?: string;
    /** Whether to show icon */
    showIcon?: boolean;
}

/**
 * InlineError - Error message display atom
 * 
 * Pure presentational component for showing inline error messages.
 */
export function InlineError({
    message,
    className,
    showIcon = true
}: InlineErrorProps) {
    return (
        <div className={clsx(
            'flex items-center gap-1 text-red-600 text-xs',
            className
        )}>
            {showIcon && <AlertCircle size={12} />}
            <span>{message}</span>
        </div>
    );
}

import { clsx } from 'clsx';
import { Label } from '../atoms/Label';
import { InlineError } from '../atoms/InlineError';

interface FieldGroupProps {
    /** Field label */
    label: string;
    /** Whether the field is required */
    required?: boolean;
    /** Whether the field is disabled */
    disabled?: boolean;
    /** Error message if any */
    error?: string;
    /** Help text shown below label */
    helpText?: string;
    /** Field content (input or value display) */
    children: React.ReactNode;
    /** Additional className for the container */
    className?: string;
    /** Layout direction */
    layout?: 'vertical' | 'horizontal';
}

/**
 * FieldGroup - Molecule that composes label, content, and error
 * 
 * Standard layout for form fields with consistent spacing
 * and error display.
 */
export function FieldGroup({
    label,
    required = false,
    disabled = false,
    error,
    helpText,
    children,
    className,
    layout = 'vertical'
}: FieldGroupProps) {
    if (layout === 'horizontal') {
        return (
            <div className={clsx('flex items-start gap-3', className)}>
                <div className="w-32 shrink-0 pt-2">
                    <Label required={required} disabled={disabled} size="sm">
                        {label}
                    </Label>
                    {helpText && (
                        <p className="text-xs text-slate-400 mt-0.5">{helpText}</p>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    {children}
                    {error && <InlineError message={error} className="mt-1" />}
                </div>
            </div>
        );
    }

    return (
        <div className={clsx('space-y-1', className)}>
            <div className="flex items-center gap-2">
                <Label required={required} disabled={disabled}>
                    {label}
                </Label>
                {helpText && (
                    <span className="text-xs text-slate-400">({helpText})</span>
                )}
            </div>
            {children}
            {error && <InlineError message={error} />}
        </div>
    );
}

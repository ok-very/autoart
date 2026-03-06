import { clsx } from 'clsx';

interface LabelProps {
    children: React.ReactNode;
    required?: boolean;
    disabled?: boolean;
    htmlFor?: string;
    className?: string;
    size?: 'sm' | 'md';
}

export function Label({ children, required = false, disabled = false, htmlFor, className, size = 'md' }: LabelProps) {
    return (
        <label
            htmlFor={htmlFor}
            className={clsx(
                'font-medium block',
                size === 'sm' ? 'text-xs' : 'text-sm',
                disabled ? 'text-ws-text-disabled' : 'text-ws-fg',
                className
            )}
        >
            {children}
            {required && <span className="text-ws-error ml-0.5" aria-label="required">*</span>}
        </label>
    );
}

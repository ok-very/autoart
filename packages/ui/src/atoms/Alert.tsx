import { clsx } from 'clsx';
import { HTMLAttributes } from 'react';

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'info' | 'success' | 'warning' | 'error';
}

const variantClasses = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error: 'bg-red-50 border-red-200 text-red-800',
};

export function Alert({ variant = 'info', className, children, ...props }: AlertProps) {
    return (
        <div
            role="alert"
            className={clsx(
                'px-4 py-3 rounded-lg border text-sm',
                variantClasses[variant],
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}

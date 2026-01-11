import { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface TextProps extends HTMLAttributes<HTMLSpanElement> {
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    weight?: 'normal' | 'medium' | 'semibold' | 'bold';
    color?: 'default' | 'dimmed' | 'muted' | 'error' | 'success';
    truncate?: boolean;
    as?: 'span' | 'p' | 'div';
}

const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
};

const weightClasses = {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
};

const colorClasses = {
    default: 'text-slate-900',
    dimmed: 'text-slate-600',
    muted: 'text-slate-400',
    error: 'text-red-600',
    success: 'text-emerald-600',
};


export function Text({
    size = 'md',
    weight = 'normal',
    color = 'default',
    truncate = false,
    as: Component = 'span',
    className,
    children,
    ...props
}: TextProps) {
    return (
        <Component
            className={clsx(
                sizeClasses[size],
                weightClasses[weight],
                colorClasses[color],
                truncate && 'truncate',
                className
            )}
            {...props}
        >
            {children}
        </Component>
    );
}

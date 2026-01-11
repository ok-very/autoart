import { forwardRef, ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'light' | 'subtle';
    size?: 'xs' | 'sm' | 'md' | 'lg';
    color?: 'gray' | 'blue' | 'violet' | 'yellow';
    leftSection?: React.ReactNode;
    rightSection?: React.ReactNode;
}

const colorStyles = {
    gray: {
        light: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
        subtle: 'text-slate-600 hover:bg-slate-100',
    },
    blue: {
        light: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
        subtle: 'text-blue-600 hover:bg-blue-50',
    },
    violet: {
        light: 'bg-violet-50 text-violet-700 hover:bg-violet-100',
        subtle: 'text-violet-600 hover:bg-violet-50',
    },
    yellow: {
        light: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
        subtle: 'text-amber-600 hover:bg-amber-50',
    },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', color = 'gray', leftSection, rightSection, children, ...props }, ref) => {
        const getVariantClasses = () => {
            if (variant === 'light') return colorStyles[color].light;
            if (variant === 'subtle') return colorStyles[color].subtle;
            return {
                primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
                secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-slate-500',
                ghost: 'text-slate-600 hover:bg-slate-100 focus:ring-slate-500',
                danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
            }[variant] || '';
        };

        return (
            <button
                ref={ref}
                className={clsx(
                    'inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-offset-2',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    getVariantClasses(),
                    {
                        'px-2 py-0.5 text-xs': size === 'xs',
                        'px-2 py-1 text-xs': size === 'sm',
                        'px-3 py-2 text-sm': size === 'md',
                        'px-4 py-2.5 text-base': size === 'lg',
                    },
                    className
                )}
                {...props}
            >
                {leftSection}
                {children}
                {rightSection}
            </button>
        );
    }
);

Button.displayName = 'Button';

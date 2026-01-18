import { clsx } from 'clsx';
import { LucideIcon } from 'lucide-react';
import { forwardRef, ButtonHTMLAttributes } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    /** Lucide icon component */
    icon: LucideIcon;
    /** Button variant */
    variant?: 'ghost' | 'subtle' | 'solid';
    /** Size of the button */
    size?: 'sm' | 'md' | 'lg';
    /** Accessible label */
    label: string;
    /** Whether button is active/selected */
    active?: boolean;
}

/**
 * IconButton - Icon-only button atom
 * 
 * Pure presentational button with icon. Requires accessible label.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
    ({
        icon: Icon,
        variant = 'ghost',
        size = 'md',
        label,
        active = false,
        className,
        ...props
    }, ref) => {
        const sizeConfig = {
            sm: { button: 'w-6 h-6', icon: 14 },
            md: { button: 'w-8 h-8', icon: 16 },
            lg: { button: 'w-10 h-10', icon: 20 }
        };

        const variantClasses = {
            ghost: clsx(
                'text-slate-500 hover:text-slate-700 hover:bg-slate-100',
                active && 'text-blue-600 bg-blue-50'
            ),
            subtle: clsx(
                'text-slate-600 bg-slate-100 hover:bg-slate-200',
                active && 'text-blue-600 bg-blue-100'
            ),
            solid: clsx(
                'text-white bg-blue-600 hover:bg-blue-700',
                active && 'bg-blue-700'
            )
        };

        return (
            <button
                ref={ref}
                type="button"
                className={clsx(
                    'inline-flex items-center justify-center rounded-md transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    sizeConfig[size].button,
                    variantClasses[variant],
                    className
                )}
                aria-label={label}
                title={label}
                {...props}
            >
                <Icon size={sizeConfig[size].icon} />
            </button>
        );
    }
);

IconButton.displayName = 'IconButton';

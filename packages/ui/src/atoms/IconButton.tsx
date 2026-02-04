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
                'text-ws-muted hover:text-ws-fg hover:bg-ws-row-expanded-bg',
                active && 'text-ws-accent bg-ws-row-expanded-bg'
            ),
            subtle: clsx(
                'text-ws-text-secondary bg-ws-bg hover:opacity-80',
                active && 'text-ws-accent'
            ),
            solid: clsx(
                'text-ws-accent-fg bg-ws-accent hover:opacity-90',
                active && 'opacity-90'
            )
        };

        return (
            <button
                ref={ref}
                type="button"
                className={clsx(
                    'inline-flex items-center justify-center rounded-md transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-ws-accent focus:ring-offset-1',
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

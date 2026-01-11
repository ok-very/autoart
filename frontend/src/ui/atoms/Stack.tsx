import { forwardRef, HTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface StackProps extends HTMLAttributes<HTMLDivElement> {
    gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
}

const gapClasses = {
    none: 'gap-0',
    xs: 'gap-1',
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
};

export const Stack = forwardRef<HTMLDivElement, StackProps>(
    ({ gap = 'md', className, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={clsx(
                    'flex flex-col',
                    gapClasses[gap],
                    className
                )}
                {...props}
            >
                {children}
            </div>
        );
    }
);

Stack.displayName = 'Stack';

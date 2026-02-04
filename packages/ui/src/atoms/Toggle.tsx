import { clsx } from 'clsx';
import { forwardRef, ButtonHTMLAttributes } from 'react';

interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
    checked: boolean;
    onChange: (checked: boolean) => void;
    size?: 'sm' | 'md';
    label?: string;
}

const sizeConfig = {
    sm: { track: 'h-5 w-9', knob: 'h-3 w-3', on: 'translate-x-5', off: 'translate-x-1' },
    md: { track: 'h-6 w-11', knob: 'h-4 w-4', on: 'translate-x-6', off: 'translate-x-1' },
};

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
    ({ checked, onChange, size = 'md', label, className, ...props }, ref) => {
        const s = sizeConfig[size];

        return (
            <button
                ref={ref}
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                onClick={() => onChange(!checked)}
                className={clsx(
                    'relative inline-flex items-center rounded-full transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-ws-accent focus:ring-offset-1',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    s.track,
                    checked ? 'bg-ws-accent' : 'bg-ws-panel-border',
                    className
                )}
                {...props}
            >
                <span
                    className={clsx(
                        'inline-block transform rounded-full bg-ws-panel-bg transition-transform',
                        s.knob,
                        checked ? s.on : s.off,
                    )}
                />
            </button>
        );
    }
);

Toggle.displayName = 'Toggle';

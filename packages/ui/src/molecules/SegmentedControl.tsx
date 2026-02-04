/**
 * SegmentedControl - A button group for switching between options
 *
 * Renders as a connected button group with selected state styling.
 * Uses proper ARIA attributes for accessibility.
 */

import { clsx } from 'clsx';

export interface SegmentedControlItem {
    value: string;
    label: React.ReactNode;
    disabled?: boolean;
}

export interface SegmentedControlProps {
    value: string;
    onChange: (value: string) => void;
    data: SegmentedControlItem[];
    size?: 'xs' | 'sm' | 'md';
    className?: string;
}

const sizeStyles = {
    xs: 'px-2 py-0.5 text-xs',
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-1.5 text-sm',
};

export function SegmentedControl({
    value,
    onChange,
    data,
    size = 'sm',
    className,
}: SegmentedControlProps) {
    return (
        <div
            role="tablist"
            className={clsx(
                'inline-flex rounded-lg border border-ws-panel-border bg-ws-tabstrip-bg p-0.5',
                className
            )}
        >
            {data.map((item) => {
                const isSelected = item.value === value;

                return (
                    <button
                        key={item.value}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        aria-pressed={isSelected}
                        disabled={item.disabled}
                        onClick={() => {
                            if (!item.disabled && item.value !== value) {
                                onChange(item.value);
                            }
                        }}
                        className={clsx(
                            'rounded-md font-sans font-medium transition-all',
                            sizeStyles[size],
                            isSelected
                                ? 'bg-ws-tab-bg-active text-ws-tab-fg-active shadow-sm border-b-2 border-ws-tab-indicator'
                                : 'text-ws-tab-fg hover:text-ws-tab-fg-hover',
                            item.disabled && 'opacity-50 cursor-not-allowed'
                        )}
                    >
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}

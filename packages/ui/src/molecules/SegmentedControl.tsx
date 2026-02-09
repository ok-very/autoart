/**
 * SegmentedControl - A button group for switching between options
 *
 * Renders as a connected button group with selected state styling.
 * Uses proper ARIA attributes for accessibility.
 *
 * Supports solid (default), glass, and neumorphic variants.
 * @see docs/DESIGN.md for variant guidance.
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
    variant?: 'solid' | 'glass' | 'neumorphic';
    className?: string;
}

const sizeStyles = {
    xs: 'px-2 py-0.5 text-xs',
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-1.5 text-sm',
};

/** Container styles per variant */
const containerVariantStyles = {
    solid: 'border border-ws-panel-border bg-ws-tabstrip-bg',
    glass: 'border border-white/20 bg-white/30 backdrop-blur-sm',
    neumorphic: 'border border-ws-panel-border bg-ws-tabstrip-bg',
};

/** Active tab styles per variant */
function getTabClasses(isSelected: boolean, variant: 'solid' | 'glass' | 'neumorphic') {
    if (!isSelected) {
        return 'text-ws-tab-fg hover:text-ws-tab-fg-hover';
    }

    switch (variant) {
        case 'glass':
            return 'bg-white/60 backdrop-blur-md text-ws-tab-fg-active shadow-sm';
        case 'neumorphic':
            return 'bg-ws-tab-bg-active text-ws-tab-fg-active';
        case 'solid':
        default:
            return 'bg-ws-tab-bg-active text-ws-tab-fg-active shadow-sm border-b-2 border-ws-tab-indicator';
    }
}

/** Inline styles for neumorphic variant (shadows cannot be expressed in Tailwind) */
function getContainerStyle(variant: 'solid' | 'glass' | 'neumorphic'): React.CSSProperties | undefined {
    if (variant === 'neumorphic') {
        return {
            boxShadow:
                'inset 2px 2px 4px rgba(0, 0, 0, 0.06), inset -2px -2px 4px rgba(255, 255, 255, 0.8)',
        };
    }
    return undefined;
}

function getActiveTabStyle(
    isSelected: boolean,
    variant: 'solid' | 'glass' | 'neumorphic'
): React.CSSProperties | undefined {
    if (!isSelected || variant !== 'neumorphic') return undefined;
    return {
        boxShadow: '2px 2px 4px rgba(0, 0, 0, 0.08), -1px -1px 3px rgba(255, 255, 255, 0.9)',
    };
}

export function SegmentedControl({
    value,
    onChange,
    data,
    size = 'sm',
    variant = 'solid',
    className,
}: SegmentedControlProps) {
    return (
        <div
            role="tablist"
            className={clsx(
                'inline-flex rounded-lg p-0.5',
                containerVariantStyles[variant],
                className
            )}
            style={getContainerStyle(variant)}
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
                            getTabClasses(isSelected, variant),
                            item.disabled && 'opacity-50 cursor-not-allowed'
                        )}
                        style={getActiveTabStyle(isSelected, variant)}
                    >
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}

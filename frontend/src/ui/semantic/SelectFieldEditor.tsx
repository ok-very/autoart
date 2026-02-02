/**
 * SelectFieldEditor - Enhanced Select with color/icon support
 *
 * Responsibilities:
 * - Displays current selection with optional color dot
 * - Shows styled dropdown with color indicators
 * - Similar UX to StatusFieldEditor
 *
 * Design Rules:
 * - Pure presentational - no API calls
 * - Receives options with optional colors from parent
 */

import { clsx } from 'clsx';
import { ChevronDown, Check } from 'lucide-react';
import { useCallback } from 'react';

import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator } from '@autoart/ui';

export interface SelectOption {
    value: string;
    label: string;
    color?: string; // Tailwind color class like 'bg-red-500'
}

export interface SelectFieldEditorProps {
    /** Current value */
    value: string | null | undefined;
    /** Available options */
    options: SelectOption[];
    /** Called when selection changes */
    onChange: (value: string | null) => void;
    /** Whether the field is read-only */
    readOnly?: boolean;
    /** Placeholder text when no selection */
    placeholder?: string;
    /** Allow clearing selection */
    clearable?: boolean;
    /** Compact mode for table cells */
    compact?: boolean;
    /** Additional className */
    className?: string;
}

/**
 * SelectFieldEditor - Enhanced dropdown with colors
 */
export function SelectFieldEditor({
    value,
    options,
    onChange,
    readOnly = false,
    placeholder = 'Select...',
    clearable = true,
    compact = false,
    className,
}: SelectFieldEditorProps) {
    // Find current option
    const currentOption = options.find((opt) => opt.value === value);

    const handleSelect = useCallback((optionValue: string | null) => {
        onChange(optionValue);
    }, [onChange]);

    if (readOnly) {
        return (
            <div className={clsx('relative', className)}>
                <div
                    className={clsx(
                        'flex items-center gap-2 rounded border',
                        compact ? 'h-7 px-2 text-xs' : 'h-9 px-3 text-sm',
                        currentOption?.color
                            ? `${currentOption.color.replace('bg-', 'bg-opacity-10 text-').replace('-500', '-700')} border-transparent`
                            : 'border-ws-panel-border bg-ws-panel-bg',
                        'cursor-default'
                    )}
                >
                    {currentOption?.color && (
                        <span className={clsx('w-2.5 h-2.5 rounded-full flex-shrink-0', currentOption.color)} />
                    )}
                    <span className={clsx('flex-1 text-left', !currentOption && 'text-ws-muted')}>
                        {currentOption?.label || placeholder}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className={clsx('relative', className)}>
            <Dropdown>
                <DropdownTrigger asChild>
                    <button
                        type="button"
                        className={clsx(
                            'flex items-center gap-2 rounded border transition-all',
                            compact ? 'h-7 px-2 text-xs' : 'h-9 px-3 text-sm',
                            currentOption?.color
                                ? `${currentOption.color.replace('bg-', 'bg-opacity-10 text-').replace('-500', '-700')} border-transparent`
                                : 'border-ws-panel-border bg-ws-panel-bg',
                            'cursor-pointer hover:border-slate-300'
                        )}
                    >
                        {currentOption?.color && (
                            <span className={clsx('w-2.5 h-2.5 rounded-full flex-shrink-0', currentOption.color)} />
                        )}
                        <span className={clsx('flex-1 text-left', !currentOption && 'text-ws-muted')}>
                            {currentOption?.label || placeholder}
                        </span>
                        <ChevronDown
                            className={clsx(
                                'text-ws-muted flex-shrink-0',
                                compact ? 'w-3 h-3' : 'w-4 h-4'
                            )}
                        />
                    </button>
                </DropdownTrigger>

                <DropdownContent align="start" className="min-w-[160px]">
                    {/* Clear option */}
                    {clearable && value && (
                        <>
                            <DropdownItem
                                onSelect={() => handleSelect(null)}
                                className="text-ws-muted"
                            >
                                Clear
                            </DropdownItem>
                            <DropdownSeparator />
                        </>
                    )}

                    {/* Options */}
                    {options.map((option) => {
                        const isSelected = option.value === value;

                        return (
                            <DropdownItem
                                key={option.value}
                                onSelect={() => handleSelect(option.value)}
                                className={isSelected ? 'bg-slate-100' : ''}
                            >
                                {option.color && (
                                    <span className={clsx('w-3 h-3 rounded-sm flex-shrink-0', option.color)} />
                                )}
                                <span className="flex-1">{option.label}</span>
                                {isSelected && (
                                    <Check size={14} className="text-blue-500" />
                                )}
                            </DropdownItem>
                        );
                    })}
                </DropdownContent>
            </Dropdown>
        </div>
    );
}

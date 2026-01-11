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

import { useState, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';
import { PortalMenu } from '../atoms/PortalMenu';

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
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Find current option
    const currentOption = options.find((opt) => opt.value === value);

    const handleToggle = useCallback(() => {
        if (!readOnly) {
            setIsOpen((prev) => !prev);
        }
    }, [readOnly]);

    const handleSelect = useCallback((optionValue: string | null) => {
        onChange(optionValue);
        setIsOpen(false);
    }, [onChange]);

    const handleClose = useCallback(() => {
        setIsOpen(false);
    }, []);

    return (
        <div className={clsx('relative', className)}>
            {/* Current selection button */}
            <button
                ref={buttonRef}
                type="button"
                onClick={handleToggle}
                disabled={readOnly}
                className={clsx(
                    'flex items-center gap-2 rounded border transition-all',
                    compact ? 'h-7 px-2 text-xs' : 'h-9 px-3 text-sm',
                    currentOption?.color
                        ? `${currentOption.color.replace('bg-', 'bg-opacity-10 text-').replace('-500', '-700')} border-transparent`
                        : 'border-slate-200 bg-white',
                    readOnly
                        ? 'cursor-default'
                        : 'cursor-pointer hover:border-slate-300'
                )}
            >
                {currentOption?.color && (
                    <span className={clsx('w-2.5 h-2.5 rounded-full flex-shrink-0', currentOption.color)} />
                )}
                <span className={clsx('flex-1 text-left', !currentOption && 'text-slate-400')}>
                    {currentOption?.label || placeholder}
                </span>
                {!readOnly && (
                    <ChevronDown
                        className={clsx(
                            'text-slate-400 transition-transform flex-shrink-0',
                            compact ? 'w-3 h-3' : 'w-4 h-4',
                            isOpen && 'rotate-180'
                        )}
                    />
                )}
            </button>

            {/* Dropdown menu */}
            <PortalMenu
                isOpen={isOpen}
                anchorRef={buttonRef}
                onClose={handleClose}
                placement="bottom-start"
                className="py-1 min-w-[160px]"
            >
                {/* Clear option */}
                {clearable && value && (
                    <button
                        type="button"
                        onClick={() => handleSelect(null)}
                        className="w-full px-3 py-1.5 text-left text-sm text-slate-400 hover:bg-slate-50 transition-colors"
                    >
                        Clear
                    </button>
                )}

                {/* Options */}
                {options.map((option) => {
                    const isSelected = option.value === value;

                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => handleSelect(option.value)}
                            className={clsx(
                                'w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 transition-colors',
                                isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'
                            )}
                        >
                            {option.color && (
                                <span className={clsx('w-3 h-3 rounded-sm flex-shrink-0', option.color)} />
                            )}
                            <span className="flex-1">{option.label}</span>
                            {isSelected && (
                                <span className="text-blue-500 text-xs">✓</span>
                            )}
                        </button>
                    );
                })}
            </PortalMenu>
        </div>
    );
}

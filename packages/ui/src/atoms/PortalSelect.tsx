import { clsx } from 'clsx';
import { ChevronDown, Check } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';

import { PortalMenu } from './PortalMenu';

export interface PortalSelectOption {
    value: string;
    label: string;
}

export interface PortalSelectProps {
    value: string | null;
    onChange: (value: string | null) => void;
    data: PortalSelectOption[];
    placeholder?: string;
    label?: string; // Optional label rendered outside
    disabled?: boolean;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    clearable?: boolean;
}

/**
 * PortalSelect - A custom select component that renders its menu in a portal
 * to avoid overflow/clipping issues in tight containers (like tables).
 */
export function PortalSelect({
    value,
    onChange,
    data,
    placeholder = 'Select...',
    label,
    disabled = false,
    className,
    size = 'md',
    clearable = false,
}: PortalSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const currentOption = data.find((opt) => opt.value === value);

    const handleToggle = useCallback(() => {
        if (!disabled) {
            setIsOpen((prev) => !prev);
        }
    }, [disabled]);

    const handleSelect = useCallback((optionValue: string | null) => {
        onChange(optionValue);
        setIsOpen(false);
    }, [onChange]);

    const displayValue = currentOption ? currentOption.label : placeholder;

    return (
        <div className={clsx('flex flex-col gap-1', className)}>
            {label && (
                <span className="text-sm font-medium text-slate-700">{label}</span>
            )}

            <button
                ref={buttonRef}
                type="button"
                onClick={handleToggle}
                disabled={disabled}
                className={clsx(
                    'w-full flex items-center justify-between text-left border rounded-lg transition-all bg-white font-sans',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                    disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'hover:border-slate-300 cursor-pointer',
                    !currentOption && !disabled && 'text-slate-500',
                    currentOption && 'text-slate-900',
                    {
                        'px-2 py-1 text-xs min-h-[26px]': size === 'sm',
                        'px-3 py-2 text-sm min-h-[38px]': size === 'md',
                        'px-4 py-2.5 text-base min-h-[46px]': size === 'lg',
                    }
                )}
            >
                <span className="truncate mr-2">{displayValue}</span>
                <ChevronDown
                    size={size === 'sm' ? 14 : 16}
                    className={clsx('transition-transform shrink-0', isOpen && 'rotate-180')}
                />
            </button>

            <PortalMenu
                isOpen={isOpen}
                anchorRef={buttonRef}
                onClose={() => setIsOpen(false)}
                placement="bottom-start"
                className="max-h-60 overflow-y-auto min-w-[120px]"
            >
                <div className="py-1">
                    {clearable && value && (
                        <button
                            type="button"
                            onClick={() => handleSelect(null)}
                            className="w-full px-3 py-1.5 text-left text-sm text-slate-400 hover:bg-slate-50 transition-colors border-b border-slate-50"
                        >
                            Clear selection
                        </button>
                    )}

                    {data.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-slate-400 italic">No options</div>
                    ) : (
                        data.map((option) => {
                            const isSelected = option.value === value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleSelect(option.value)}
                                    className={clsx(
                                        'w-full px-3 py-1.5 text-left text-sm flex items-center justify-between transition-colors',
                                        isSelected ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                                    )}
                                >
                                    <span className="truncate">{option.label}</span>
                                    {isSelected && <Check size={14} className="ml-2 shrink-0" />}
                                </button>
                            );
                        })
                    )}
                </div>
            </PortalMenu>
        </div>
    );
}

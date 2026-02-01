/**
 * Font Selector Component
 * 
 * Dropdown for selecting fonts in export options
 */

import { ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect, KeyboardEvent, useId } from 'react';
import { COMMON_FONTS, type FontOption } from '../utils/fonts';

interface FontSelectorProps {
    selectedFont: string;
    onChange: (font: string) => void;
    availableFonts?: FontOption[];
    disabled?: boolean;
}

export function FontSelector({
    selectedFont,
    onChange,
    availableFonts = COMMON_FONTS,
    disabled = false,
}: FontSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(0);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const listboxRef = useRef<HTMLDivElement>(null);
    const optionsRef = useRef<(HTMLButtonElement | null)[]>([]);
    const prevIsOpenRef = useRef(isOpen);

    const id = useId();
    const labelId = `${id}-label`;
    const selectedFontOption = availableFonts.find((f) => f.family === selectedFont);

    // Initialize/Reset focused index when opening (only on open transition)
    useEffect(() => {
        if (isOpen && !prevIsOpenRef.current) {
            const index = availableFonts.findIndex((f) => f.family === selectedFont);
            const targetIndex = index >= 0 ? index : 0;
            // Defer setState and focus to avoid synchronous cascading render
            requestAnimationFrame(() => {
                setFocusedIndex(targetIndex);
                optionsRef.current[targetIndex]?.focus();
            });
        }
        prevIsOpenRef.current = isOpen;
    }, [isOpen, availableFonts, selectedFont]);

    // Update focus when index changes
    useEffect(() => {
        if (isOpen && optionsRef.current[focusedIndex]) {
            optionsRef.current[focusedIndex]?.focus();
        }
    }, [focusedIndex, isOpen]);

    const handleTriggerKeyDown = (e: KeyboardEvent) => {
        if (disabled) return;

        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen((prev) => !prev);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIsOpen(true);
        }
    };

    const handleListKeyDown = (e: KeyboardEvent) => {
        if (availableFonts.length === 0) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            setIsOpen(false);
            buttonRef.current?.focus();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusedIndex((prev) => (prev + 1) % availableFonts.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedIndex((prev) => (prev - 1 + availableFonts.length) % availableFonts.length);
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onChange(availableFonts[focusedIndex].family);
            setIsOpen(false);
            buttonRef.current?.focus();
        } else if (e.key === 'Tab') {
            setIsOpen(false);
        }
    };

    return (
        <div className="relative">
            <label id={labelId} className="block text-sm font-medium text-slate-700 mb-1">
                Font Family
            </label>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                onKeyDown={handleTriggerKeyDown}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-labelledby={labelId}
                className="w-full flex items-center justify-between px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-sans hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <span className="flex items-center gap-2">
                    <span style={{ fontFamily: selectedFont }}>{selectedFont}</span>
                    {selectedFontOption && (
                        <span className="text-xs text-slate-500 uppercase">{selectedFontOption.category}</span>
                    )}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <div
                        ref={listboxRef}
                        role="listbox"
                        aria-labelledby={labelId}
                        onKeyDown={handleListKeyDown}
                        className="absolute z-20 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto font-sans focus:outline-none"
                    >
                        {availableFonts.map((font, index) => (
                            <button
                                key={font.family}
                                ref={(el) => { optionsRef.current[index] = el; }}
                                type="button"
                                role="option"
                                aria-selected={font.family === selectedFont}
                                tabIndex={focusedIndex === index ? 0 : -1}
                                onClick={() => {
                                    onChange(font.family);
                                    setIsOpen(false);
                                    buttonRef.current?.focus();
                                }}
                                onMouseEnter={() => setFocusedIndex(index)}
                                className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-100 focus:bg-slate-100 focus:outline-none ${font.family === selectedFont ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                                    }`}
                            >
                                <span style={{ fontFamily: font.family }}>{font.family}</span>
                                <span className="text-xs text-slate-500 uppercase">{font.category}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

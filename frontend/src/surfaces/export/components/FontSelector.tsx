/**
 * Font Selector Component
 * 
 * Dropdown for selecting fonts in export options
 */

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
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

    const selectedFontOption = availableFonts.find((f) => f.family === selectedFont);

    return (
        <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Font Family</label>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className="w-full flex items-center justify-between px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="absolute z-20 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                        {availableFonts.map((font) => (
                            <button
                                key={font.family}
                                type="button"
                                onClick={() => {
                                    onChange(font.family);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-100 ${font.family === selectedFont ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
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

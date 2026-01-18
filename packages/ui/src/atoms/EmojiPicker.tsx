/**
 * EmojiPicker - Emoji selection component using Radix Popover
 * 
 * Refactored to use Radix UI for reliable positioning and accessibility.
 * Uses @emoji-mart for the actual picker UI.
 */

import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { clsx } from 'clsx';
import { Smile } from 'lucide-react';
import { useState } from 'react';

import { PopoverRoot, PopoverTrigger, PopoverContent } from './Popover';

interface EmojiPickerProps {
    /** Current emoji value (e.g., "📋") */
    value?: string;
    /** Callback when emoji is selected */
    onChange: (emoji: string) => void;
    /** Additional class for the trigger button */
    triggerClassName?: string;
    /** Size of the trigger button */
    size?: 'sm' | 'md' | 'lg';
}

interface EmojiData {
    native: string;
    unified: string;
    id: string;
    shortcodes: string;
}

export function EmojiPicker({ value, onChange, triggerClassName, size = 'md' }: EmojiPickerProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleSelect = (emoji: EmojiData) => {
        onChange(emoji.native);
        setIsOpen(false);
    };

    const sizeClasses = {
        sm: 'w-7 h-7 text-base',
        md: 'w-9 h-9 text-lg',
        lg: 'w-11 h-11 text-xl',
    };

    return (
        <PopoverRoot open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={clsx(
                        'flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors',
                        sizeClasses[size],
                        triggerClassName
                    )}
                    title={value ? 'Change emoji' : 'Select emoji'}
                >
                    {value ? (
                        <span>{value}</span>
                    ) : (
                        <Smile size={size === 'sm' ? 14 : size === 'md' ? 18 : 22} className="text-slate-400" />
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="p-0 overflow-hidden"
                sideOffset={8}
                align="start"
            >
                <Picker
                    data={data}
                    onEmojiSelect={handleSelect}
                    theme="light"
                    previewPosition="none"
                    skinTonePosition="search"
                    maxFrequentRows={2}
                />
            </PopoverContent>
        </PopoverRoot>
    );
}

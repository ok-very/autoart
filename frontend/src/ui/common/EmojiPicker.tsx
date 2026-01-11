import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Smile } from 'lucide-react';
import { clsx } from 'clsx';

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Calculate position when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const pickerHeight = 435; // emoji-mart default height
      const pickerWidth = 352; // emoji-mart default width

      // Position below the trigger, but flip if not enough space
      let top = rect.bottom + 8;
      let left = rect.left;

      // Check if picker would overflow bottom of viewport
      if (top + pickerHeight > window.innerHeight) {
        top = rect.top - pickerHeight - 8;
      }

      // Check if picker would overflow right of viewport
      if (left + pickerWidth > window.innerWidth) {
        left = window.innerWidth - pickerWidth - 16;
      }

      // Ensure left is not negative
      if (left < 16) {
        left = 16;
      }

      setPosition({ top, left });
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

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
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
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

      {isOpen &&
        createPortal(
          <div
            ref={pickerRef}
            className="fixed z-[500] shadow-xl rounded-lg overflow-hidden"
            style={{ top: position.top, left: position.left }}
          >
            <Picker
              data={data}
              onEmojiSelect={handleSelect}
              theme="light"
              previewPosition="none"
              skinTonePosition="search"
              maxFrequentRows={2}
            />
          </div>,
          document.body
        )}
    </>
  );
}

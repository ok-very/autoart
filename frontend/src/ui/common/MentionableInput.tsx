import { useState, useRef, useCallback } from 'react';

import { RecordSearchCombobox } from './RecordSearchCombobox';
import { useCreateReference } from '../../api/hooks';
import type { SearchResult } from '../../types';

interface MentionableInputProps {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  taskId?: string;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  rows?: number;
  /** Whether this field allows # reference triggers. Default: true */
  allowReferences?: boolean;
  /** Current record ID to prevent self-references */
  currentRecordId?: string;
}

interface ComboboxState {
  isOpen: boolean;
  query: string;
  position: { top: number; left: number };
  triggerStart: number;
  cursorPosition: number;
}

/**
 * Get caret coordinates in an input or textarea
 * Creates a hidden mirror element to measure text width
 */
function getCaretCoordinates(
  element: HTMLInputElement | HTMLTextAreaElement,
  position: number
): { top: number; left: number } {
  // Get computed styles
  const computed = window.getComputedStyle(element);

  // Create mirror div
  const mirror = document.createElement('div');
  mirror.style.cssText = `
    position: absolute;
    visibility: hidden;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: ${computed.fontFamily};
    font-size: ${computed.fontSize};
    font-weight: ${computed.fontWeight};
    line-height: ${computed.lineHeight};
    letter-spacing: ${computed.letterSpacing};
    padding: ${computed.padding};
    border: ${computed.border};
    box-sizing: ${computed.boxSizing};
    width: ${element.offsetWidth}px;
  `;

  document.body.appendChild(mirror);

  // Get text up to cursor position
  const textBeforeCursor = element.value.substring(0, position);

  // Create a span to measure cursor position
  const textNode = document.createTextNode(textBeforeCursor);
  const span = document.createElement('span');
  span.textContent = '|';

  mirror.appendChild(textNode);
  mirror.appendChild(span);

  // Get position
  const rect = element.getBoundingClientRect();
  const spanRect = span.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();

  // Calculate relative position
  const left = rect.left + (spanRect.left - mirrorRect.left);
  const top = rect.top + (spanRect.top - mirrorRect.top) + parseInt(computed.lineHeight || '20', 10);

  // Cleanup
  document.body.removeChild(mirror);

  return {
    top: top + window.scrollY,
    left: left + window.scrollX,
  };
}

export function MentionableInput({
  value,
  onChange,
  multiline = false,
  taskId,
  placeholder,
  className = '',
  readOnly = false,
  rows = 3,
  allowReferences = true,
  currentRecordId,
}: MentionableInputProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const createReference = useCreateReference();

  const [combobox, setCombobox] = useState<ComboboxState>({
    isOpen: false,
    query: '',
    position: { top: 0, left: 0 },
    triggerStart: 0,
    cursorPosition: 0,
  });

  // Detect # trigger character
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursorPos = e.target.selectionStart || 0;

      onChange(newValue);

      // Skip trigger detection if references are disabled
      if (!allowReferences) return;

      // Check if we just typed a # trigger
      if (cursorPos > 0) {
        const charBefore = newValue[cursorPos - 1];
        const charBeforeThat = cursorPos > 1 ? newValue[cursorPos - 2] : ' ';

        // Trigger on # preceded by whitespace or start of line
        if (charBefore === '#' && (charBeforeThat === ' ' || charBeforeThat === '\n' || cursorPos === 1)) {
          const position = getCaretCoordinates(e.target, cursorPos);
          setCombobox({
            isOpen: true,
            query: '',
            position,
            triggerStart: cursorPos - 1,
            cursorPosition: cursorPos,
          });
          return;
        }
      }

      // If combobox is open, update the query
      if (combobox.isOpen) {
        const query = newValue.substring(combobox.triggerStart + 1, cursorPos);

        // Close if we detect whitespace or moved too far
        if (query.includes(' ') || query.includes('\n')) {
          setCombobox((prev) => ({ ...prev, isOpen: false }));
        } else {
          setCombobox((prev) => ({
            ...prev,
            query,
            cursorPosition: cursorPos,
          }));
        }
      }
    },
    [onChange, combobox.isOpen, combobox.triggerStart, allowReferences]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (combobox.isOpen && e.key === 'Escape') {
        e.preventDefault();
        setCombobox((prev) => ({ ...prev, isOpen: false }));
      }
    },
    [combobox.isOpen]
  );

  // Handle selection from combobox
  const handleSelect = useCallback(
    async (item: SearchResult, fieldKey?: string) => {
      if (!inputRef.current) return;

      const { triggerStart, cursorPosition } = combobox;

      // Build the mention text
      let mentionText: string;

      if (taskId && item.type === 'record' && fieldKey) {
        // Create a reference for task context
        try {
          await createReference.mutateAsync({
            taskId,
            sourceRecordId: item.id,
            targetFieldKey: fieldKey,
            mode: 'dynamic',
          });
          mentionText = `#${item.name}:${fieldKey}`;
        } catch (err) {
          console.error('Failed to create reference:', err);
          setCombobox((prev) => ({ ...prev, isOpen: false }));
          return;
        }
      } else {
        // Plain text reference (no task context or just record without field)
        mentionText = fieldKey ? `#${item.name}:${fieldKey}` : `#${item.name}`;
      }

      // Replace the trigger + query with the mention text
      const before = value.substring(0, triggerStart);
      const after = value.substring(cursorPosition);
      const newValue = before + mentionText + ' ' + after;

      onChange(newValue);
      setCombobox((prev) => ({ ...prev, isOpen: false }));

      // Restore focus and set cursor after the mention
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const newCursorPos = triggerStart + mentionText.length + 1;
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    },
    [combobox, value, onChange, taskId, createReference]
  );

  const handleClose = useCallback(() => {
    setCombobox((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Base input classes
  const baseClasses = `w-full text-sm border border-slate-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`;
  const disabledClasses = readOnly ? 'bg-slate-50 text-slate-500' : '';

  const inputProps = {
    ref: inputRef as any,
    value,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    placeholder,
    readOnly,
    className: `${baseClasses} ${disabledClasses}`,
  };

  return (
    <div className="relative">
      {multiline ? (
        <textarea
          {...inputProps}
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          rows={rows}
          className={`${baseClasses} ${disabledClasses} resize-y`}
        />
      ) : (
        <input
          {...inputProps}
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
        />
      )}

      {/* Combobox portal */}
      {combobox.isOpen && (
        <RecordSearchCombobox
          query={combobox.query}
          triggerChar="#"
          position={combobox.position}
          onSelect={handleSelect}
          onClose={handleClose}
          showFieldSelection={true}
          excludeRecordId={currentRecordId}
          parentRef={inputRef}
        />
      )}
    </div>
  );
}

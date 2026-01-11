/**
 * FormulaInput - Expression field with #reference autocomplete
 *
 * Features:
 * - Inline autocomplete when typing # or {
 * - Shows available number fields from context
 * - Displays computed value on blur
 * - Formula builder button for complex expressions
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { Calculator, Hash, X } from 'lucide-react';
import {
  evaluateFormula,
  formatFormulaDisplay,
  type ReferenceResolver,
  type FormulaValue,
} from '../../utils/formulaEvaluator';

/**
 * Available field for autocomplete
 */
export interface FormulaField {
  key: string;
  label: string;
  value?: number | null;
}

export interface FormulaInputProps {
  /** Current formula expression */
  value: string;
  /** Called when expression changes */
  onChange: (value: string) => void;
  /** Called when user finishes editing (blur/enter) */
  onCommit?: (formulaValue: FormulaValue) => void;
  /** Available fields for #reference autocomplete */
  availableFields: FormulaField[];
  /** Reference resolver for evaluation */
  resolver: ReferenceResolver;
  /** Placeholder text */
  placeholder?: string;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Show formula builder button */
  showBuilder?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional className */
  className?: string;
}

export function FormulaInput({
  value,
  onChange,
  onCommit,
  availableFields,
  resolver,
  placeholder = 'Enter formula or value...',
  disabled = false,
  showBuilder = true,
  size = 'md',
  className,
}: FormulaInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Sync local value with prop
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value);
    }
  }, [value, isEditing]);

  // Compute current formula value for display
  const formulaValue = useMemo(() => {
    return evaluateFormula(localValue, resolver);
  }, [localValue, resolver]);

  // Filter available fields based on autocomplete query
  const filteredFields = useMemo(() => {
    if (!autocompleteQuery) return availableFields;
    const query = autocompleteQuery.toLowerCase();
    return availableFields.filter(
      (f) =>
        f.key.toLowerCase().includes(query) ||
        f.label.toLowerCase().includes(query)
    );
  }, [availableFields, autocompleteQuery]);

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      const cursor = e.target.selectionStart || 0;
      setLocalValue(newValue);
      setCursorPosition(cursor);

      // Check if we should show autocomplete
      // Look backwards from cursor to find # trigger
      const beforeCursor = newValue.slice(0, cursor);
      const hashMatch = beforeCursor.match(/#(\{)?([a-zA-Z0-9_]*)$/);

      if (hashMatch) {
        setAutocompleteQuery(hashMatch[2] || '');
        setShowAutocomplete(true);
        setSelectedIndex(0);
      } else {
        setShowAutocomplete(false);
      }
    },
    []
  );

  // Insert selected field reference
  const insertReference = useCallback(
    (field: FormulaField) => {
      if (cursorPosition === null || !inputRef.current) return;

      const beforeCursor = localValue.slice(0, cursorPosition);
      const afterCursor = localValue.slice(cursorPosition);

      // Find where the # started
      const hashMatch = beforeCursor.match(/#(\{)?([a-zA-Z0-9_]*)$/);
      if (!hashMatch) return;

      const hashStart = beforeCursor.length - hashMatch[0].length;
      const beforeHash = localValue.slice(0, hashStart);

      // Use braced syntax if key contains dots or special chars
      const needsBraces = /[^a-zA-Z0-9_]/.test(field.key);
      const refString = needsBraces ? `#{${field.key}}` : `#${field.key}`;

      const newValue = beforeHash + refString + afterCursor;
      setLocalValue(newValue);
      setShowAutocomplete(false);

      // Set cursor position after the inserted reference
      const newCursorPos = beforeHash.length + refString.length;
      setTimeout(() => {
        inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
        inputRef.current?.focus();
      }, 0);
    },
    [localValue, cursorPosition]
  );

  // Handle keyboard navigation in autocomplete
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showAutocomplete && filteredFields.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filteredFields.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          insertReference(filteredFields[selectedIndex]);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setShowAutocomplete(false);
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        handleCommit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setLocalValue(value);
        setIsEditing(false);
        setShowAutocomplete(false);
      }
    },
    [showAutocomplete, filteredFields, selectedIndex, insertReference, value]
  );

  // Commit the current value
  const handleCommit = useCallback(() => {
    setIsEditing(false);
    setShowAutocomplete(false);
    onChange(localValue);
    if (onCommit) {
      onCommit(formulaValue);
    }
  }, [localValue, onChange, onCommit, formulaValue]);

  // Handle focus
  const handleFocus = useCallback(() => {
    setIsEditing(true);
  }, []);

  // Handle blur
  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      // Don't blur if clicking on autocomplete
      if (autocompleteRef.current?.contains(e.relatedTarget as Node)) {
        return;
      }
      handleCommit();
    },
    [handleCommit]
  );

  // Open formula builder (hybrid approach - also accessible via button)
  const openFormulaBuilder = useCallback(() => {
    setIsEditing(true);
    inputRef.current?.focus();
    // Insert # to trigger autocomplete
    if (!localValue.includes('#')) {
      setLocalValue(localValue + '#');
      setCursorPosition(localValue.length + 1);
      setShowAutocomplete(true);
      setAutocompleteQuery('');
    }
  }, [localValue]);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };

  return (
    <div className={clsx('relative', className)}>
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={isEditing ? localValue : formatFormulaDisplay(formulaValue)}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className={clsx(
              'w-full rounded-lg border transition-colors font-mono',
              'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500',
              'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
              formulaValue.error
                ? 'border-red-300 bg-red-50'
                : 'border-slate-300',
              sizeClasses[size],
              // Add padding for the hash icon
              'pl-7'
            )}
          />
          <Hash
            size={14}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"
          />
        </div>

        {showBuilder && (
          <button
            type="button"
            onClick={openFormulaBuilder}
            disabled={disabled}
            className={clsx(
              'p-1.5 rounded-lg border border-slate-300 transition-colors',
              'hover:bg-slate-50 hover:border-slate-400',
              'focus:outline-none focus:ring-2 focus:ring-violet-500',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            title="Insert field reference"
          >
            <Calculator size={14} className="text-slate-500" />
          </button>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {showAutocomplete && filteredFields.length > 0 && (
        <div
          ref={autocompleteRef}
          className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          {filteredFields.map((field, index) => (
            <button
              key={field.key}
              type="button"
              onClick={() => insertReference(field)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={clsx(
                'w-full px-3 py-2 text-left text-sm flex items-center justify-between gap-2',
                'hover:bg-slate-50 transition-colors',
                index === selectedIndex && 'bg-violet-50'
              )}
            >
              <span className="flex items-center gap-2">
                <Hash size={12} className="text-violet-500" />
                <span className="font-medium text-slate-700">{field.label}</span>
                <span className="text-slate-400 font-mono text-xs">
                  {field.key}
                </span>
              </span>
              {field.value !== null && field.value !== undefined && (
                <span className="text-slate-500 text-xs">
                  {typeof field.value === 'number'
                    ? field.value.toLocaleString()
                    : field.value}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No matches message */}
      {showAutocomplete && filteredFields.length === 0 && autocompleteQuery && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg p-3">
          <p className="text-sm text-slate-500 text-center">
            No number fields matching "{autocompleteQuery}"
          </p>
        </div>
      )}

      {/* Error message */}
      {formulaValue.error && !isEditing && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <X size={12} />
          {formulaValue.error}
        </p>
      )}

      {/* Show formula when displaying computed value */}
      {!isEditing &&
        formulaValue.resolvedValue !== null &&
        formulaValue.references.length > 0 && (
          <p className="mt-1 text-xs text-slate-400 font-mono truncate">
            = {localValue}
          </p>
        )}
    </div>
  );
}

/**
 * @deprecated Use `ui/molecules/EditableCell` instead.
 * This version uses raw FieldDef; the modern version uses FieldViewModel.
 * Only retained for legacy DataTable compatibility.
 */
import { clsx } from 'clsx';
import { Check, X } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';

import type { FieldDef } from '../../types';
import { TASK_STATUS_CONFIG } from '../../utils/nodeMetadata';
import { DataFieldWidget, type DataFieldKind } from '../../ui/molecules/DataFieldWidget';

export interface EditableCellProps {
    /** Field definition from schema */
    field: FieldDef & { renderAs?: string; width?: number | 'flex' };
    /** Current value */
    value: unknown;
    /** Called when value changes */
    onChange: (key: string, value: unknown) => void;
    /** Whether editing is allowed */
    editable?: boolean;
    /** Optional className */
    className?: string;
}

/**
 * EditableCell - A table cell that displays a value and allows inline editing
 * Modular design for reuse in nested tables
 */
export function EditableCell({
    field,
    value,
    onChange,
    editable = true,
    className,
}: EditableCellProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [localEditValue, setLocalEditValue] = useState<unknown>(value);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

    // When not editing, show external value; when editing, show local value
    const editValue = isEditing ? localEditValue : value;
    const setEditValue = setLocalEditValue;

    // Focus input when entering edit mode
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            if ('select' in inputRef.current) {
                inputRef.current.select();
            }
        }
    }, [isEditing]);

    const handleSave = useCallback(() => {
        setIsEditing(false);
        if (editValue !== value) {
            onChange(field.key, editValue);
        }
    }, [field.key, editValue, value, onChange]);

    const handleCancel = useCallback(() => {
        setIsEditing(false);
        setEditValue(value);
    }, [value, setEditValue]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSave();
            } else if (e.key === 'Escape') {
                handleCancel();
            }
        },
        [handleSave, handleCancel]
    );

    const handleDoubleClick = useCallback(() => {
        if (editable) {
            setIsEditing(true);
        }
    }, [editable]);

    const renderAs = (field.renderAs || field.type || 'text') as DataFieldKind;
    const width = typeof field.width === 'number' ? `${field.width}px` : undefined;

    // Read-only display mode
    if (!isEditing) {
        return (
            <div
                className={clsx(
                    'px-2 py-1 min-h-[32px] flex items-center cursor-pointer hover:bg-ws-bg transition-colors rounded',
                    editable && 'hover:ring-1 hover:ring-slate-200',
                    className
                )}
                style={{ width }}
                onDoubleClick={handleDoubleClick}
                title={editable ? 'Double-click to edit' : undefined}
            >
                <DataFieldWidget kind={renderAs} value={value} />
            </div>
        );
    }

    // Editing mode - render appropriate input based on field type
    const renderEditInput = () => {
        const baseInputClass =
            'w-full px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400';

        switch (field.type) {
            case 'status':
                return (
                    <select
                        ref={inputRef as React.RefObject<HTMLSelectElement>}
                        value={(editValue as string) || 'empty'}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className={baseInputClass}
                    >
                        {Object.entries(TASK_STATUS_CONFIG).map(([key, cfg]) => (
                            <option key={key} value={key}>
                                {cfg.label || key}
                            </option>
                        ))}
                    </select>
                );

            case 'select':
                return (
                    <select
                        ref={inputRef as React.RefObject<HTMLSelectElement>}
                        value={(editValue as string) || ''}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className={baseInputClass}
                    >
                        <option value="">-- Select --</option>
                        {(field.options || []).map((opt) => (
                            <option key={opt} value={opt}>
                                {opt}
                            </option>
                        ))}
                    </select>
                );

            case 'number':
            case 'percent':
                return (
                    <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type="number"
                        value={editValue as number || ''}
                        onChange={(e) => setEditValue(e.target.value ? Number(e.target.value) : null)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className={baseInputClass}
                        min={field.type === 'percent' ? 0 : undefined}
                        max={field.type === 'percent' ? 100 : undefined}
                    />
                );

            case 'date':
                return (
                    <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type="date"
                        value={(editValue as string) || ''}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className={baseInputClass}
                    />
                );

            case 'checkbox':
                return (
                    <div className="flex items-center gap-2 px-2">
                        <input
                            ref={inputRef as React.RefObject<HTMLInputElement>}
                            type="checkbox"
                            checked={Boolean(editValue)}
                            onChange={(e) => {
                                setEditValue(e.target.checked);
                                // Auto-save for checkbox
                                onChange(field.key, e.target.checked);
                                setIsEditing(false);
                            }}
                            className="w-4 h-4"
                        />
                    </div>
                );

            case 'textarea':
                return (
                    <div className="relative">
                        <textarea
                            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                            value={(editValue as string) || ''}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className={clsx(baseInputClass, 'min-h-[60px] resize-y')}
                            rows={3}
                        />
                        <div className="flex justify-end gap-1 mt-1">
                            <button
                                onClick={handleCancel}
                                className="p-1 rounded hover:bg-slate-100 text-ws-text-secondary"
                            >
                                <X size={14} />
                            </button>
                            <button
                                onClick={handleSave}
                                className="p-1 rounded hover:bg-blue-100 text-blue-600"
                            >
                                <Check size={14} />
                            </button>
                        </div>
                    </div>
                );

            case 'tags':
                // Tags need a special comma-separated input
                return (
                    <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type="text"
                        value={Array.isArray(editValue) ? (editValue as string[]).join(', ') : ''}
                        onChange={(e) =>
                            setEditValue(
                                e.target.value
                                    .split(',')
                                    .map((t) => t.trim())
                                    .filter(Boolean)
                            )
                        }
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className={baseInputClass}
                        placeholder="tag1, tag2, tag3"
                    />
                );

            case 'user':
                // User field - simple text input for now, can be enhanced with search
                return (
                    <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type="text"
                        value={
                            typeof editValue === 'string'
                                ? editValue
                                : (editValue as { name?: string })?.name || ''
                        }
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className={baseInputClass}
                        placeholder="Enter name or email"
                    />
                );

            default:
                // text, email, url, link
                return (
                    <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                        value={(editValue as string) || ''}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className={baseInputClass}
                    />
                );
        }
    };

    return (
        <div className={clsx('relative', className)} style={{ width }}>
            {renderEditInput()}
        </div>
    );
}

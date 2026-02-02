/**
 * EditableCell - Molecule for inline table cell editing
 * 
 * This is a molecule that:
 * - Accepts a FieldViewModel (not raw FieldDef)
 * - Displays value in read mode, switches to edit on double-click
 * - Delegates display to DataFieldWidget
 * - No API calls - pure presentational with callbacks
 */

import { clsx } from 'clsx';
import { Check, X } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';


import { TASK_STATUS_CONFIG } from '@autoart/shared';
import type { FieldViewModel } from '@autoart/shared/domain';

import { DataFieldWidget, type DataFieldKind } from './DataFieldWidget';

export interface EditableCellProps {
    /** Field view model with all display state */
    viewModel: FieldViewModel;
    /** Called when value is saved */
    onSave: (fieldId: string, value: unknown) => void;
    /** Width override */
    width?: number | string;
    /** Optional className */
    className?: string;
    /**
     * Enable text wrapping in display mode.
     * When true, text wraps and cell height adjusts.
     * Default: false
     */
    wrapText?: boolean;
}

/**
 * EditableCell - A table cell that displays a value and allows inline editing
 * 
 * Double-click to edit, Enter to save, Escape to cancel.
 */
export function EditableCell({
    viewModel,
    onSave,
    width,
    className,
    wrapText = false,
}: EditableCellProps) {
    const { fieldId, value, type, editable, options } = viewModel;

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
            onSave(fieldId, editValue);
        }
    }, [fieldId, editValue, value, onSave]);

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

    const renderAs = type as DataFieldKind;
    const cellWidth = typeof width === 'number' ? `${width}px` : width;

    // Read-only display mode
    if (!isEditing) {
        return (
            <div
                className={clsx(
                    'px-2 py-1 min-h-[32px] flex cursor-pointer hover:bg-ws-bg transition-colors rounded',
                    // Vertical alignment: start for wrapping content, center for truncated
                    wrapText ? 'items-start' : 'items-center',
                    editable && 'hover:ring-1 hover:ring-slate-200',
                    className
                )}
                style={{ width: cellWidth }}
                onDoubleClick={handleDoubleClick}
                title={editable ? 'Double-click to edit' : undefined}
            >
                <DataFieldWidget kind={renderAs} value={value} wrapText={wrapText} />
            </div>
        );
    }

    // Editing mode - render appropriate input based on renderHint, then type
    const renderEditInput = () => {
        const baseInputClass =
            'w-full px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400';

        const { renderHint } = viewModel;

        // ========== RENDER HINT DISPATCH (priority) ==========

        // Email hint - native email input
        if (renderHint === 'email') {
            return (
                <input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type="email"
                    value={(editValue as string) || ''}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    className={baseInputClass}
                    placeholder="email@example.com"
                />
            );
        }

        // Phone hint - tel input for mobile keyboards
        if (renderHint === 'phone') {
            return (
                <input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type="tel"
                    value={(editValue as string) || ''}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    className={baseInputClass}
                    placeholder="+1 (555) 123-4567"
                />
            );
        }

        // URL hint
        if (renderHint === 'url') {
            return (
                <input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type="url"
                    value={(editValue as string) || ''}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    className={baseInputClass}
                    placeholder="https://..."
                />
            );
        }

        // ========== TYPE-BASED DISPATCH ==========

        switch (type) {
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
                        {(options || []).map((opt) => (
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
                        min={type === 'percent' ? 0 : undefined}
                        max={type === 'percent' ? 100 : undefined}
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
                                onSave(fieldId, e.target.checked);
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
                // User field - simple text input for inline editing
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
                        type={type === 'email' ? 'email' : type === 'url' ? 'url' : 'text'}
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
        <div className={clsx('relative', className)} style={{ width: cellWidth }}>
            {renderEditInput()}
        </div>
    );
}

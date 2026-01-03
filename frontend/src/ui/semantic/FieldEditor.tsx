/**
 * FieldEditor - Semantic Component for editing a single domain field
 *
 * Responsibilities:
 * - Fetches data (FieldViewModel)
 * - Renders the appropriate UI molecule (FieldRenderer)
 * - Handles validation and persistence
 * - Manages optimistic UI updates
 *
 * Design Rules:
 * - NO onChange prop (internally managed)
 * - NO inline API calls (delegated to semantic layer logic)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { useRecordFieldViewModels } from '../composites/hooks/useDomain';
import { FieldRenderer, type FieldRendererCallbacks } from '../molecules/FieldRenderer';
import { useUpdateRecord } from '../../api/hooks';
import { ReferenceEditor } from './ReferenceEditor';
import { UserMentionInput } from '../composites/UserMentionInput';
import { RichTextEditor } from '../../components/editor/RichTextEditor';
import type { FieldViewModel } from '@autoart/shared/domain';

export interface FieldEditorProps {
    /** ID of the record to edit */
    recordId: string;
    /** Key of the field to edit */
    fieldId: string;
    /** Optional class name */
    className?: string;
    /** Whether to show the label (defaults to false for pure editor) */
    showLabel?: boolean;
}

export function FieldEditor({
    recordId,
    fieldId,
    className,
    showLabel = false,
}: FieldEditorProps) {
    // 1. Data Fetching
    const { viewModels, record, isLoading } = useRecordFieldViewModels(recordId);
    const updateRecord = useUpdateRecord();

    // 2. Local State for Optimistic Updates
    const [localValue, setLocalValue] = useState<unknown>(undefined);
    const [isDirty, setIsDirty] = useState(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Find the specific field view model
    const viewModel = viewModels.find((vm) => vm.fieldId === fieldId);

    // Sync local state with remote data when not dirty
    useEffect(() => {
        if (!isDirty && viewModel) {
            setLocalValue(viewModel.value);
        }
    }, [viewModel, isDirty]);

    // 3. Persistence Logic
    const handleSave = useCallback(
        (newValue: unknown) => {
            if (!record) return;

            // Optimistic update
            setLocalValue(newValue);
            setIsDirty(true);

            // Debounce save
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }

            saveTimerRef.current = setTimeout(() => {
                updateRecord.mutate(
                    {
                        id: recordId,
                        data: {
                            ...record.data,
                            [fieldId]: newValue,
                        },
                    },
                    {
                        onSuccess: () => {
                            setIsDirty(false);
                        },
                        onError: (error) => {
                            // TODO: Add proper error handling/rollback
                            console.error('Failed to save field:', error);
                            setIsDirty(false);
                        },
                    }
                );
            }, 1000); // 1s debounce
        },
        [record, recordId, fieldId, updateRecord]
    );

    // 4. Callbacks for Complex Fields
    const fieldCallbacks: FieldRendererCallbacks = {
        renderLinkField: (vm: FieldViewModel, onChange: (value: unknown) => void) => (
            <ReferenceEditor
                value={vm.value as string}
                fieldKey={vm.fieldId}
                currentRecordId={recordId}
                onChange={onChange}
                readOnly={!vm.editable}
            />
        ),
        renderUserField: (vm: FieldViewModel, onChange: (value: unknown) => void) => (
            <UserMentionInput
                value={vm.value}
                onChange={onChange}
                readOnly={!vm.editable}
            />
        ),
        renderRichText: (vm: FieldViewModel, onChange: (value: unknown) => void, _multiline: boolean) => (
            <div className="border border-slate-200 rounded-md bg-white p-1 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
                <RichTextEditor
                    content={vm.value}
                    taskId={recordId} // RichTextEditor uses taskId for context, passing recordId as fallback
                    onChange={onChange}
                />
            </div>
        ),
    };

    // 5. Render
    if (isLoading) {
        return <div className="animate-pulse h-8 bg-slate-100 rounded w-full" />;
    }

    if (!viewModel) {
        return (
            <div className="text-xs text-red-500">
                Field "{fieldId}" not found
            </div>
        );
    }

    // Use local value for rendering if dirty, otherwise view model value
    const displayViewModel: FieldViewModel = {
        ...viewModel,
        value: isDirty ? localValue : viewModel.value,
    };

    return (
        <div className={clsx('relative', className)}>
            {showLabel && (
                <label className="block text-xs font-medium text-slate-500 mb-1">
                    {viewModel.label}
                    {viewModel.required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            <FieldRenderer
                viewModel={displayViewModel}
                onChange={handleSave}
                callbacks={fieldCallbacks}
                className={clsx(isDirty && 'border-amber-300 ring-1 ring-amber-100')}
            />
            {isDirty && (
                <div className="absolute top-0 right-0 -mt-1 -mr-1 w-2 h-2 bg-amber-400 rounded-full shadow-sm" />
            )}
        </div>
    );
}

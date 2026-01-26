/**
 * ComposerSurface Component
 *
 * The unified, canonical composer UI for declaring Actions.
 * Used by both ComposerPage (page mode) and drawer contexts (drawer mode).
 *
 * @deprecated For new usage, prefer InspectorFooterComposer in the unified inspector.
 * This component is retained for ComposerPage and legacy drawer contexts.
 *
 * Core principles:
 * - Schema-first: Action types come from definitions with kind='action_arrangement'
 * - References are first-class inputs with named slots
 * - Events are emitted, not stored directly (immutable facts)
 *
 * Sections:
 * 1. Project Context - Select project → subprocess
 * 2. Action Definition - Pick action recipe, title, description
 * 3. Referenced Records - Link records to named slots
 * 4. Action Inputs - Schema-driven fields from recipe
 */

import { clsx } from 'clsx';
import {
    Wand2,
    X,
    Plus,
    Trash2,
    Link as LinkIcon,
    Sparkles,
    CheckCircle2,
} from 'lucide-react';
import { useState, useMemo, useCallback, useEffect } from 'react';

import type { DataRecord, SchemaConfig } from '@autoart/shared';

import {
    useRecordDefinitions,
    useProjects,
    useProjectTree,
    useRecords,
    useCompose,
    useSubprocesses,
} from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';

// ==================== TYPES ====================

export interface ComposerSurfaceProps {
    /** Display mode: page (full-page) or drawer (slide-out panel) */
    mode: 'page' | 'drawer' | 'inline';
    /** Pre-selected context ID */
    contextId?: string;
    /** Context type (defaults to subprocess) */
    contextType?: 'subprocess' | 'stage' | 'process' | 'project';
    /** Pre-selected project ID */
    projectId?: string;
    /** Callback when action is created successfully */
    onSuccess?: (actionId: string) => void;
    /** Callback to close drawer mode */
    onClose?: () => void;
    /** Pre-selected action recipe ID or name */
    defaultRecipe?: string;
}

interface LinkedRecord {
    record: DataRecord;
    targetFieldKey: string;
}

interface FieldValue {
    key: string;
    value: string;
}

// ==================== MAIN COMPONENT ====================

export function ComposerSurface({
    mode = 'page',
    contextId: initialContextId,
    contextType = 'subprocess',
    projectId: initialProjectId,
    onSuccess,
    onClose,
    defaultRecipe,
}: ComposerSurfaceProps) {
    // ==================== STATE ====================

    const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [fieldValues, setFieldValues] = useState<FieldValue[]>([]);
    const [linkedRecords, setLinkedRecords] = useState<LinkedRecord[]>([]);
    const [_showAdvanced, _setShowAdvanced] = useState(false);
    const [showRecordPicker, setShowRecordPicker] = useState(false);
    const [currentSlot, setCurrentSlot] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Context selection
    const { activeProjectId, setActiveProject } = useUIStore();
    const [selectedSubprocessId, setSelectedSubprocessId] = useState<string | null>(
        initialContextId || null
    );

    // ==================== DATA HOOKS ====================

    const { data: projects } = useProjects();
    const { data: allDefinitions } = useRecordDefinitions();
    const currentProjectId = initialProjectId || activeProjectId;
    useProjectTree(currentProjectId); // Trigger project tree preload
    const { data: allRecords } = useRecords();
    const { data: containerSubprocesses } = useSubprocesses(currentProjectId);
    const compose = useCompose();

    // ==================== DERIVED DATA ====================

    // Filter definitions to only action_arrangement kind
    const actionRecipes = useMemo(() => {
        if (!allDefinitions) return [];
        return allDefinitions.filter((d) => d.kind === 'action_arrangement');
    }, [allDefinitions]);

    // Get selected recipe
    const selectedRecipe = useMemo(() => {
        if (!selectedRecipeId || !actionRecipes.length) return null;
        return actionRecipes.find((r) => r.id === selectedRecipeId || r.name === selectedRecipeId) || null;
    }, [selectedRecipeId, actionRecipes]);

    // Extract schema fields from selected recipe
    const recipeFields = useMemo(() => {
        if (!selectedRecipe?.schema_config) return [];
        const config = selectedRecipe.schema_config as SchemaConfig;
        // Filter out title and description as they're handled separately
        return (config.fields || []).filter(
            (f) => f.key !== 'title' && f.key !== 'description' && f.key !== 'status'
        );
    }, [selectedRecipe]);

    // Note: referenceSlots will be used when recipe.referenceSlots is implemented
    // For now, the default slot 'related_record' is used in handleAddRecord

    // Get subprocesses from container actions API
    // These are action-based containers, not legacy hierarchy nodes
    const subprocesses = useMemo(() => containerSubprocesses || [], [containerSubprocesses]);

    // Auto-select first subprocess
    useEffect(() => {
        if (subprocesses.length > 0 && !selectedSubprocessId) {
            setSelectedSubprocessId(subprocesses[0].id);
        }
    }, [subprocesses, selectedSubprocessId]);

    // Auto-select default recipe
    useEffect(() => {
        if (defaultRecipe && actionRecipes.length > 0 && !selectedRecipeId) {
            const match = actionRecipes.find(
                (r) => r.id === defaultRecipe || r.name === defaultRecipe
            );
            if (match) setSelectedRecipeId(match.id);
        }
    }, [defaultRecipe, actionRecipes, selectedRecipeId]);

    // Get selected subprocess
    const selectedSubprocess = useMemo(() => {
        if (!selectedSubprocessId || !subprocesses.length) return null;
        const sp = subprocesses.find((s) => s.id === selectedSubprocessId);
        if (!sp) return null;
        // Extract title from fieldBindings
        const titleBinding = (sp.fieldBindings as Array<{ fieldKey: string; value?: unknown }>)?.find((b) => b.fieldKey === 'title');
        return {
            id: sp.id,
            title: String(titleBinding?.value || sp.type || 'Subprocess'),
        };
    }, [selectedSubprocessId, subprocesses]);

    // ==================== HANDLERS ====================

    const handleFieldChange = useCallback((key: string, value: string) => {
        setFieldValues((prev) => {
            const existing = prev.findIndex((f) => f.key === key);
            if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = { key, value };
                return updated;
            }
            return [...prev, { key, value }];
        });
    }, []);

    const handleAddRecord = useCallback(
        (record: DataRecord) => {
            if (!currentSlot) return;
            setLinkedRecords((prev) => [
                ...prev,
                { record, targetFieldKey: currentSlot },
            ]);
            setShowRecordPicker(false);
            setCurrentSlot(null);
        },
        [currentSlot]
    );

    const handleRemoveRecord = useCallback((index: number) => {
        setLinkedRecords((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !selectedSubprocessId || !selectedRecipe) return;

        try {
            // Build field bindings from title, description, and recipe fields
            const fieldBindings = [
                { fieldKey: 'title' },
                ...(description ? [{ fieldKey: 'description' }] : []),
                ...fieldValues.filter((f) => f.value).map((f) => ({ fieldKey: f.key })),
            ];

            // Build field value events
            const fieldValueEvents = [
                { fieldName: 'title', value: title.trim() },
                ...(description ? [{ fieldName: 'description', value: description.trim() }] : []),
                ...fieldValues.filter((f) => f.value).map((f) => ({ fieldName: f.key, value: f.value })),
            ];

            // Build references (only include if non-empty)
            const references = linkedRecords.length > 0
                ? linkedRecords.map((lr) => ({
                    sourceRecordId: lr.record.id,
                    targetFieldKey: lr.targetFieldKey,
                    mode: 'dynamic' as const,
                }))
                : undefined;

            // Compose action
            const result = await compose.mutateAsync({
                action: {
                    contextId: selectedSubprocessId,
                    contextType: contextType,
                    type: selectedRecipe.name,
                    fieldBindings: fieldBindings.length > 0 ? fieldBindings : [{ fieldKey: 'title' }],
                },
                fieldValues: fieldValueEvents,
                ...(references ? { references } : {}),
            });

            // Reset form on success
            setTitle('');
            setDescription('');
            setFieldValues([]);
            setLinkedRecords([]);

            // Show success message
            const actionType = selectedRecipe?.name || 'Action';
            setSuccessMessage(`${actionType} created successfully!`);
            setTimeout(() => setSuccessMessage(null), 4000);

            if (onSuccess && result.action?.id) {
                onSuccess(result.action.id);
            }
        } catch (err) {
            setSuccessMessage(null);
            console.error('Failed to compose action:', err);
        }
    };

    const isLoading = compose.isPending;
    const error = compose.error;

    // Keyboard shortcuts (Ctrl+Enter to submit)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                if (title.trim() && selectedSubprocessId && selectedRecipe && !isLoading) {
                    e.preventDefault();
                    // Submit form programmatically
                    const form = document.querySelector('.composer-surface form') as HTMLFormElement;
                    form?.requestSubmit();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [title, selectedSubprocessId, selectedRecipe, isLoading]);

    // ==================== RENDER ====================

    const containerClass = clsx('composer-surface', {
        'h-full': mode === 'page' || mode === 'drawer',
        'rounded-lg border border-slate-200': mode === 'inline',
    });

    return (
        <div className={containerClass}>
            {/* Header */}
            {mode !== 'inline' && (
                <div className="composer-header">
                    <div className="composer-header-title">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                            <Wand2 size={20} />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-slate-900">Composer</h1>
                            <p className="text-xs text-slate-500">Declare intent with Actions + Events</p>
                        </div>
                    </div>
                    <div className="composer-header-actions">
                        {mode === 'drawer' && onClose && (
                            <button onClick={onClose} className="composer-btn-ghost rounded-lg p-2">
                                <X size={20} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Body */}
            <div className={clsx('composer-body', { 'custom-scroll': mode !== 'inline' })}>
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Section 1: Project Context */}
                    <div className="composer-section composer-fade-in">
                        <div className="composer-section-header">
                            <div className="composer-section-badge">1</div>
                            <div className="composer-section-title">Project Context</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="composer-input-group">
                                <label className="composer-label">Project</label>
                                <select
                                    value={currentProjectId || ''}
                                    onChange={(e) => {
                                        setActiveProject(e.target.value);
                                        setSelectedSubprocessId(null);
                                    }}
                                    className="composer-select"
                                >
                                    <option value="">Select a project...</option>
                                    {projects?.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="composer-input-group">
                                <label className="composer-label">Subprocess (Context)</label>
                                <select
                                    value={selectedSubprocessId || ''}
                                    onChange={(e) => setSelectedSubprocessId(e.target.value)}
                                    disabled={!currentProjectId}
                                    className="composer-select"
                                >
                                    <option value="">Select a subprocess...</option>
                                    {subprocesses.map((sp: { id: string; type: string; fieldBindings: unknown[] }) => {
                                        const titleBinding = (sp.fieldBindings as Array<{ fieldKey: string; value?: unknown }>)?.find((b) => b.fieldKey === 'title');
                                        const displayTitle = String(titleBinding?.value || sp.type || 'Subprocess');
                                        return (
                                            <option key={sp.id} value={sp.id}>
                                                {displayTitle}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Action Definition */}
                    <div className="composer-section composer-section-accent-blue composer-slide-up">
                        <div className="composer-section-header">
                            <div className="composer-section-badge">2</div>
                            <div className="composer-section-title">Action Definition</div>
                            <div className="composer-section-subtitle">
                                {actionRecipes.length} recipe{actionRecipes.length !== 1 ? 's' : ''} available
                            </div>
                        </div>

                        {/* Recipe Grid */}
                        <div className="composer-recipe-grid mb-4">
                            {actionRecipes.map((recipe) => {
                                const isSelected = selectedRecipeId === recipe.id;
                                const styling = recipe.styling as { icon?: string; color?: string } | undefined;
                                return (
                                    <button
                                        key={recipe.id}
                                        type="button"
                                        onClick={() => setSelectedRecipeId(recipe.id)}
                                        className={clsx('composer-recipe-card', { selected: isSelected })}
                                    >
                                        <div
                                            className="composer-recipe-icon"
                                            style={{
                                                background: isSelected
                                                    ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                                                    : undefined,
                                                color: isSelected ? '#fff' : undefined,
                                            }}
                                        >
                                            {styling?.icon || recipe.name.charAt(0)}
                                        </div>
                                        <div className="composer-recipe-name">{recipe.name}</div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Title & Description */}
                        <div className="space-y-4">
                            <div className="composer-input-group">
                                <label className="composer-label">
                                    Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder={`Enter ${selectedRecipe?.name || 'action'} title...`}
                                    className="composer-input"
                                    autoFocus={mode === 'page'}
                                />
                            </div>
                            <div className="composer-input-group">
                                <label className="composer-label">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Optional description..."
                                    className="composer-textarea"
                                    rows={3}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Referenced Records */}
                    <div className="composer-section composer-section-accent-green composer-slide-up">
                        <div className="composer-section-header">
                            <div className="composer-section-badge">3</div>
                            <div className="composer-section-title">Referenced Records</div>
                            <div className="composer-section-subtitle">
                                Link to existing data
                            </div>
                        </div>

                        {/* Linked Records List */}
                        {linkedRecords.length > 0 && (
                            <div className="space-y-2 mb-4">
                                {linkedRecords.map((lr, idx) => (
                                    <div key={idx} className="composer-record-card">
                                        <div className="composer-record-card-icon">
                                            <LinkIcon size={14} />
                                        </div>
                                        <div className="composer-record-card-content">
                                            <div className="composer-record-card-name">
                                                {lr.record.unique_name}
                                            </div>
                                            <div className="composer-record-card-type">
                                                Slot: {lr.targetFieldKey}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveRecord(idx)}
                                            className="composer-slot-selector hover:text-red-500"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add Reference Button */}
                        <button
                            type="button"
                            onClick={() => {
                                setCurrentSlot('related_record');
                                setShowRecordPicker(true);
                            }}
                            className="composer-add-btn"
                        >
                            <Plus size={16} />
                            Link a Record
                        </button>

                        {/* Record Picker Modal (simplified) */}
                        {showRecordPicker && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[70vh] overflow-hidden">
                                    <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                                        <h3 className="font-semibold text-slate-900">Select Record</h3>
                                        <button
                                            type="button"
                                            onClick={() => setShowRecordPicker(false)}
                                            className="p-1 hover:bg-slate-100 rounded"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <div className="max-h-[50vh] overflow-y-auto p-4 space-y-2">
                                        {allRecords?.slice(0, 20).map((record) => (
                                            <button
                                                key={record.id}
                                                type="button"
                                                onClick={() => handleAddRecord(record)}
                                                className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
                                            >
                                                <div className="font-medium text-slate-900">
                                                    {record.unique_name}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    ID: {record.id.slice(0, 8)}...
                                                </div>
                                            </button>
                                        ))}
                                        {(!allRecords || allRecords.length === 0) && (
                                            <div className="composer-empty-state">
                                                <div className="composer-empty-icon">📭</div>
                                                <div className="composer-empty-text">No records found</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Section 4: Action Inputs (Schema-driven) */}
                    {selectedRecipe && recipeFields.length > 0 && (
                        <div className="composer-section composer-section-dashed composer-slide-up">
                            <div className="composer-section-header">
                                <div className="composer-section-badge">4</div>
                                <div className="composer-section-title">Action Inputs</div>
                                <div className="composer-section-subtitle">
                                    From {selectedRecipe.name} schema
                                </div>
                            </div>
                            <div className="composer-field-grid">
                                {recipeFields.map((field) => (
                                    <div
                                        key={field.key}
                                        className={clsx('composer-input-group', {
                                            'composer-field-grid-full':
                                                field.type === 'textarea',
                                        })}
                                    >
                                        <label className="composer-label">
                                            {field.label || field.key}
                                            {field.required && (
                                                <span className="text-red-500 ml-1">*</span>
                                            )}
                                        </label>
                                        {field.type === 'textarea' ? (
                                            <textarea
                                                value={
                                                    fieldValues.find((f) => f.key === field.key)
                                                        ?.value || ''
                                                }
                                                onChange={(e) =>
                                                    handleFieldChange(field.key, e.target.value)
                                                }
                                                placeholder={`Enter ${field.label || field.key}...`}
                                                className="composer-textarea"
                                                rows={3}
                                            />
                                        ) : field.type === 'date' ? (
                                            <input
                                                type="date"
                                                value={
                                                    fieldValues.find((f) => f.key === field.key)
                                                        ?.value || ''
                                                }
                                                onChange={(e) =>
                                                    handleFieldChange(field.key, e.target.value)
                                                }
                                                className="composer-input"
                                            />
                                        ) : field.type === 'number' ? (
                                            <input
                                                type="number"
                                                value={
                                                    fieldValues.find((f) => f.key === field.key)
                                                        ?.value || ''
                                                }
                                                onChange={(e) =>
                                                    handleFieldChange(field.key, e.target.value)
                                                }
                                                placeholder="0"
                                                className="composer-input"
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                value={
                                                    fieldValues.find((f) => f.key === field.key)
                                                        ?.value || ''
                                                }
                                                onChange={(e) =>
                                                    handleFieldChange(field.key, e.target.value)
                                                }
                                                placeholder={`Enter ${field.label || field.key}...`}
                                                className="composer-input"
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Action Preview Panel (Always visible when form has content) */}
                    {(title || description || fieldValues.some(f => f.value) || linkedRecords.length > 0) && (
                        <div className="composer-section composer-section-accent-purple composer-slide-up">
                            <div className="composer-section-header">
                                <div className="composer-section-badge">
                                    <Sparkles size={12} />
                                </div>
                                <div className="composer-section-title">Action Preview</div>
                                <div className="composer-section-subtitle">
                                    What will happen when you create
                                </div>
                            </div>
                            <div className="composer-events-preview">
                                <div className="composer-event-item">
                                    <span className="composer-event-type">ACTION_DECLARED</span>
                                    <span className="composer-event-payload">
                                        type: "{selectedRecipe?.name || 'TASK'}"
                                    </span>
                                </div>
                                {title && (
                                    <div className="composer-event-item">
                                        <span className="composer-event-type">FIELD_VALUE_RECORDED</span>
                                        <span className="composer-event-payload">
                                            field: "title", value: "{title}"
                                        </span>
                                    </div>
                                )}
                                {description && (
                                    <div className="composer-event-item">
                                        <span className="composer-event-type">FIELD_VALUE_RECORDED</span>
                                        <span className="composer-event-payload">
                                            field: "description", value: "..."
                                        </span>
                                    </div>
                                )}
                                {fieldValues
                                    .filter((f) => f.value)
                                    .map((f) => (
                                        <div key={f.key} className="composer-event-item">
                                            <span className="composer-event-type">
                                                FIELD_VALUE_RECORDED
                                            </span>
                                            <span className="composer-event-payload">
                                                field: "{f.key}", value: "{f.value}"
                                            </span>
                                        </div>
                                    ))}
                                {linkedRecords.map((lr, idx) => (
                                    <div key={idx} className="composer-event-item">
                                        <span className="composer-event-type">ACTION_REFERENCE_ADDED</span>
                                        <span className="composer-event-payload">
                                            slot: "{lr.targetFieldKey}", record: "{lr.record.unique_name}"
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Success */}
                    {successMessage && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-green-500" />
                            {successMessage}
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {(error as Error).message || 'Failed to create action'}
                        </div>
                    )}

                    {/* Submit Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                        <div className="text-sm text-slate-500">
                            {selectedRecipe && selectedSubprocess ? (
                                <>
                                    Creating <strong>{selectedRecipe.name}</strong> in{' '}
                                    <strong>{selectedSubprocess.title}</strong>
                                </>
                            ) : (
                                'Select a recipe and context to continue'
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={
                                !title.trim() || !selectedSubprocessId || !selectedRecipe || isLoading
                            }
                            className="composer-btn composer-btn-success"
                        >
                            {isLoading ? (
                                <>
                                    <span className="animate-spin">⏳</span>
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={16} />
                                    Create Action
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ==================== INLINE VARIANT ====================

export interface InlineComposerProps {
    contextId: string;
    onSuccess?: (actionId: string) => void;
    placeholder?: string;
}

/**
 * Simplified inline composer for quick task creation.
 * Uses ComposerSurface internally with inline mode.
 */
export function InlineComposer({ contextId, onSuccess, placeholder }: InlineComposerProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!isExpanded) {
        return (
            <button
                onClick={() => setIsExpanded(true)}
                className="w-full p-3 text-left text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg border border-dashed border-slate-200 transition-all"
            >
                <Plus size={14} className="inline mr-2" />
                {placeholder || 'Add a task...'}
            </button>
        );
    }

    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
            <ComposerSurface
                mode="inline"
                contextId={contextId}
                onSuccess={(actionId) => {
                    setIsExpanded(false);
                    onSuccess?.(actionId);
                }}
                onClose={() => setIsExpanded(false)}
                defaultRecipe="Task"
            />
        </div>
    );
}

export default ComposerSurface;

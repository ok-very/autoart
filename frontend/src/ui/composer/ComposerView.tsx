/**
 * ComposerView Component
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

/** Reference slot for linking records to an action arrangement */
interface ReferenceSlot {
    key: string;
    label: string;
    description?: string;
    required?: boolean;
    multiple?: boolean;
    allowedDefinitionIds?: string[];
}

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

export interface ComposerViewProps {
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

export function ComposerView({
    mode = 'page',
    contextId: initialContextId,
    contextType = 'subprocess',
    projectId: initialProjectId,
    onSuccess,
    onClose,
    defaultRecipe,
}: ComposerViewProps) {
    // ==================== STATE ====================

    const [userRecipeId, setUserRecipeId] = useState<string | null>(null);
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
    const [userSubprocessId, setUserSubprocessId] = useState<string | null>(
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

    // Derive default recipe ID (from defaultRecipe prop or first recipe)
    const defaultRecipeId = useMemo(() => {
        if (!actionRecipes.length) return null;
        if (defaultRecipe) {
            const match = actionRecipes.find(
                (r) => r.id === defaultRecipe || r.name === defaultRecipe
            );
            if (match) return match.id;
        }
        return actionRecipes[0].id;
    }, [actionRecipes, defaultRecipe]);

    // Effective recipe selection (user choice or default)
    const selectedRecipeId = userRecipeId ?? defaultRecipeId;

    // Get selected recipe
    const selectedRecipe = useMemo(() => {
        if (!selectedRecipeId || !actionRecipes.length) return null;
        return actionRecipes.find((r) => r.id === selectedRecipeId || r.name === selectedRecipeId) || null;
    }, [selectedRecipeId, actionRecipes]);

    // Safely extract schema_config as object
    const schemaConfig = useMemo(() => {
        const raw = selectedRecipe?.schema_config;
        if (!raw || typeof raw !== 'object') return null;
        return raw as SchemaConfig & { referenceSlots?: ReferenceSlot[] };
    }, [selectedRecipe]);

    // Extract schema fields from selected recipe
    const recipeFields = useMemo(() => {
        if (!schemaConfig) return [];
        // Filter out title and description as they're handled separately
        return (schemaConfig.fields || []).filter(
            (f) => f.key !== 'title' && f.key !== 'description' && f.key !== 'status'
        );
    }, [schemaConfig]);

    // Extract reference slots from selected recipe
    const referenceSlots = useMemo((): ReferenceSlot[] => {
        if (!schemaConfig) return [];
        return schemaConfig.referenceSlots || [];
    }, [schemaConfig]);

    // Group linked records by slot for display, preserving original indices
    const linkedRecordsBySlot = useMemo(() => {
        const grouped: Record<string, { lr: LinkedRecord; idx: number }[]> = {};
        linkedRecords.forEach((lr, idx) => {
            if (!grouped[lr.targetFieldKey]) {
                grouped[lr.targetFieldKey] = [];
            }
            grouped[lr.targetFieldKey].push({ lr, idx });
        });
        return grouped;
    }, [linkedRecords]);

    // Get slot label by key
    const getSlotLabel = useCallback((slotKey: string): string => {
        const slot = referenceSlots.find((s) => s.key === slotKey);
        return slot?.label || slotKey;
    }, [referenceSlots]);

    // Get subprocesses from container actions API
    // These are action-based containers, not legacy hierarchy nodes
    const subprocesses = useMemo(() => containerSubprocesses || [], [containerSubprocesses]);

    // Derive default subprocess ID (first subprocess)
    const defaultSubprocessId = useMemo(() => subprocesses[0]?.id ?? null, [subprocesses]);

    // Effective subprocess selection (user choice or default)
    const selectedSubprocessId = userSubprocessId ?? defaultSubprocessId;

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
                    const form = document.querySelector('.composer-view form') as HTMLFormElement;
                    form?.requestSubmit();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [title, selectedSubprocessId, selectedRecipe, isLoading]);

    // ==================== RENDER ====================

    const containerClass = clsx('composer-view', {
        'h-full': mode === 'page' || mode === 'drawer',
        'rounded-lg border border-ws-panel-border': mode === 'inline',
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
                            <h1 className="text-ws-h1 font-semibold text-ws-fg">Composer</h1>
                            <p className="text-xs text-ws-text-secondary">Declare intent with Actions + Events</p>
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
                                        setUserSubprocessId(null);
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
                                    onChange={(e) => setUserSubprocessId(e.target.value)}
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
                                        onClick={() => setUserRecipeId(recipe.id)}
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

                        {/* Linked Records List - grouped by slot */}
                        {linkedRecords.length > 0 && (
                            <div className="space-y-3 mb-4">
                                {Object.entries(linkedRecordsBySlot).map(([slotKey, items]) => (
                                    <div key={slotKey} className="space-y-2">
                                        <div className="text-xs font-medium text-ws-text-secondary uppercase tracking-wide">
                                            {getSlotLabel(slotKey)}
                                        </div>
                                        {items.map(({ lr, idx }) => (
                                            <div key={idx} className="composer-record-card">
                                                <div className="composer-record-card-icon">
                                                    <LinkIcon size={14} />
                                                </div>
                                                <div className="composer-record-card-content">
                                                    <div className="composer-record-card-name">
                                                        {lr.record.unique_name}
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
                                ))}
                            </div>
                        )}

                        {/* Reference Slot Buttons */}
                        <div className="flex flex-wrap gap-2">
                            {referenceSlots.length > 0 ? (
                                referenceSlots.map((slot) => (
                                    <button
                                        key={slot.key}
                                        type="button"
                                        onClick={() => {
                                            setCurrentSlot(slot.key);
                                            setShowRecordPicker(true);
                                        }}
                                        className="composer-add-btn"
                                        title={slot.description}
                                    >
                                        <Plus size={16} />
                                        {slot.label}
                                        {slot.required && <span className="text-red-500 ml-1">*</span>}
                                    </button>
                                ))
                            ) : (
                                // Fallback for arrangements without defined slots
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
                            )}
                        </div>

                        {/* Record Picker Modal (simplified) */}
                        {showRecordPicker && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-ws-panel-bg rounded-xl shadow-2xl w-full max-w-lg max-h-[70vh] overflow-hidden">
                                    <div className="p-4 border-b border-ws-panel-border flex items-center justify-between">
                                        <h3 className="font-semibold text-ws-fg">Select Record</h3>
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
                                                className="w-full text-left p-3 rounded-lg border border-ws-panel-border hover:border-blue-300 hover:bg-blue-50 transition-all"
                                            >
                                                <div className="font-medium text-ws-fg">
                                                    {record.unique_name}
                                                </div>
                                                <div className="text-xs text-ws-text-secondary">
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
                    <div className="flex items-center justify-between pt-4 border-t border-ws-panel-border">
                        <div className="text-sm text-ws-text-secondary">
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
 * Uses ComposerView internally with inline mode.
 */
export function InlineComposer({ contextId, onSuccess, placeholder }: InlineComposerProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!isExpanded) {
        return (
            <button
                onClick={() => setIsExpanded(true)}
                className="w-full p-3 text-left text-ws-muted hover:text-ws-text-secondary hover:bg-ws-bg rounded-lg border border-dashed border-ws-panel-border transition-all"
            >
                <Plus size={14} className="inline mr-2" />
                {placeholder || 'Add an action...'}
            </button>
        );
    }

    return (
        <div className="border border-ws-panel-border rounded-lg overflow-hidden">
            <ComposerView
                mode="inline"
                contextId={contextId}
                onSuccess={(actionId) => {
                    setIsExpanded(false);
                    onSuccess?.(actionId);
                }}
                onClose={() => setIsExpanded(false)}
            />
        </div>
    );
}

export default ComposerView;

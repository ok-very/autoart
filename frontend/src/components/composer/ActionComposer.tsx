/**
 * ActionComposer Component - FAITHFUL TO demo-composer.html
 *
 * Full-featured Action Composer matching docs/demo-composer.html exactly.
 * Replaces the legacy ActionComposer with reference support.
 *
 * Sections:
 * 1. Project Context - parent project & process/stage selectors
 * 2. Action Definition - title, type, owner, status, description
 * 3. Referenced Records - search and link records with chips
 * 4. Declared Fields - dynamically add fields (due date, hours, location, notes)
 *
 * Features from demo:
 * - Full page layout with header (Cancel / Save Action)
 * - Numbered section badges
 * - Dynamic field templates (+ Add Field)
 * - Record search with chips
 * - Owner selector with avatar
 */

import { useState, useCallback, useMemo } from 'react';
import {
    Plus,
    MagnifyingGlass,
    Lock,
    User,
    MapPin,
    FileText,
    X,
    Check,
    CaretDown,
} from '@phosphor-icons/react';
import {
    useCreateAction,
    useEmitActionEvents,
    useSetActionReferences,
    useSearch,
    useProjects,
    useProjectTree,
    useAssignWork,
    type ReferenceInput,
} from '../../api/hooks';
import type { DataRecord, HierarchyNode } from '@autoart/shared';
import { clsx } from 'clsx';
import styles from './ActionComposer.module.css';

// ==================== TYPES ====================

export interface ActionComposerProps {
    /** Context ID (subprocess, stage, project) - initial selection */
    contextId?: string;
    /** Context type - defaults to subprocess */
    contextType?: 'subprocess' | 'stage' | 'process' | 'project';
    /** Callback after successful action creation */
    onSuccess?: (actionId: string) => void;
    /** Callback to close the composer */
    onClose?: () => void;
    /** Default action type */
    defaultType?: ActionType;
    /** If provided, locks context to this project */
    projectId?: string;
}

interface LinkedRecord {
    record: DataRecord;
    targetFieldKey: string;
}

interface DeclaredField {
    key: string;
    label: string;
    type: 'text' | 'date' | 'number' | 'textarea';
    value: string;
    placeholder?: string;
}

type ActionType = 'TASK' | 'BUG' | 'MEETING' | 'DOCUMENT';
type InitialStatus = 'pending' | 'active' | 'blocked';

// Field templates from demo
const FIELD_TEMPLATES: Record<string, Omit<DeclaredField, 'key' | 'value'>> = {
    due_date: { label: 'Due Date', type: 'date' },
    hours: { label: 'Estimated Hours', type: 'number', placeholder: '0' },
    location: { label: 'Location', type: 'text', placeholder: 'Physical or virtual' },
    notes: { label: 'Notes', type: 'textarea' },
};

// Semantic reference slots (per user guidance: not generic 'input')
const REFERENCE_SLOTS = [
    { key: 'lead_artist', label: 'Lead Artist' },
    { key: 'location', label: 'Location' },
    { key: 'vendor', label: 'Vendor' },
    { key: 'artwork', label: 'Artwork' },
    { key: 'client', label: 'Client' },
    { key: 'related_record', label: 'Related Record' },
] as const;

// ==================== ACTION COMPOSER ====================

export function ActionComposer({
    contextId: initialContextId,
    contextType = 'subprocess',
    onSuccess,
    onClose,
    defaultType = 'TASK',
    projectId: initialProjectId,
}: ActionComposerProps) {
    // Context state (selectable)
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId || null);
    const [selectedSubprocessId, setSelectedSubprocessId] = useState<string | null>(initialContextId || null);

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [actionType, setActionType] = useState<ActionType>(defaultType);
    const [owner, setOwner] = useState('');
    const [initialStatus, setInitialStatus] = useState<InitialStatus>('pending');

    // Dynamic fields state
    const [declaredFields, setDeclaredFields] = useState<DeclaredField[]>([]);
    const [showFieldPicker, setShowFieldPicker] = useState(false);

    // Referenced records state
    const [linkedRecords, setLinkedRecords] = useState<LinkedRecord[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    // Error state
    const [error, setError] = useState<string | null>(null);

    // Hooks - 3 Command Architecture
    const createAction = useCreateAction();
    const emitEvents = useEmitActionEvents();
    const setReferences = useSetActionReferences();
    const assignWork = useAssignWork();
    const { data: projects = [] } = useProjects();
    const { data: projectTree } = useProjectTree(selectedProjectId ?? null);

    // Search records
    const searchEnabled = searchQuery.length >= 2;
    const { data: searchResults = [] } = useSearch(searchQuery, undefined, searchEnabled);

    // Filter search results to records only
    const recordResults = useMemo(() => {
        return searchResults.filter(r => r.type === 'record');
    }, [searchResults]);

    // Get subprocesses from project tree
    const subprocesses = useMemo(() => {
        if (!projectTree || projectTree.length === 0) return [];
        const nodes: HierarchyNode[] = [];
        const collectSubprocesses = (node: HierarchyNode) => {
            if (node.type === 'subprocess') {
                nodes.push(node);
            }
            // @ts-expect-error children may exist on HierarchyNode
            if (node.children) {
                // @ts-expect-error children may exist on HierarchyNode
                node.children.forEach(collectSubprocesses);
            }
        };
        // projectTree is an array of root nodes
        projectTree.forEach(collectSubprocesses);
        return nodes;
    }, [projectTree]);

    // Add field from template
    const handleAddField = useCallback((templateKey: string) => {
        const template = FIELD_TEMPLATES[templateKey];
        if (!template) return;

        // Don't add duplicate fields
        if (declaredFields.some(f => f.key === templateKey)) return;

        setDeclaredFields(prev => [
            ...prev,
            { key: templateKey, value: '', ...template },
        ]);
        setShowFieldPicker(false);
    }, [declaredFields]);

    // Remove declared field
    const handleRemoveField = useCallback((key: string) => {
        setDeclaredFields(prev => prev.filter(f => f.key !== key));
    }, []);

    // Update field value
    const handleFieldChange = useCallback((key: string, value: string) => {
        setDeclaredFields(prev =>
            prev.map(f => (f.key === key ? { ...f, value } : f))
        );
    }, []);

    // Add record to linked list (default to first reference slot)
    const handleAddRecord = useCallback((record: DataRecord) => {
        if (linkedRecords.some(lr => lr.record.id === record.id)) return;

        setLinkedRecords(prev => [
            ...prev,
            { record, targetFieldKey: REFERENCE_SLOTS[0].key },
        ]);
        setSearchQuery('');
        setIsSearching(false);
    }, [linkedRecords]);

    // Remove record from linked list
    const handleRemoveRecord = useCallback((recordId: string) => {
        setLinkedRecords(prev => prev.filter(lr => lr.record.id !== recordId));
    }, []);

    // Update targetFieldKey for a linked record
    const handleChangeRecordSlot = useCallback((recordId: string, newSlot: string) => {
        setLinkedRecords(prev =>
            prev.map(lr =>
                lr.record.id === recordId ? { ...lr, targetFieldKey: newSlot } : lr
            )
        );
    }, []);

    // Handle form submission - 3 COMMAND ARCHITECTURE
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!title.trim()) {
            setError('Title is required');
            return;
        }

        if (!selectedSubprocessId) {
            setError('Please select a subprocess');
            return;
        }

        try {
            // =====================================
            // STEP 1: Create Action (intent only)
            // =====================================
            const fieldBindings = [
                { fieldKey: 'title' },
                { fieldKey: 'description' },
                ...declaredFields.map(f => ({ fieldKey: f.key })),
            ];

            const actionResult = await createAction.mutateAsync({
                contextId: selectedSubprocessId,
                contextType,
                type: actionType,
                fieldBindings,
            });

            const actionId = actionResult.action.id;

            // =====================================
            // STEP 2: Emit Workflow Events (truth)
            // =====================================
            const eventsToEmit: Array<{ type: string; payload?: Record<string, unknown> }> = [];

            // Field value events for declared fields
            eventsToEmit.push({
                type: 'FIELD_VALUE_RECORDED',
                payload: { fieldKey: 'title', value: title.trim() },
            });
            if (description) {
                eventsToEmit.push({
                    type: 'FIELD_VALUE_RECORDED',
                    payload: { fieldKey: 'description', value: description },
                });
            }
            for (const field of declaredFields.filter(f => f.value)) {
                eventsToEmit.push({
                    type: 'FIELD_VALUE_RECORDED',
                    payload: {
                        fieldKey: field.key,
                        value: field.type === 'number' ? parseFloat(field.value) : field.value,
                    },
                });
            }

            // Status events (per user guidance: meaning derived from events)
            if (initialStatus === 'active') {
                eventsToEmit.push({ type: 'WORK_STARTED', payload: {} });
            } else if (initialStatus === 'blocked') {
                eventsToEmit.push({ type: 'WORK_BLOCKED', payload: {} });
            }

            // Emit all events in batch
            if (eventsToEmit.length > 0) {
                await emitEvents.mutateAsync({
                    actionId,
                    contextId: selectedSubprocessId,
                    contextType,
                    events: eventsToEmit,
                });
            }

            // Owner via ASSIGNED event (not field value per user guidance)
            if (owner.trim()) {
                await assignWork.mutateAsync({
                    actionId,
                    assigneeId: owner.trim(), // Using name as ID for now
                    assigneeName: owner.trim(),
                });
            }

            // =====================================
            // STEP 3: Set References (bulk replace)
            // =====================================
            if (linkedRecords.length > 0) {
                const references: ReferenceInput[] = linkedRecords.map(lr => ({
                    sourceRecordId: lr.record.id,
                    targetFieldKey: lr.targetFieldKey,
                    snapshotValue: {
                        unique_name: lr.record.unique_name,
                        definition_id: lr.record.definition_id,
                    },
                }));

                await setReferences.mutateAsync({ actionId, references });
            }

            onSuccess?.(actionId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create action');
        }
    }, [
        title, description, actionType, owner, initialStatus, declaredFields,
        selectedSubprocessId, contextType, linkedRecords,
        createAction, emitEvents, setReferences, assignWork, onSuccess,
    ]);

    const isSubmitting = createAction.isPending || emitEvents.isPending || setReferences.isPending;

    // Available field templates (not yet added)
    const availableTemplates = useMemo(() => {
        const usedKeys = new Set(declaredFields.map(f => f.key));
        return Object.entries(FIELD_TEMPLATES).filter(([key]) => !usedKeys.has(key));
    }, [declaredFields]);

    return (
        <div className={`flex flex-col h-full overflow-hidden ${styles.composerContainer}`}>
            {/* HEADER */}
            <header className={styles.header}>
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors rounded hover:bg-slate-100"
                    >
                        <X size={20} />
                    </button>
                    <div>
                        <h1 className="text-base font-bold text-slate-800">New Action Record</h1>
                        <div className="text-xs text-slate-500">Create and link an action to the Registry</div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-500 hover:text-slate-800 px-3 py-2 text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="composer-form"
                        disabled={isSubmitting || !title.trim()}
                        className={clsx(
                            "text-white text-sm font-bold px-6 py-2 rounded-lg shadow transition-colors flex items-center gap-2",
                            isSubmitting || !title.trim()
                                ? "bg-slate-400 cursor-not-allowed"
                                : "bg-indigo-600 hover:bg-indigo-700"
                        )}
                    >
                        <span>Save Action</span>
                        <Check size={16} />
                    </button>
                </div>
            </header>

            {/* MAIN FORM */}
            <main className={`flex-1 overflow-y-auto p-6 md:p-10 ${styles.customScroll}`}>
                <form id="composer-form" onSubmit={handleSubmit} className={`max-w-3xl mx-auto space-y-8 ${styles.fadeIn}`}>
                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {/* SECTION 1: CONTEXT */}
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold">
                                1
                            </div>
                            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Project Context</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="input-group">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Parent Project</label>
                                <select
                                    value={selectedProjectId || ''}
                                    onChange={(e) => {
                                        setSelectedProjectId(e.target.value || null);
                                        setSelectedSubprocessId(null);
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                                >
                                    <option value="">Select a project...</option>
                                    {projects.map((p) => (
                                        <option key={p.id} value={p.id}>{p.title}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Process / Stage</label>
                                <select
                                    value={selectedSubprocessId || ''}
                                    onChange={(e) => setSelectedSubprocessId(e.target.value || null)}
                                    disabled={!selectedProjectId}
                                    className={clsx(
                                        "w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors",
                                        selectedProjectId ? "bg-slate-50 text-slate-800" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    )}
                                >
                                    <option value="">Select a subprocess...</option>
                                    {subprocesses.map((s) => (
                                        <option key={s.id} value={s.id}>{s.title}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* SECTION 2: ACTION DEFINITION */}
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">
                                2
                            </div>
                            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Action Definition</h2>
                        </div>

                        <div className="space-y-6">
                            {/* Title */}
                            <div className="input-group">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Action Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Conduct Initial Site Survey"
                                    className="w-full text-lg font-semibold text-slate-800 placeholder-slate-300 border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                                    autoFocus
                                />
                            </div>

                            {/* Type, Owner, Status */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="input-group">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Action Type</label>
                                    <select
                                        value={actionType}
                                        onChange={(e) => setActionType(e.target.value as ActionType)}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="TASK">Standard Task</option>
                                        <option value="MEETING">Meeting / Event</option>
                                        <option value="DOCUMENT">Document Submission</option>
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Owner</label>
                                    <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg bg-white cursor-pointer hover:border-slate-300">
                                        <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center">
                                            {owner ? owner.slice(0, 2).toUpperCase() : 'AL'}
                                        </div>
                                        <input
                                            type="text"
                                            value={owner}
                                            onChange={(e) => setOwner(e.target.value)}
                                            placeholder="Alex (You)"
                                            className="flex-1 text-sm text-slate-700 bg-transparent focus:outline-none"
                                        />
                                        <CaretDown size={14} weight="bold" className="text-slate-400" />
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Initial Status</label>
                                    <select
                                        value={initialStatus}
                                        onChange={(e) => setInitialStatus(e.target.value as InitialStatus)}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="active">In Progress</option>
                                        <option value="blocked">Blocked</option>
                                    </select>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="input-group">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Description / Notes</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Add detailed instructions or context..."
                                    className="w-full h-24 text-sm text-slate-700 placeholder-slate-400 border border-slate-200 rounded-lg p-3 focus:outline-none focus:border-blue-500 resize-none"
                                />
                            </div>
                        </div>
                    </section>

                    {/* SECTION 3: REFERENCED RECORDS */}
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />

                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold">
                                    3
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Referenced Records</h2>
                                    <p className="text-xs text-slate-500">Actions operate *against* records. These references are semantic inputs.</p>
                                </div>
                            </div>
                            <button type="button" className="text-xs text-emerald-600 font-bold hover:underline">
                                + Link New Record
                            </button>
                        </div>

                        {/* Search */}
                        <div className="bg-slate-50 rounded-lg p-4 mb-4">
                            <div className="relative">
                                <MagnifyingGlass size={16} weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setIsSearching(e.target.value.length >= 2);
                                    }}
                                    placeholder="Search Contacts, Artworks, or Locations to link..."
                                    className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors"
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 ml-1">Type to search existing registry records.</p>

                            {/* Search Results */}
                            {isSearching && recordResults.length > 0 && (
                                <div className="mt-3 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                    {recordResults.map((result) => (
                                        <button
                                            key={result.id}
                                            type="button"
                                            onClick={() => handleAddRecord({ id: result.id, unique_name: result.name } as DataRecord)}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100 last:border-0"
                                        >
                                            <div className="w-8 h-8 rounded bg-orange-100 text-orange-600 flex items-center justify-center">
                                                <MapPin size={16} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-slate-700 truncate">{result.name}</div>
                                                <div className="text-[10px] text-slate-500">{result.definitionName || 'Record'}</div>
                                            </div>
                                            <Plus size={14} className="text-slate-400" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Linked Records List */}
                        <div className="space-y-2">
                            {/* Default: Project Record (locked) */}
                            {selectedProjectId && (
                                <div className="flex items-center gap-3 px-3 py-2 bg-white border border-slate-200 rounded-lg opacity-75">
                                    <div className="w-8 h-8 rounded bg-blue-100 text-blue-600 flex items-center justify-center">
                                        <FileText size={16} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-slate-700">
                                            {projects.find(p => p.id === selectedProjectId)?.title || 'Project'}
                                        </div>
                                        <div className="text-[10px] text-slate-500">Project Record · Parent</div>
                                    </div>
                                    <Lock size={14} className="text-slate-300" />
                                </div>
                            )}

                            {/* User-linked records with slot selector */}
                            {linkedRecords.map((lr) => (
                                <div key={lr.record.id} className={styles.recordCard}>
                                    <div className="w-8 h-8 rounded bg-purple-100 text-purple-600 flex items-center justify-center">
                                        <User size={16} weight="fill" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-700 truncate">{lr.record.unique_name}</div>
                                        <div className="text-[10px] text-slate-500">Record · Linked</div>
                                    </div>
                                    {/* Semantic slot selector - shown on hover */}
                                    <select
                                        value={lr.targetFieldKey}
                                        onChange={(e) => handleChangeRecordSlot(lr.record.id, e.target.value)}
                                        className={`text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-slate-600 appearance-none cursor-pointer ${styles.slotSelector}`}
                                    >
                                        {REFERENCE_SLOTS.map((slot) => (
                                            <option key={slot.key} value={slot.key}>{slot.label}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveRecord(lr.record.id)}
                                        className={`text-slate-300 hover:text-red-500 p-1 ${styles.slotSelector}`}
                                    >
                                        <X size={14} weight="bold" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* SECTION 4: DECLARED FIELDS */}
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 border-dashed">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold">
                                    4
                                </div>
                                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Declared Action Fields</h2>
                            </div>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowFieldPicker(!showFieldPicker)}
                                    className="text-xs font-bold text-indigo-600 hover:underline"
                                >
                                    + Add Field
                                </button>

                                {/* Field Picker Dropdown */}
                                {showFieldPicker && availableTemplates.length > 0 && (
                                    <div className="absolute right-0 top-6 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
                                        {availableTemplates.map(([key, template]) => (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => handleAddField(key)}
                                                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                            >
                                                {template.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <p className="text-xs text-slate-500 mb-4">
                            Fields are declared for this action instance. They do not imply task semantics.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {declaredFields.map((field) => (
                                <div key={field.key} className="relative border border-slate-200 rounded-lg p-3 bg-slate-50">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                        {field.label}
                                    </label>
                                    {field.type === 'textarea' ? (
                                        <textarea
                                            value={field.value}
                                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                                            className="w-full text-sm border border-slate-200 rounded p-2 resize-none bg-white"
                                            rows={3}
                                        />
                                    ) : (
                                        <input
                                            type={field.type}
                                            value={field.value}
                                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                                            placeholder={field.placeholder}
                                            className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 bg-white"
                                        />
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveField(field.key)}
                                        className="absolute top-2 right-2 text-slate-300 hover:text-red-500"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}

                            {declaredFields.length === 0 && (
                                <div className="col-span-2 text-center py-6 text-sm text-slate-400">
                                    No fields declared yet. Click "+ Add Field" to add due date, hours, location, or notes.
                                </div>
                            )}
                        </div>
                    </section>
                </form>
            </main>
        </div>
    );
}

// ==================== INLINE ACTION COMPOSER ====================
// Simplified version for quick task creation in sidebars

export function InlineActionComposer({
    contextId,
    onSuccess,
    placeholder = 'Add a task...',
}: {
    contextId: string;
    onSuccess?: (actionId: string) => void;
    placeholder?: string;
}) {
    const [title, setTitle] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);

    // 3-command hooks
    const createAction = useCreateAction();
    const emitEvents = useEmitActionEvents();

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        try {
            // Step 1: Create Action
            const actionResult = await createAction.mutateAsync({
                contextId,
                contextType: 'subprocess',
                type: 'TASK',
                fieldBindings: [{ fieldKey: 'title' }],
            });

            const actionId = actionResult.action.id;

            // Step 2: Emit title field event
            await emitEvents.mutateAsync({
                actionId,
                contextId,
                contextType: 'subprocess',
                events: [{
                    type: 'FIELD_VALUE_RECORDED',
                    payload: { fieldKey: 'title', value: title.trim() },
                }],
            });

            setTitle('');
            setIsExpanded(false);
            onSuccess?.(actionId);
        } catch (err) {
            console.error('Failed to create action:', err);
        }
    }, [title, contextId, createAction, emitEvents, onSuccess]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        } else if (e.key === 'Escape') {
            setIsExpanded(false);
            setTitle('');
        }
    }, [handleSubmit]);

    if (!isExpanded) {
        return (
            <button
                onClick={() => setIsExpanded(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
            >
                <Plus size={14} />
                <span>{placeholder}</span>
            </button>
        );
    }

    const isSubmitting = createAction.isPending || emitEvents.isPending;

    return (
        <form onSubmit={handleSubmit} className="p-2">
            <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                autoFocus
                className="w-full px-3 py-2 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <div className="flex items-center justify-end gap-2 mt-2">
                <button
                    type="button"
                    onClick={() => {
                        setIsExpanded(false);
                        setTitle('');
                    }}
                    className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={!title.trim() || isSubmitting}
                    className={clsx(
                        "px-3 py-1 text-xs font-medium rounded",
                        title.trim() && !isSubmitting
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-slate-200 text-slate-400 cursor-not-allowed"
                    )}
                >
                    Add
                </button>
            </div>
        </form>
    );
}


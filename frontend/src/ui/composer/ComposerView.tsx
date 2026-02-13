/**
 * ComposerView Component
 *
 * The unified, canonical composer UI for declaring Actions.
 * @deprecated For new usage, prefer InspectorFooterComposer in the unified inspector.
 * Retained for ComposerPanel and legacy drawer contexts.
 *
 * Core principles:
 * - Schema-first: Action types come from definitions with kind='action_arrangement'
 * - References are first-class inputs with named slots
 * - Events are emitted, not stored directly (immutable facts)
 *
 * Sections:
 * 1. Project Context - Select project → subprocess
 * 2. Action Definition - Pick action arrangement, title, description
 * 3. Referenced Records - Link records to named slots
 * 4. Action Inputs - Schema-driven fields from arrangement
 */

import { clsx } from 'clsx';
import {
    Wand2,
    X,
    Plus,
    Trash2,
    Link as LinkIcon,
    CheckCircle2,
} from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';

import type { DataRecord, SchemaConfig } from '@autoart/shared';
import {
    Button,
    TextInput,
    Text,
    Stack,
    Spinner,
    Card,
    Badge,
    Inline,
    IconButton,
    Modal,
    Alert,
} from '@autoart/ui';

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
    useProjects,
    useProjectTree,
    useRecords,
    useSubprocesses,
} from '../../api/hooks';
import { useUIStore } from '../../stores/uiStore';
import { useComposerForm } from './useComposerForm';
import { EventPreview, buildPendingEvents } from './EventPreview';
import { ContextIndicator } from './ContextIndicator';

// ==================== TYPES ====================

export interface ComposerViewProps {
    /** Display mode: page (full-page) or drawer (slide-out panel) */
    mode: 'page' | 'drawer';
    /** Pre-selected context ID */
    contextId?: string;
    /** Context type (defaults to subprocess) */
    contextType?: 'subprocess' | 'phase' | 'process' | 'project';
    /** Pre-selected project ID */
    projectId?: string;
    /** Callback when action is created successfully */
    onSuccess?: (actionId: string) => void;
    /** Callback to close drawer mode */
    onClose?: () => void;
    /** Pre-selected action arrangement ID or name */
    defaultArrangement?: string;
}


// ==================== MAIN COMPONENT ====================

export function ComposerView({
    mode = 'page',
    contextId: initialContextId,
    contextType = 'subprocess',
    projectId: initialProjectId,
    onSuccess,
    onClose,
    defaultArrangement,
}: ComposerViewProps) {
    // ==================== STATE ====================

    // Panel-only UI state
    const [userProjectId, setUserProjectId] = useState<string | null>(initialProjectId || null);
    const [userSubprocessId, setUserSubprocessId] = useState<string | null>(initialContextId || null);
    const [showRecordPicker, setShowRecordPicker] = useState(false);
    const [currentSlot, setCurrentSlot] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [recordDisplayNames, setRecordDisplayNames] = useState<Map<number, { id: string; name: string }>>(new Map());

    // Context resolution (panel-only)
    const { activeProjectId, setActiveProject } = useUIStore();
    const currentProjectId = userProjectId || activeProjectId;
    const { data: projects } = useProjects();
    const { data: containerSubprocesses } = useSubprocesses(currentProjectId);
    useProjectTree(currentProjectId); // Trigger project tree preload
    const { data: allRecords } = useRecords();

    // ==================== DERIVED DATA ====================

    const subprocesses = useMemo(() => containerSubprocesses || [], [containerSubprocesses]);
    const defaultSubprocessId = useMemo(() => subprocesses[0]?.id ?? null, [subprocesses]);
    const selectedSubprocessId = userSubprocessId ?? defaultSubprocessId;

    // Get selected subprocess for display
    const selectedSubprocess = useMemo(() => {
        if (!selectedSubprocessId || !subprocesses.length) return null;
        const sp = subprocesses.find((s) => s.id === selectedSubprocessId);
        if (!sp) return null;
        const titleBinding = (sp.fieldBindings as Array<{ fieldKey: string; value?: unknown }>)?.find((b) => b.fieldKey === 'title');
        return {
            id: sp.id,
            title: String(titleBinding?.value || sp.type || 'Subprocess'),
        };
    }, [selectedSubprocessId, subprocesses]);

    // Shared form state via hook
    const form = useComposerForm({
        projectId: currentProjectId || undefined,
        contextId: selectedSubprocessId || undefined,
        contextType,
        defaultArrangement,
        onSuccess: (actionId) => {
            setRecordDisplayNames(new Map());
            const actionType = form.selectedArrangement?.name || 'Action';
            setSuccessMessage(`${actionType} created`);
            setTimeout(() => setSuccessMessage(null), 4000);
            onSuccess?.(actionId);
        },
    });

    // Safely extract schema_config as object
    const schemaConfig = useMemo(() => {
        const raw = form.selectedArrangement?.schema_config;
        if (!raw || typeof raw !== 'object') return null;
        return raw as SchemaConfig & { referenceSlots?: ReferenceSlot[] };
    }, [form.selectedArrangement]);

    // Extract schema fields from selected arrangement
    const arrangementFields = useMemo(() => {
        if (!schemaConfig) return [];
        return (schemaConfig.fields || []).filter(
            (f) => f.key !== 'title' && f.key !== 'description' && f.key !== 'status'
        );
    }, [schemaConfig]);

    // Extract reference slots from selected arrangement
    const referenceSlots = useMemo((): ReferenceSlot[] => {
        if (!schemaConfig) return [];
        return schemaConfig.referenceSlots || [];
    }, [schemaConfig]);

    // Group references by slot for display
    const referencesBySlot = useMemo(() => {
        const grouped: Record<string, number[]> = {};
        form.references.forEach((ref, idx) => {
            if (!grouped[ref.targetFieldKey]) {
                grouped[ref.targetFieldKey] = [];
            }
            grouped[ref.targetFieldKey].push(idx);
        });
        return grouped;
    }, [form.references]);

    // Get slot label by key
    const getSlotLabel = useCallback((slotKey: string): string => {
        const slot = referenceSlots.find((s) => s.key === slotKey);
        return slot?.label || slotKey;
    }, [referenceSlots]);

    // Build pending events for preview
    const pendingEvents = useMemo(() => {
        if (!form.selectedArrangement) return [];
        return buildPendingEvents({
            actionType: form.selectedArrangement.name,
            title: form.title,
            description: form.description,
            fieldValues: Array.from(form.fieldValues.entries()).map(([key, value]) => ({
                key,
                value,
            })),
            references: form.references.map((ref, idx) => ({
                recordName: recordDisplayNames.get(idx)?.name || ref.sourceRecordId.slice(0, 8),
                targetFieldKey: ref.targetFieldKey,
            })),
        });
    }, [form.selectedArrangement, form.title, form.description, form.fieldValues, form.references, recordDisplayNames]);

    // ==================== HANDLERS ====================

    const handleAddRecord = useCallback(
        (record: DataRecord) => {
            if (!currentSlot) return;
            const refIndex = form.references.length;
            form.addReference({
                sourceRecordId: record.id,
                targetFieldKey: currentSlot,
            });
            setRecordDisplayNames((prev) => {
                const next = new Map(prev);
                next.set(refIndex, { id: record.id, name: record.unique_name });
                return next;
            });
            setShowRecordPicker(false);
            setCurrentSlot(null);
        },
        [currentSlot, form]
    );

    const handleRemoveRecord = useCallback((index: number) => {
        form.removeReference(index);
        setRecordDisplayNames((prev) => {
            const next = new Map(prev);
            next.delete(index);
            return next;
        });
    }, [form]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await form.handleSubmit();
    };

    // ==================== RENDER ====================

    const containerClass = 'flex flex-col h-full bg-ws-bg text-ws-fg';

    return (
        <div className={containerClass}>
            {/* Header */}
            <div className="flex items-center justify-between h-16 px-6 bg-ws-panel-bg border-b border-ws-panel-border shrink-0">
                        <Inline gap="sm" align="center">
                            <div className="w-10 h-10 rounded-lg bg-ws-accent flex items-center justify-center text-ws-accent-fg">
                                <Wand2 size={20} />
                            </div>
                            <div>
                                <Text size="sm" weight="semibold" className="text-ws-fg">Composer</Text>
                                <Text size="xs" className="text-ws-text-secondary">Declare intent with Actions + Events</Text>
                            </div>
                        </Inline>
                        {mode === 'drawer' && onClose && (
                            <IconButton icon={X} onClick={onClose} variant="ghost" size="md" label="Close" />
                        )}
                    </div>
                    {/* Context Indicator */}
                    <div className="px-6 py-3 border-b border-ws-panel-border bg-ws-bg">
                        <ContextIndicator
                            context={{
                                projectId: currentProjectId,
                                projectTitle: projects?.find((p) => p.id === currentProjectId)?.title || null,
                                contextId: selectedSubprocessId,
                                contextTitle: selectedSubprocess?.title || null,
                                contextType,
                            }}
                            size="md"
                        />
                    </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 custom-scroll">
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Section 1: Project Context */}
                    <Card shadow="sm" padding="md" radius="md">
                        <Inline gap="sm" align="center" className="mb-4">
                            <Badge variant="default" size="sm">1</Badge>
                            <Text size="sm" weight="semibold" className="text-ws-fg">Project Context</Text>
                        </Inline>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-ws-fg mb-1">Project</label>
                                <select
                                    value={currentProjectId || ''}
                                    onChange={(e) => {
                                        setUserProjectId(e.target.value);
                                        setActiveProject(e.target.value);
                                        setUserSubprocessId(null);
                                    }}
                                    className="w-full px-3 py-2 text-sm border border-ws-panel-border rounded-lg bg-ws-panel-bg text-ws-fg focus:outline-none focus:ring-2 focus:ring-ws-accent focus:border-ws-accent"
                                >
                                    <option value="">Select a project...</option>
                                    {projects?.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-ws-fg mb-1">Subprocess (Context)</label>
                                <select
                                    value={selectedSubprocessId || ''}
                                    onChange={(e) => setUserSubprocessId(e.target.value)}
                                    disabled={!currentProjectId}
                                    className="w-full px-3 py-2 text-sm border border-ws-panel-border rounded-lg bg-ws-panel-bg text-ws-fg focus:outline-none focus:ring-2 focus:ring-ws-accent focus:border-ws-accent disabled:opacity-50 disabled:cursor-not-allowed"
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
                    </Card>

                    {/* Section 2: Action Definition */}
                    <Card shadow="sm" padding="md" radius="md" className="border-l-2 border-l-ws-accent">
                        <Inline gap="sm" align="center" className="mb-4">
                            <Badge variant="info" size="sm">2</Badge>
                            <Text size="sm" weight="semibold" className="text-ws-fg">Action Definition</Text>
                            <Text size="xs" className="text-ws-text-secondary ml-auto">
                                {form.arrangements.length} arrangement{form.arrangements.length !== 1 ? 's' : ''}
                            </Text>
                        </Inline>

                        {/* Arrangement Grid */}
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 mb-4">
                            {form.arrangements.map((arrangement) => {
                                const isSelected = form.selectedArrangement?.id === arrangement.id;
                                const styling = arrangement.styling as { icon?: string; color?: string } | undefined;
                                return (
                                    <button
                                        key={arrangement.id}
                                        type="button"
                                        onClick={() => form.setArrangementId(arrangement.id)}
                                        className={clsx(
                                            'flex flex-col items-center gap-2 px-3 py-4 rounded-lg border-2 transition-all duration-150 ease-out',
                                            isSelected
                                                ? 'border-ws-accent bg-ws-row-expanded-bg'
                                                : 'border-ws-panel-border hover:border-ws-accent/30 hover:bg-ws-bg'
                                        )}
                                    >
                                        <div className={clsx(
                                            'w-10 h-10 rounded-lg flex items-center justify-center text-lg',
                                            isSelected ? 'bg-ws-accent text-ws-accent-fg' : 'bg-ws-bg text-ws-muted-fg'
                                        )}>
                                            {styling?.icon || arrangement.name.charAt(0)}
                                        </div>
                                        <Text size="xs" weight="medium" className={isSelected ? 'text-ws-fg' : 'text-ws-text-secondary'}>
                                            {arrangement.name}
                                        </Text>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Title & Description */}
                        <Stack gap="sm">
                            <div>
                                <label className="block text-sm font-medium text-ws-fg mb-1">
                                    Title <span className="text-ws-color-error">*</span>
                                </label>
                                <TextInput
                                    value={form.title}
                                    onChange={(e) => form.setTitle(e.target.value)}
                                    placeholder={`Enter ${form.selectedArrangement?.name || 'action'} title...`}
                                    className="w-full"
                                    autoFocus={mode === 'page'}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-ws-fg mb-1">Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => form.setDescription(e.target.value)}
                                    placeholder="Optional description..."
                                    className="w-full px-3 py-2 text-sm border border-ws-panel-border rounded-lg bg-ws-panel-bg text-ws-fg focus:outline-none focus:ring-2 focus:ring-ws-accent focus:border-ws-accent resize-none"
                                    rows={3}
                                />
                            </div>
                        </Stack>
                    </Card>

                    {/* Section 3: Referenced Records */}
                    <Card shadow="sm" padding="md" radius="md" className="border-l-2 border-l-ws-color-success">
                        <Inline gap="sm" align="center" className="mb-4">
                            <Badge variant="success" size="sm">3</Badge>
                            <Text size="sm" weight="semibold" className="text-ws-fg">Referenced Records</Text>
                            <Text size="xs" className="text-ws-text-secondary ml-auto">Link to existing data</Text>
                        </Inline>

                        {/* Linked Records List - grouped by slot */}
                        {form.references.length > 0 && (
                            <Stack gap="sm" className="mb-4">
                                {Object.entries(referencesBySlot).map(([slotKey, indices]) => (
                                    <div key={slotKey} className="space-y-2">
                                        <Text size="xs" weight="medium" className="text-ws-text-secondary uppercase tracking-wide">
                                            {getSlotLabel(slotKey)}
                                        </Text>
                                        {indices.map((idx) => {
                                            const ref = form.references[idx];
                                            const displayInfo = recordDisplayNames.get(idx);
                                            return (
                                                <Card key={idx} padding="sm" className="border border-ws-panel-border">
                                                    <Inline gap="sm" align="center">
                                                        <div className="w-8 h-8 rounded-lg bg-ws-row-expanded-bg flex items-center justify-center text-ws-muted-fg shrink-0">
                                                            <LinkIcon size={14} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <Text size="sm" weight="medium" className="text-ws-fg truncate">
                                                                {displayInfo?.name || ref.sourceRecordId.slice(0, 8)}
                                                            </Text>
                                                        </div>
                                                        <IconButton
                                                            icon={Trash2}
                                                            onClick={() => handleRemoveRecord(idx)}
                                                            variant="ghost"
                                                            size="sm"
                                                            label="Remove"
                                                            className="hover:text-ws-color-error"
                                                        />
                                                    </Inline>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                ))}
                            </Stack>
                        )}

                        {/* Reference Slot Buttons */}
                        <Inline gap="sm" className="flex-wrap">
                            {referenceSlots.length > 0 ? (
                                referenceSlots.map((slot) => (
                                    <Button
                                        key={slot.key}
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                            setCurrentSlot(slot.key);
                                            setShowRecordPicker(true);
                                        }}
                                        className="border-dashed"
                                    >
                                        <Plus size={14} />
                                        {slot.label}
                                        {slot.required && <span className="text-ws-color-error ml-1">*</span>}
                                    </Button>
                                ))
                            ) : (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        setCurrentSlot('related_record');
                                        setShowRecordPicker(true);
                                    }}
                                    className="border-dashed"
                                >
                                    <Plus size={14} />
                                    Link a Record
                                </Button>
                            )}
                        </Inline>

                        {/* Record Picker Modal */}
                        <Modal open={showRecordPicker} onOpenChange={setShowRecordPicker} title="Select Record" size="lg">
                            <Stack gap="xs" className="max-h-[50vh] overflow-y-auto">
                                {allRecords?.slice(0, 20).map((record) => (
                                    <button
                                        key={record.id}
                                        type="button"
                                        onClick={() => handleAddRecord(record)}
                                        className="w-full text-left p-3 rounded-lg border border-ws-panel-border hover:border-ws-accent hover:bg-ws-row-expanded-bg transition-colors"
                                    >
                                        <Text size="sm" weight="medium" className="text-ws-fg">{record.unique_name}</Text>
                                        <Text size="xs" className="text-ws-text-secondary">ID: {record.id.slice(0, 8)}...</Text>
                                    </button>
                                ))}
                                {(!allRecords || allRecords.length === 0) && (
                                    <div className="flex flex-col items-center justify-center py-8 text-ws-muted">
                                        <Text size="lg">📭</Text>
                                        <Text size="sm" className="text-ws-text-secondary">No records found</Text>
                                    </div>
                                )}
                            </Stack>
                        </Modal>
                    </Card>

                    {/* Section 4: Action Inputs (Schema-driven) */}
                    {form.selectedArrangement && arrangementFields.length > 0 && (
                        <Card shadow="sm" padding="md" radius="md" className="border-dashed">
                            <Inline gap="sm" align="center" className="mb-4">
                                <Badge variant="default" size="sm">4</Badge>
                                <Text size="sm" weight="semibold" className="text-ws-fg">Action Inputs</Text>
                                <Text size="xs" className="text-ws-text-secondary ml-auto">
                                    From {form.selectedArrangement.name} schema
                                </Text>
                            </Inline>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                                {arrangementFields.map((field) => (
                                    <div
                                        key={field.key}
                                        className={clsx({
                                            'col-span-full': field.type === 'textarea',
                                        })}
                                    >
                                        <label className="block text-sm font-medium text-ws-fg mb-1">
                                            {field.label || field.key}
                                            {field.required && (
                                                <span className="text-ws-color-error ml-1">*</span>
                                            )}
                                        </label>
                                        {field.type === 'textarea' ? (
                                            <textarea
                                                value={(form.fieldValues.get(field.key) as string) || ''}
                                                onChange={(e) =>
                                                    form.setFieldValue(field.key, e.target.value)
                                                }
                                                placeholder={`Enter ${field.label || field.key}...`}
                                                className="w-full px-3 py-2 text-sm border border-ws-panel-border rounded-lg bg-ws-panel-bg text-ws-fg focus:outline-none focus:ring-2 focus:ring-ws-accent focus:border-ws-accent resize-none"
                                                rows={3}
                                            />
                                        ) : field.type === 'date' ? (
                                            <input
                                                type="date"
                                                value={(form.fieldValues.get(field.key) as string) || ''}
                                                onChange={(e) =>
                                                    form.setFieldValue(field.key, e.target.value)
                                                }
                                                className="w-full px-3 py-2 text-sm border border-ws-panel-border rounded-lg bg-ws-panel-bg text-ws-fg focus:outline-none focus:ring-2 focus:ring-ws-accent focus:border-ws-accent"
                                            />
                                        ) : field.type === 'number' ? (
                                            <TextInput
                                                type="number"
                                                value={(form.fieldValues.get(field.key) as number) || ''}
                                                onChange={(e) =>
                                                    form.setFieldValue(field.key, e.target.value === '' ? undefined : e.target.valueAsNumber)
                                                }
                                                placeholder="0"
                                                className="w-full"
                                            />
                                        ) : (
                                            <TextInput
                                                value={(form.fieldValues.get(field.key) as string) || ''}
                                                onChange={(e) =>
                                                    form.setFieldValue(field.key, e.target.value)
                                                }
                                                placeholder={`Enter ${field.label || field.key}...`}
                                                className="w-full"
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {/* Agent Routing — reserved slot for future implementation */}
                    <div data-slot="agent-routing" />

                    {/* Event Preview */}
                    {form.hasContent && pendingEvents.length > 0 && (
                        <EventPreview events={pendingEvents} size="md" />
                    )}

                    {/* Success */}
                    {successMessage && (
                        <Alert variant="success">
                            <Inline gap="xs" align="center">
                                <CheckCircle2 size={16} />
                                {successMessage}
                            </Inline>
                        </Alert>
                    )}

                    {/* Error */}
                    {form.submitError && (
                        <Alert variant="error">
                            {form.submitError.message || 'Failed to create action'}
                        </Alert>
                    )}

                    {/* Submit Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-ws-panel-border">
                        <Text size="sm" className="text-ws-text-secondary">
                            {form.selectedArrangement && selectedSubprocess ? (
                                <>
                                    Creating <strong>{form.selectedArrangement.name}</strong> in{' '}
                                    <strong>{selectedSubprocess.title}</strong>
                                </>
                            ) : (
                                'Select an arrangement and context to continue'
                            )}
                        </Text>
                        <Button
                            type="submit"
                            variant="primary"
                            onClick={handleSubmit}
                            disabled={!form.canSubmit}
                        >
                            {form.isSubmitting ? (
                                <>
                                    <Spinner size="sm" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={16} />
                                    Create Action
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ComposerView;

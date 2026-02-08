/**
 * SelectionInspector - Unified Workbench Inspector
 *
 * Routes by selection.type (node | record | action | import_item) to show context-appropriate tabs.
 *
 * Tab Structure:
 * - Node/Record: Record | Interpretation | References | Links | Schema
 * - Action: Details | Execution Log
 * - Import Item: Details | Classification | Fields
 *
 * Layout:
 * - Tab header (dynamic based on selection type)
 * - Scrollable content area
 *
 * Dockview Integration:
 * - No fixed width - dockview controls panel sizing
 * - Accepts optional importContext prop for panel-local state
 * - Falls back to global uiStore when not in import context
 */

import { useMemo } from 'react';
import { clsx } from 'clsx';
import { FileText, Link2, ExternalLink, Wrench, Lightbulb, Info, History, Tag, List, Plus, GitBranch, Map, Mail, X } from 'lucide-react';

import { RecordPropertiesView } from './RecordPropertiesView';
import { ImportItemDetailsView } from './ImportItemDetailsView';
import { SchemaEditor, ReferencesManager, LinksManager } from '../semantic';
import { InterpretationInspectorView } from './interpretation/InterpretationInspectorView';
import { useNode, useRecord, useInterpretationAvailable } from '../../api/hooks';
import { useUIStore, type InspectorTabId } from '../../stores/uiStore';
import { useWorkspaceContextOptional } from '../../workspace/WorkspaceContext';
import { BUILT_IN_WORKSPACES } from '../../workspace/workspacePresets';
import { getWorkspaceColorClasses } from '../../workspace/workspaceColors';
import { ActionDetailsPanel } from '../inspector/ActionDetailsPanel';
import { ActionEventsPanel } from '../inspector/ActionEventsPanel';
import { NarrativeThreadPanel } from '../inspector/NarrativeThreadPanel';
import { MappingsPanel } from '../inspector/MappingsPanel';
import { useCollectionModeOptional } from '../../workflows/export/context/CollectionModeProvider';
import type { Selection } from '../../types/ui';
import type { ImportPlan } from '../../api/hooks/imports';

// Re-export from canonical location for backward compatibility
export type { InspectorTabId } from '../../types/ui';

interface Tab {
    id: InspectorTabId;
    label: string;
    icon: React.ElementType;
}

// Action-specific tabs
const ACTION_TABS: Tab[] = [
    { id: 'details', label: 'Details', icon: Info },
    { id: 'narrative_thread', label: 'Thread', icon: GitBranch },
    { id: 'mappings', label: 'Mappings', icon: Map },
    { id: 'execution_log', label: 'Events', icon: History },
];

// Import item-specific tabs
const IMPORT_TABS: Tab[] = [
    { id: 'import_details', label: 'Details', icon: FileText },
    { id: 'import_classification', label: 'Classification', icon: Tag },
    { id: 'import_fields', label: 'Fields', icon: List },
];

// Email-specific tabs
const EMAIL_TABS: Tab[] = [
    { id: 'email_details', label: 'Details', icon: Mail },
    { id: 'email_mappings', label: 'Mappings', icon: Map },
];

/**
 * Props for panel-local import context.
 * When provided, the inspector uses this instead of global uiStore.
 */
export interface SelectionInspectorProps {
    importContext?: {
        plan: ImportPlan | null;
        selectedItemId: string | null;
        onSelectItem?: (id: string | null) => void;
    };
    onClose?: () => void;
}

/**
 * Determines whether a selection should be accepted by a bound inspector.
 * When bound, the inspector only shows selections from workspace-scoped origins.
 */
function shouldAcceptSelection(selection: Selection, isBound: (panelId: string) => boolean): boolean {
    if (!selection) return true;
    const origin = selection.origin;
    // No origin = global (command palette, keyboard shortcut) — always accept
    if (!origin) return true;
    // center-workspace is always workspace-relevant
    if (origin === 'center-workspace') return true;
    // Accept if origin panel is also bound to this workspace
    if (isBound(origin)) return true;
    // Reject: origin is from a panel outside the workspace scope
    return false;
}

export function SelectionInspector({ importContext, onClose }: SelectionInspectorProps = {}) {
    const { selection: globalSelection, inspectorTabMode, setInspectorMode, importPlan: globalPlan } = useUIStore();
    const collectionMode = useCollectionModeOptional();
    const wsCtx = useWorkspaceContextOptional();

    const isBound = wsCtx?.isBound('selection-inspector') ?? false;
    const activeWorkspaceId = wsCtx?.workspaceId ?? null;
    const activeWorkspace = useMemo(
        () => activeWorkspaceId ? BUILT_IN_WORKSPACES.find((w) => w.id === activeWorkspaceId) ?? null : null,
        [activeWorkspaceId],
    );
    const colorClasses = getWorkspaceColorClasses(isBound ? activeWorkspace?.color : null);

    // Use import context if provided, otherwise fall back to global store
    const rawSelection = importContext?.selectedItemId
        ? { type: 'import_item' as const, id: importContext.selectedItemId }
        : globalSelection;

    // When bound, filter selections to workspace-scoped origins only
    const isBoundFn = wsCtx?.isBound ?? (() => false);
    const selection = isBound && rawSelection && !shouldAcceptSelection(rawSelection, isBoundFn)
        ? null
        : rawSelection;

    const plan = importContext?.plan ?? globalPlan;

    // Derive IDs from selection
    const inspectedNodeId = selection?.type === 'node' ? selection.id : null;
    const inspectedRecordId = selection?.type === 'record' ? selection.id : null;
    const inspectedActionId = selection?.type === 'action' ? selection.id : null;
    const inspectedEmailId = selection?.type === 'email' ? selection.id : null;
    const inspectedImportItemId = selection?.type === 'import_item' ? selection.id : null;
    const inspectorMode = inspectorTabMode;

    const { data: node } = useNode(inspectedNodeId);
    const { data: record } = useRecord(inspectedRecordId);

    // Check if interpretation data is available for this action
    const { data: interpretationStatus } = useInterpretationAvailable(inspectedActionId);
    const hasInterpretation = interpretationStatus?.available ?? false;

    const inspectedItem = node || record;
    const isNode = !!node;
    const isRecord = !!record;
    const isAction = !!inspectedActionId;
    const isEmail = !!inspectedEmailId;
    const isImportItem = !!inspectedImportItemId;

    // Determine selection type for routing
    const selectionType = isImportItem ? 'import_item' : isEmail ? 'email' : isAction ? 'action' : (inspectedItem ? 'node_record' : null);

    // Empty state
    if (!inspectedItem && !isAction && !isEmail && !isImportItem) {
        return (
            <div className="bg-ws-panel-bg flex flex-col h-full overflow-hidden">
                <div className="h-10 border-b border-ws-panel-border flex items-center justify-between px-3 bg-ws-bg/50">
                    <span className="text-xs text-ws-muted">Select an item to inspect</span>
                    <div className="flex items-center">
                        {isBound && activeWorkspace && (
                            <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded', colorClasses.bg100, colorClasses.text700)}>
                                {activeWorkspace.label}
                            </span>
                        )}
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="ml-auto px-1.5 h-full flex items-center text-ws-muted hover:text-ws-text-secondary transition-colors"
                                title="Close inspector"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex-1 flex items-center justify-center text-xs text-ws-muted p-4 text-center">
                    <div>
                        <p className="mb-2">
                            {isBound && activeWorkspace
                                ? `No selection in ${activeWorkspace.label}`
                                : 'No selection'}
                        </p>
                        <p className="text-ws-muted">
                            Press <kbd className="px-1 py-0.5 bg-[var(--ws-row-expanded-bg,rgba(63,92,110,0.04))] rounded text-ws-text-secondary">Ctrl+D</kbd> to quick declare
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Build available tabs based on selection type
    const tabs: Tab[] = selectionType === 'import_item'
        ? IMPORT_TABS
        : selectionType === 'email'
            ? EMAIL_TABS
            : selectionType === 'action'
                ? ACTION_TABS
                : [
                { id: 'record', label: 'Record', icon: FileText },
                ...(hasInterpretation ? [{ id: 'interpretation' as const, label: 'Interpretation', icon: Lightbulb }] : []),
                ...(isAction ? [{ id: 'references' as const, label: 'References', icon: Link2 }] : []),
                ...(isRecord ? [{ id: 'links' as const, label: 'Links', icon: ExternalLink }] : []),
                { id: 'schema', label: 'Schema', icon: Wrench },
            ];

    // Auto-correct tab mode if current mode is invalid for selection type
    const validTabIds = tabs.map(t => t.id);
    const effectiveTab = validTabIds.includes(inspectorMode)
        ? inspectorMode
        : tabs[0]?.id || 'record';

    // Determine which view to render
    const renderView = () => {
        // Import item selection routing
        if (selectionType === 'import_item' && inspectedImportItemId) {
            return <ImportItemDetailsView itemId={inspectedImportItemId} tab={effectiveTab} plan={plan} />;
        }

        // Email selection routing
        if (selectionType === 'email' && inspectedEmailId) {
            switch (effectiveTab) {
                case 'email_details':
                    return (
                        <div className="p-4">
                            <p className="text-xs font-mono text-ws-muted">{inspectedEmailId}</p>
                        </div>
                    );
                case 'email_mappings':
                    return <MappingsPanel className="p-0" />;
                default:
                    return null;
            }
        }

        // Action selection routing
        if (selectionType === 'action' && inspectedActionId) {
            switch (effectiveTab) {
                case 'details':
                    return <ActionDetailsPanel actionId={inspectedActionId} />;
                case 'narrative_thread':
                    return <NarrativeThreadPanel actionId={inspectedActionId} />;
                case 'mappings':
                    return <MappingsPanel actionId={inspectedActionId} />;
                case 'execution_log':
                    return <ActionEventsPanel actionId={inspectedActionId} />;
                default:
                    return <ActionDetailsPanel actionId={inspectedActionId} />;
            }
        }

        // Node/Record selection routing
        switch (effectiveTab) {
            case 'record':
                if (inspectedItem) {
                    return <RecordPropertiesView itemId={inspectedItem.id} isNode={isNode} />;
                }
                return null;
            case 'interpretation':
                if (inspectedActionId) {
                    return <InterpretationInspectorView actionId={inspectedActionId} />;
                }
                // Fallback to record view
                if (inspectedItem) {
                    return <RecordPropertiesView itemId={inspectedItem.id} isNode={isNode} />;
                }
                return null;
            case 'schema':
                if (inspectedItem) {
                    return <SchemaEditor itemId={inspectedItem.id} isNode={isNode} />;
                }
                return null;
            case 'references':
                if (isAction && inspectedActionId) {
                    return <ReferencesManager actionId={inspectedActionId} />;
                }
                // Fallback to record view
                if (inspectedItem) {
                    return <RecordPropertiesView itemId={inspectedItem.id} isNode={isNode} />;
                }
                return null;
            case 'links':
                if (isRecord && inspectedItem) {
                    return <LinksManager recordId={inspectedItem.id} />;
                }
                // Fallback to record view
                if (inspectedItem) {
                    return <RecordPropertiesView itemId={inspectedItem.id} isNode={isNode} />;
                }
                return null;
            default:
                if (inspectedItem) {
                    return <RecordPropertiesView itemId={inspectedItem.id} isNode={isNode} />;
                }
                return null;
        }
    };

    return (
        <div
            className="bg-ws-panel-bg flex flex-col h-full overflow-hidden"
            data-aa-component="SelectionInspector"
            data-aa-view={effectiveTab}
            data-aa-selection-type={selectionType}
        >
            {/* Tab Selector Header */}
            <div className="h-10 border-b border-ws-panel-border flex items-center bg-ws-bg/50 px-1 shrink-0">
                {isBound && activeWorkspace && (
                    <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded ml-1 mr-1 shrink-0', colorClasses.bg100, colorClasses.text700)}>
                        {activeWorkspace.label}
                    </span>
                )}
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = effectiveTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setInspectorMode(tab.id)}
                            className={clsx(
                                'flex-1 h-full flex items-center justify-center gap-1.5 text-xs font-medium transition-all relative',
                                isActive ? 'text-[var(--ws-accent,#3F5C6E)]' : 'text-ws-muted hover:text-ws-text-secondary'
                            )}
                            data-aa-component="SelectionInspector"
                            data-aa-id={`tab-${tab.id}`}
                            data-aa-action="switch-tab"
                        >
                            <Icon size={14} />
                            <span>{tab.label}</span>
                            {isActive && (
                                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--ws-accent,#3F5C6E)] rounded-t" />
                            )}
                        </button>
                    );
                })}

                {/* Add to Collection button */}
                {collectionMode?.isCollecting && inspectedItem && (
                    <button
                        onClick={() => {
                            const type = isRecord ? 'record' : 'node';
                            const label = isRecord ? record?.unique_name : node?.title;
                            collectionMode.addToCollection({
                                type,
                                sourceId: inspectedItem.id,
                                displayLabel: label || 'Unknown',
                            });
                        }}
                        disabled={collectionMode.isInCollection(inspectedItem.id)}
                        className={clsx(
                            'ml-auto px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors',
                            collectionMode.isInCollection(inspectedItem.id)
                                ? 'bg-emerald-100 text-emerald-700 cursor-default'
                                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        )}
                        title={collectionMode.isInCollection(inspectedItem.id) ? 'Already in collection' : 'Add to collection'}
                    >
                        <Plus size={12} />
                        {collectionMode.isInCollection(inspectedItem.id) ? 'Added' : 'Add'}
                    </button>
                )}

                {/* Close button */}
                {onClose && (
                    <button
                        onClick={onClose}
                        className={clsx(
                            'px-1.5 h-full flex items-center text-ws-muted hover:text-ws-text-secondary transition-colors',
                            collectionMode?.isCollecting && inspectedItem ? 'ml-1' : 'ml-auto'
                        )}
                        title="Close inspector"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* View Content (scrollable) */}
            <div className="flex-1 overflow-y-auto custom-scroll p-5">{renderView()}</div>
        </div>
    );
}

/** @deprecated Use SelectionInspector instead */
export const RecordInspector = SelectionInspector;

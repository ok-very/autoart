/**
 * SelectionInspector - Unified Workbench Inspector
 *
 * Routes by selection.type (node | record | action | import_item) to show context-appropriate tabs.
 * Includes always-visible composer footer for quick action declaration.
 *
 * Tab Structure:
 * - Node/Record: Record | Interpretation | References | Links | Schema
 * - Action: Details | Execution Log
 * - Import Item: Details | Classification | Fields
 *
 * Layout:
 * - Tab header (dynamic based on selection type)
 * - Scrollable content area
 * - Pinned footer composer
 */

import { clsx } from 'clsx';
import { FileText, Link2, ExternalLink, Wrench, Lightbulb, Info, History, Tag, List } from 'lucide-react';

import { RecordPropertiesView } from './RecordPropertiesView';
import { ImportItemDetailsView } from './ImportItemDetailsView';
import { SchemaEditor, ReferencesManager, LinksManager } from '../semantic';
import { InterpretationInspectorView } from './interpretation/InterpretationInspectorView';
import { useNode, useRecord, useInterpretationAvailable } from '../../api/hooks';
import { useUIStore, type InspectorTabId } from '../../stores/uiStore';
import { ActionDetailsPanel } from '../inspector/ActionDetailsPanel';
import { ActionEventsPanel } from '../inspector/ActionEventsPanel';
import { InspectorFooterComposer } from '../inspector/InspectorFooterComposer';

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
    { id: 'execution_log', label: 'Events', icon: History },
];

// Import item-specific tabs
const IMPORT_TABS: Tab[] = [
    { id: 'import_details', label: 'Details', icon: FileText },
    { id: 'import_classification', label: 'Classification', icon: Tag },
    { id: 'import_fields', label: 'Fields', icon: List },
];

export function SelectionInspector() {
    const { selection, inspectorTabMode, setInspectorMode, inspectorWidth } = useUIStore();

    // Derive IDs from selection
    const inspectedNodeId = selection?.type === 'node' ? selection.id : null;
    const inspectedRecordId = selection?.type === 'record' ? selection.id : null;
    const inspectedActionId = selection?.type === 'action' ? selection.id : null;
    const inspectedImportItemId = selection?.type === 'import_item' ? selection.id : null;
    const inspectorMode = inspectorTabMode;

    const { data: node } = useNode(inspectedNodeId);
    const { data: record } = useRecord(inspectedRecordId);

    // Check if interpretation data is available for this action
    const { data: interpretationStatus } = useInterpretationAvailable(inspectedActionId);
    const hasInterpretation = interpretationStatus?.available ?? false;

    const inspectedItem = node || record;
    const isNode = !!node;
    const isTask = node?.type === 'task';
    const isRecord = !!record;
    const isAction = !!inspectedActionId;
    const isImportItem = !!inspectedImportItemId;

    // Determine selection type for routing
    const selectionType = isImportItem ? 'import_item' : isAction ? 'action' : (inspectedItem ? 'node_record' : null);

    // Empty state
    if (!inspectedItem && !isAction && !isImportItem) {
        return (
            <aside
                className="bg-white border-l border-slate-200 flex flex-col shrink-0"
                style={{ width: inspectorWidth }}
            >
                <div className="h-14 border-b border-slate-100 flex items-center justify-center px-5 bg-slate-50/50">
                    <span className="text-xs text-slate-400">Select an item to inspect</span>
                </div>
                {/* Footer composer still available even without selection */}
                <div className="flex-1" />
                <InspectorFooterComposer />
            </aside>
        );
    }

    // Build available tabs based on selection type
    const tabs: Tab[] = selectionType === 'import_item'
        ? IMPORT_TABS
        : selectionType === 'action'
            ? ACTION_TABS
            : [
                { id: 'record', label: 'Record', icon: FileText },
                ...(hasInterpretation ? [{ id: 'interpretation' as const, label: 'Interpretation', icon: Lightbulb }] : []),
                ...(isTask ? [{ id: 'references' as const, label: 'References', icon: Link2 }] : []),
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
            return <ImportItemDetailsView itemId={inspectedImportItemId} tab={effectiveTab} />;
        }

        // Action selection routing
        if (selectionType === 'action' && inspectedActionId) {
            switch (effectiveTab) {
                case 'details':
                    return <ActionDetailsPanel actionId={inspectedActionId} />;
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
                if (isTask && inspectedItem) {
                    return <ReferencesManager taskId={inspectedItem.id} />;
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
        <aside
            className="bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-xl z-30"
            style={{ width: inspectorWidth }}
            data-aa-component="SelectionInspector"
            data-aa-view={effectiveTab}
            data-aa-selection-type={selectionType}
        >
            {/* Tab Selector Header */}
            <div className="h-12 border-b border-slate-100 flex items-center bg-slate-50/50 px-1 shrink-0">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = effectiveTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setInspectorMode(tab.id)}
                            className={clsx(
                                'flex-1 h-full flex items-center justify-center gap-1.5 text-xs font-medium transition-all relative',
                                isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                            )}
                            data-aa-component="SelectionInspector"
                            data-aa-id={`tab-${tab.id}`}
                            data-aa-action="switch-tab"
                        >
                            <Icon size={14} />
                            <span>{tab.label}</span>
                            {isActive && (
                                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-t" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* View Content (scrollable) */}
            <div className="flex-1 overflow-y-auto custom-scroll p-5">{renderView()}</div>

            {/* Footer Composer (pinned) */}
            <InspectorFooterComposer />
        </aside>
    );
}

/** @deprecated Use SelectionInspector instead */
export const RecordInspector = SelectionInspector;

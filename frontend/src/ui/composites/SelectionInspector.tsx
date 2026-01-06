/**
 * SelectionInspector - Composite inspector panel router
 *
 * This is a thin shell that:
 * 1. Determines what's being inspected (node, record, or action)
 * 2. Builds the available tabs based on context
 * 3. Routes to the appropriate view component
 *
 * Tabs:
 * - record: Record/node field editing
 * - interpretation: Semantic interpretation review (for import items)
 * - schema: Definition schema editing
 * - references: Task reference management
 * - links: Record-to-record links
 */

import { FileText, Link2, ExternalLink, Wrench, Lightbulb } from 'lucide-react';
import { clsx } from 'clsx';
import { useUIStore, type InspectorTabId } from '../../stores/uiStore';
import { useNode, useRecord, useInterpretationAvailable } from '../../api/hooks';
import { RecordPropertiesView } from './RecordPropertiesView';
import { SchemaEditor, ReferencesManager, LinksManager } from '../semantic';
import { InterpretationInspectorView } from './interpretation/InterpretationInspectorView';

// Re-export from canonical location for backward compatibility
export type { InspectorTabId } from '../../types/ui';

interface Tab {
    id: InspectorTabId;
    label: string;
    icon: React.ElementType;
}

export function SelectionInspector() {
    const { selection, inspectorTabMode, setInspectorMode, inspectorWidth } = useUIStore();

    // Derive node/record IDs from selection
    const inspectedNodeId = selection?.type === 'node' ? selection.id : null;
    const inspectedRecordId = selection?.type === 'record' ? selection.id : null;
    const inspectedActionId = selection?.type === 'action' ? selection.id : null;
    // inspectorTabMode is now properly typed as InspectorTabId in uiStore
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

    // Empty state
    if (!inspectedItem && !isAction) {
        return (
            <aside
                className="bg-white border-l border-slate-200 flex flex-col shrink-0"
                style={{ width: inspectorWidth }}
            >
                <div className="h-14 border-b border-slate-100 flex items-center justify-center px-5 bg-slate-50/50">
                    <span className="text-xs text-slate-400">Select an item to inspect</span>
                </div>
            </aside>
        );
    }

    // Build available tabs based on context
    // - record: Always shown
    // - interpretation: Show for items with interpretation data available
    // - references: Only for tasks (nodes with type='task')
    // - links: Only for records (not hierarchy nodes)
    // - schema: Always shown
    const tabs: Tab[] = [
        { id: 'record', label: 'Record', icon: FileText },
        ...(hasInterpretation ? [{ id: 'interpretation' as const, label: 'Interpretation', icon: Lightbulb }] : []),
        ...(isTask ? [{ id: 'references' as const, label: 'References', icon: Link2 }] : []),
        ...(isRecord ? [{ id: 'links' as const, label: 'Links', icon: ExternalLink }] : []),
        { id: 'schema', label: 'Schema', icon: Wrench },
    ];

    // Determine which view to render
    const renderView = () => {
        switch (inspectorMode) {
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
            data-aa-view={inspectorMode}
        >
            {/* Tab Selector Header */}
            <div className="h-12 border-b border-slate-100 flex items-center bg-slate-50/50 px-1">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = inspectorMode === tab.id;
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

            {/* View Content */}
            <div className="flex-1 overflow-y-auto custom-scroll p-5">{renderView()}</div>
        </aside>
    );
}

/** @deprecated Use SelectionInspector instead */
export const RecordInspector = SelectionInspector;

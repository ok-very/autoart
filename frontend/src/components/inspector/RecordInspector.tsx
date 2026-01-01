import { FileText, Link2, ExternalLink, Wrench } from 'lucide-react';
import { clsx } from 'clsx';
import { useUIStore } from '../../stores/uiStore';
import { useNode, useRecord } from '../../api/hooks';
import { RecordPropertiesView } from './views/RecordPropertiesView';
import { SchemaEditorView } from './views/SchemaEditorView';
import { ReferencesManager } from './views/ReferencesManager';
import { LinksView } from './views/LinksView';

type TabId = 'record' | 'references' | 'links' | 'schema';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

/**
 * RecordInspector - Main inspector panel router
 *
 * This is a thin shell that:
 * 1. Determines what's being inspected (node or record)
 * 2. Builds the available tabs based on context
 * 3. Routes to the appropriate view component
 *
 * The actual view logic is in the extracted components:
 * - RecordPropertiesView: Record/node field editing
 * - SchemaEditorView: Definition schema editing
 * - ReferencesManager: Task reference management
 * - LinksView: Record-to-record links
 */
export function RecordInspector() {
  const { selection, inspectorTabMode, setInspectorMode, inspectorWidth } = useUIStore();

  // Derive node/record IDs from selection
  const inspectedNodeId = selection?.type === 'node' ? selection.id : null;
  const inspectedRecordId = selection?.type === 'record' ? selection.id : null;
  const inspectorMode = inspectorTabMode;

  const { data: node } = useNode(inspectedNodeId);
  const { data: record } = useRecord(inspectedRecordId);

  const inspectedItem = node || record;
  const isNode = !!node;
  const isTask = node?.type === 'task';
  const isRecord = !!record;

  // Empty state
  if (!inspectedItem) {
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
  // - references: Only for tasks (nodes with type='task')
  // - links: Only for records (not hierarchy nodes)
  // - schema: Always shown
  const tabs: Tab[] = [
    { id: 'record', label: 'Record', icon: FileText },
    ...(isTask ? [{ id: 'references' as const, label: 'References', icon: Link2 }] : []),
    ...(isRecord ? [{ id: 'links' as const, label: 'Links', icon: ExternalLink }] : []),
    { id: 'schema', label: 'Schema', icon: Wrench },
  ];

  // Determine which view to render
  const renderView = () => {
    switch (inspectorMode) {
      case 'record':
        return <RecordPropertiesView itemId={inspectedItem.id} isNode={isNode} />;
      case 'schema':
        return <SchemaEditorView itemId={inspectedItem.id} isNode={isNode} />;
      case 'references':
        if (isTask) {
          return <ReferencesManager taskId={inspectedItem.id} />;
        }
        // Fallback to record view if references not available
        return <RecordPropertiesView itemId={inspectedItem.id} isNode={isNode} />;
      case 'links':
        if (isRecord) {
          return <LinksView recordId={inspectedItem.id} />;
        }
        // Fallback to record view if links not available
        return <RecordPropertiesView itemId={inspectedItem.id} isNode={isNode} />;
      default:
        return <RecordPropertiesView itemId={inspectedItem.id} isNode={isNode} />;
    }
  };

  return (
    <aside
      className="bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-xl z-30"
      style={{ width: inspectorWidth }}
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

import { useCallback, useState, useEffect } from 'react';
import { Header } from '../components/layout/Header';
import { RegistrySidebar } from '../components/records/RegistrySidebar';
import { UniversalTableView } from '../components/tables/UniversalTableView';
import { BottomDrawer } from '../components/drawer/BottomDrawer';
import { ResizeHandle } from '../components/common/ResizeHandle';
import { useUIStore, isRecordsViewMode } from '../stores/uiStore';
import { IngestionView, RecordInspector } from '../ui/composites';

type RegistrySection = 'records' | 'actions';

/**
 * Registry page for managing both Record Types and Action Types.
 * 
 * This is the unified view for the definition registry:
 * - Record Types: Data definitions (Contact, Location, Artwork, etc.)
 * - Action Types: Action recipes (Task, Subtask, Meeting, etc.)
 *
 * Uses the UniversalTableView component for visualization.
 * Layout: Left sidebar (type registry) | Main table (instances) | Right inspector
 *
 * View Modes:
 * - list: Standard table view
 * - ingest: Data ingestion/import interface
 */
export function RegistryPage() {
  const { inspectorWidth, setInspectorWidth, viewMode, setViewMode } = useUIStore();
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<RegistrySection>('records');

  // Ensure we're using a valid RecordsViewMode when on this page
  useEffect(() => {
    if (!isRecordsViewMode(viewMode)) {
      setViewMode('list');
    }
  }, [viewMode, setViewMode]);

  const handleSidebarResize = useCallback(
    (delta: number) => {
      setSidebarWidth((w) => Math.max(200, Math.min(400, w + delta)));
    },
    []
  );

  const handleInspectorResize = useCallback(
    (delta: number) => {
      setInspectorWidth(inspectorWidth + delta);
    },
    [inspectorWidth, setInspectorWidth]
  );

  const handleSelectDefinition = (id: string | null, section: RegistrySection) => {
    setSelectedDefinitionId(id);
    setActiveSection(section);
  };

  // Determine which view to show based on view mode
  const isIngestMode = viewMode === 'ingest';

  return (
    <div className="flex flex-col h-full">
      <Header />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 overflow-hidden">
          {/* Ingest mode - full width ingestion view */}
          {isIngestMode ? (
            <IngestionView />
          ) : (
            <>
              {/* Registry Sidebar - shows both Record Types and Action Types */}
              <RegistrySidebar
                width={sidebarWidth}
                selectedDefinitionId={selectedDefinitionId}
                onSelectDefinition={handleSelectDefinition}
                activeSection={activeSection}
              />
              <ResizeHandle direction="right" onResize={handleSidebarResize} />

              {/* Main Table Area */}
              <div className="flex-1 overflow-hidden">
                <UniversalTableView
                  definitionId={selectedDefinitionId}
                  onDefinitionChange={(id) => setSelectedDefinitionId(id)}
                  showDefinitionSelector={false}
                  allowCreate
                  allowBulkDelete
                  allowEdit
                  className="h-full"
                />
              </div>

              <ResizeHandle direction="left" onResize={handleInspectorResize} />

              {/* Right Inspector */}
              <RecordInspector />
            </>
          )}
        </div>
        <BottomDrawer />
      </div>
    </div>
  );
}

// Re-export as RecordsPage for backwards compatibility
export { RegistryPage as RecordsPage };

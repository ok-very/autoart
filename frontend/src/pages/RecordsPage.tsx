import { useCallback, useState, useEffect } from 'react';
import { Header } from '../components/layout/Header';
import { RecordTypeSidebar } from '../components/records/RecordTypeSidebar';
import { UniversalTableView } from '../components/tables/UniversalTableView';
import { BottomDrawer } from '../components/drawer/BottomDrawer';
import { ResizeHandle } from '../components/common/ResizeHandle';
import { useUIStore, isRecordsViewMode } from '../stores/uiStore';
import { IngestionView, RecordInspector } from '../ui/composites';

/**
 * Records workspace page for managing records (contacts, artworks, locations, etc.)
 * outside of the project hierarchy context.
 *
 * Uses the UniversalTableView component for unified visualization of any record type.
 * Layout: Left sidebar (definition types) | Main table (records) | Right inspector
 *
 * View Modes:
 * - list: Standard table view of records
 * - ingest: Data ingestion/import interface
 */
export function RecordsPage() {
  const { inspectorWidth, setInspectorWidth, viewMode, setViewMode } = useUIStore();
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null);

  // Ensure we're using a valid RecordsViewMode when on this page
  useEffect(() => {
    if (!isRecordsViewMode(viewMode)) {
      setViewMode('list');
    }
  }, [viewMode, setViewMode]);

  const handleSidebarResize = useCallback(
    (delta: number) => {
      setSidebarWidth((w) => Math.max(180, Math.min(400, w + delta)));
    },
    []
  );

  const handleInspectorResize = useCallback(
    (delta: number) => {
      setInspectorWidth(inspectorWidth + delta);
    },
    [inspectorWidth, setInspectorWidth]
  );

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
              {/* Record Type Sidebar */}
              <RecordTypeSidebar
                width={sidebarWidth}
                selectedDefinitionId={selectedDefinitionId}
                onSelectDefinition={setSelectedDefinitionId}
              />
              <ResizeHandle direction="right" onResize={handleSidebarResize} />

              {/* Main Table Area - Using UniversalTableView for unified visualization */}
              <div className="flex-1 overflow-hidden">
                <UniversalTableView
                  definitionId={selectedDefinitionId}
                  onDefinitionChange={setSelectedDefinitionId}
                  showDefinitionSelector={false} // Using sidebar instead
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

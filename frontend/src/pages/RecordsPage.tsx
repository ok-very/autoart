/**
 * RecordsPage
 *
 * Registry view for Record Definitions and Record Instances.
 *
 * Structure:
 * - Definitions tab: Record Definitions (definition_kind='record')
 * - Instances tab: Record instances filtered by selected definition
 *
 * Layout: Left sidebar (definition list) | Main content | Right inspector
 */

import { useCallback, useState, useEffect } from 'react';
import { Database } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { UniversalTableView } from '../components/tables/UniversalTableView';
import { BottomDrawer } from '../components/drawer/BottomDrawer';
import { ResizeHandle } from '../components/common/ResizeHandle';
import { RegistryPageHeader, DefinitionListSidebar, type RegistryTab } from '../components/registry';
import { useUIStore, isRecordsViewMode } from '../stores/uiStore';
import { RecordInspector } from '../ui/composites';

export function RecordsPage() {
  const { inspectorWidth, setInspectorWidth, viewMode, setViewMode, openDrawer } = useUIStore();
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RegistryTab>('instances');

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

  const handleSelectDefinition = (id: string | null) => {
    setSelectedDefinitionId(id);
  };

  const handleCreateDefinition = () => {
    openDrawer('create-definition', { definitionKind: 'record' });
  };

  return (
    <div className="flex flex-col h-full">
      <Header />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 overflow-hidden">
          {/* Definition Sidebar - Records only */}
          <DefinitionListSidebar
            width={sidebarWidth}
            selectedDefinitionId={selectedDefinitionId}
            onSelectDefinition={handleSelectDefinition}
            definitionKind="record"
          />
          <ResizeHandle direction="right" onResize={handleSidebarResize} />

          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Page Header with tabs */}
            <RegistryPageHeader
              title="Records"
              icon={Database}
              showCreateButton={activeTab === 'definitions'}
              onCreateClick={handleCreateDefinition}
              createLabel="Create Record Definition"
              activeTab={activeTab}
              onTabChange={setActiveTab}
              showTabSwitch={true}
            />

            {/* Content based on tab */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'definitions' ? (
                <div className="h-full flex items-center justify-center text-slate-400">
                  <div className="text-center">
                    <p className="text-lg font-medium text-slate-600">Record Definitions</p>
                    <p>Select a definition from the sidebar to view its schema.</p>
                  </div>
                </div>
              ) : (
                <UniversalTableView
                  definitionId={selectedDefinitionId}
                  onDefinitionChange={(id) => setSelectedDefinitionId(id)}
                  showDefinitionSelector={false}
                  allowCreate
                  allowBulkDelete
                  allowEdit
                  className="h-full"
                />
              )}
            </div>
          </div>

          <ResizeHandle direction="left" onResize={handleInspectorResize} />

          {/* Right Inspector */}
          <RecordInspector />
        </div>
        <BottomDrawer />
      </div>
    </div>
  );
}

// Legacy export alias
export { RecordsPage as RegistryPage };

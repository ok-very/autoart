import { useCallback, useState } from 'react';
import { Header } from '../components/layout/Header';
import { RecordTypeSidebar } from '../components/records/RecordTypeSidebar';
import { RecordGrid } from '../components/records/RecordGrid';
import { RecordInspector } from '../components/inspector/RecordInspector';
import { BottomDrawer } from '../components/drawer/BottomDrawer';
import { ResizeHandle } from '../components/common/ResizeHandle';
import { useUIStore } from '../stores/uiStore';

/**
 * Records workspace page for managing records (contacts, artworks, locations, etc.)
 * outside of the project hierarchy context.
 *
 * Layout: Left sidebar (definition types) | Main grid (records) | Right inspector
 */
export function RecordsPage() {
  const { inspectorWidth, setInspectorWidth } = useUIStore();
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col h-full">
      <Header />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 overflow-hidden">
          {/* Record Type Sidebar */}
          <RecordTypeSidebar
            width={sidebarWidth}
            selectedDefinitionId={selectedDefinitionId}
            onSelectDefinition={setSelectedDefinitionId}
          />
          <ResizeHandle direction="right" onResize={handleSidebarResize} />

          {/* Main Grid Area */}
          <RecordGrid
            definitionId={selectedDefinitionId}
          />

          <ResizeHandle direction="left" onResize={handleInspectorResize} />

          {/* Right Inspector */}
          <RecordInspector />
        </div>
        <BottomDrawer />
      </div>
    </div>
  );
}

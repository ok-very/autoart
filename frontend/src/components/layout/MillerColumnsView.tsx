import { useState, useEffect, useRef } from 'react';
import { useHierarchyStore } from '../../stores/hierarchyStore';
import { useUIStore } from '../../stores/uiStore';
import { MillerColumn } from './MillerColumn';
import type { NodeType } from '../../types';

// Selection state for each level
interface ColumnSelections {
  project: string | null;
  process: string | null;
  stage: string | null;
  subprocess: string | null;
  task: string | null;
}

export function MillerColumnsView() {
  const { selectedProjectId, getChildren, getNode, selectNode } = useHierarchyStore();
  const { inspectNode } = useUIStore();
  const containerRef = useRef<HTMLDivElement>(null);

  // Track selection at each level
  const [selections, setSelections] = useState<ColumnSelections>({
    project: selectedProjectId,
    process: null,
    stage: null,
    subprocess: null,
    task: null,
  });

  // Sync with external project selection
  useEffect(() => {
    if (selectedProjectId !== selections.project) {
      setSelections({
        project: selectedProjectId,
        process: null,
        stage: null,
        subprocess: null,
        task: null,
      });
    }
  }, [selectedProjectId]);

  // Auto-scroll right when new columns appear
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        left: containerRef.current.scrollWidth,
        behavior: 'smooth',
      });
    }
  }, [selections]);

  const handleSelect = (level: NodeType, id: string) => {
    const node = getNode(id);
    if (!node) return;

    // Clear selections for all levels below this one
    const newSelections: ColumnSelections = { ...selections };

    switch (level) {
      case 'project':
        newSelections.project = id;
        newSelections.process = null;
        newSelections.stage = null;
        newSelections.subprocess = null;
        newSelections.task = null;
        break;
      case 'process':
        newSelections.process = id;
        newSelections.stage = null;
        newSelections.subprocess = null;
        newSelections.task = null;
        break;
      case 'stage':
        newSelections.stage = id;
        newSelections.subprocess = null;
        newSelections.task = null;
        break;
      case 'subprocess':
        newSelections.subprocess = id;
        newSelections.task = null;
        break;
      case 'task':
        newSelections.task = id;
        break;
    }

    setSelections(newSelections);

    // Open in inspector
    inspectNode(id);
    selectNode(id);
  };

  // Check if a node has children
  const hasChildren = (id: string): boolean => {
    return getChildren(id).length > 0;
  };

  // Get the most recently selected item for the inspector
  const getSelectedNode = () => {
    if (selections.task) return getNode(selections.task);
    if (selections.subprocess) return getNode(selections.subprocess);
    if (selections.stage) return getNode(selections.stage);
    if (selections.process) return getNode(selections.process);
    if (selections.project) return getNode(selections.project);
    return null;
  };

  const selectedNode = getSelectedNode();

  return (
    <div className="flex-1 flex flex-col bg-slate-100 overflow-hidden">
      <div
        ref={containerRef}
        className="flex flex-1 overflow-x-auto custom-scroll"
        style={{ scrollBehavior: 'smooth' }}
      >
        {/* Column 1: Projects */}
        <MillerColumn
          type="project"
          parentId={null}
          selectedId={selections.project}
          onSelect={(id) => handleSelect('project', id)}
          hasChildren={hasChildren}
        />

        {/* Column 2: Processes (if project selected) */}
        {selections.project && (
          <MillerColumn
            type="process"
            parentId={selections.project}
            selectedId={selections.process}
            onSelect={(id) => handleSelect('process', id)}
            hasChildren={hasChildren}
          />
        )}

        {/* Column 3: Stages (if process selected) */}
        {selections.process && (
          <MillerColumn
            type="stage"
            parentId={selections.process}
            selectedId={selections.stage}
            onSelect={(id) => handleSelect('stage', id)}
            hasChildren={hasChildren}
          />
        )}

        {/* Column 4: Subprocesses (if stage selected) */}
        {selections.stage && (
          <MillerColumn
            type="subprocess"
            parentId={selections.stage}
            selectedId={selections.subprocess}
            onSelect={(id) => handleSelect('subprocess', id)}
            hasChildren={hasChildren}
          />
        )}

        {/* Column 5: Tasks (if subprocess selected) */}
        {selections.subprocess && (
          <MillerColumn
            type="task"
            parentId={selections.subprocess}
            selectedId={selections.task}
            onSelect={(id) => handleSelect('task', id)}
            hasChildren={() => false}
          />
        )}

        {/* Mini Inspector Panel */}
        {selectedNode && (
          <div className="flex-shrink-0 w-96 bg-slate-50 border-l border-slate-200 flex flex-col">
            {/* Inspector Header */}
            <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Inspector
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200 capitalize">
                {selectedNode.type} Record
              </span>
            </div>

            {/* Inspector Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scroll">
              <div className="space-y-6">
                {/* Title */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                    Title
                  </label>
                  <div className="text-lg font-bold text-slate-800">
                    {selectedNode.title}
                  </div>
                </div>

                {/* UUID Badge */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="bg-white border border-slate-200 rounded px-2 py-1 flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono">UUID:</span>
                    <span className="text-xs font-mono text-slate-700">
                      {selectedNode.id.slice(0, 12)}
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded capitalize">
                    {selectedNode.type}
                  </span>
                </div>

                {/* Description Preview */}
                {selectedNode.description != null && (
                  <div className="pt-4 border-t border-slate-200">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">
                      Description
                    </h4>
                    <div className="p-3 bg-white border border-slate-200 rounded shadow-sm text-sm text-slate-700">
                      {/* Simple text extract from TipTap content */}
                      {typeof selectedNode.description === 'object'
                        ? 'Rich text content...'
                        : String(selectedNode.description as string)}
                    </div>
                  </div>
                )}

                {/* Metadata Preview */}
      {(() => {
        const metadata = (typeof selectedNode.metadata === 'string' 
          ? JSON.parse(selectedNode.metadata) 
          : selectedNode.metadata) as Record<string, unknown> || {};
          
        return metadata && Object.keys(metadata).length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Metadata</h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(metadata).slice(0, 5).map(([key, value]) => (
                <div key={key} className="text-xs">
                  <span className="text-slate-400">{key}:</span>{' '}
                  <span className="text-slate-700 font-medium truncate">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

                {/* Created Date */}
                <div className="pt-4 border-t border-slate-200 text-xs text-slate-400">
                  Created: {new Date(selectedNode.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Inspector Footer */}
            <div className="p-3 border-t border-slate-200 bg-white">
              <button
                onClick={() => inspectNode(selectedNode.id)}
                className="w-full bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded hover:bg-blue-700 shadow-sm transition-colors"
              >
                Open Full Editor
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

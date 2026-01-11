import { useState, useEffect, useRef } from 'react';

import { MillerColumn } from './MillerColumn';
import { useHierarchyStore } from '../../stores/hierarchyStore';
import { useUIStore } from '../../stores/uiStore';
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
  const { getChildren, getNode } = useHierarchyStore();
  const { activeProjectId, setSelection } = useUIStore();
  const containerRef = useRef<HTMLDivElement>(null);

  // Track selection at each level
  const [selections, setSelections] = useState<ColumnSelections>({
    project: activeProjectId,
    process: null,
    stage: null,
    subprocess: null,
    task: null,
  });

  // Sync with external project selection
  useEffect(() => {
    if (activeProjectId !== selections.project) {
      setSelections({
        project: activeProjectId,
        process: null,
        stage: null,
        subprocess: null,
        task: null,
      });
    }
  }, [activeProjectId]);

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

    // Set global selection
    setSelection({ type: 'node', id });
  };

  // Check if a node has children
  const hasChildren = (id: string): boolean => {
    return getChildren(id).length > 0;
  };


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
      </div>
    </div>
  );
}

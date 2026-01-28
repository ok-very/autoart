import { useState, useEffect, useRef, useMemo } from 'react';

import { MillerColumn } from './MillerColumn';
import { useProjects, useProjectTree } from '../../api/hooks';
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
  const { getChildren, getNode, setNodes } = useHierarchyStore();
  const { activeProjectId, setSelection, setActiveProject } = useUIStore();
  const containerRef = useRef<HTMLDivElement>(null);

  // Track user selections (except project which comes from store)
  const [userSelections, setUserSelections] = useState<Omit<ColumnSelections, 'project'>>({
    process: null,
    stage: null,
    subprocess: null,
    task: null,
  });

  // Derive full selections with project from store
  const selections = useMemo<ColumnSelections>(() => ({
    project: activeProjectId,
    ...userSelections,
  }), [activeProjectId, userSelections]);

  // Load projects list
  const { data: projects } = useProjects();

  // Load project tree when a project is selected
  const { data: projectTree } = useProjectTree(selections.project);

  // Populate hierarchy store with projects
  useEffect(() => {
    if (projects) {
      setNodes(projects);
    }
  }, [projects, setNodes]);

  // Populate hierarchy store with project tree
  useEffect(() => {
    if (projectTree) {
      setNodes(projectTree);
    }
  }, [projectTree, setNodes]);

  // Reset user selections when project changes
  const prevProjectIdRef = useRef(activeProjectId);
  useEffect(() => {
    if (activeProjectId !== prevProjectIdRef.current) {
      prevProjectIdRef.current = activeProjectId;
      // Defer setState to avoid synchronous cascading render
      requestAnimationFrame(() => {
        setUserSelections({
          process: null,
          stage: null,
          subprocess: null,
          task: null,
        });
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
    // For projects, we may not have the node in store yet (first click loads it)
    // So we allow selection even if getNode returns undefined for projects
    const node = getNode(id);
    if (!node && level !== 'project') return;

    // Clear selections for all levels below this one
    const newUserSelections: Omit<ColumnSelections, 'project'> = { ...userSelections };

    switch (level) {
      case 'project':
        newUserSelections.process = null;
        newUserSelections.stage = null;
        newUserSelections.subprocess = null;
        newUserSelections.task = null;
        // Also set active project in UI store so other components know
        setActiveProject(id);
        break;
      case 'process':
        newUserSelections.process = id;
        newUserSelections.stage = null;
        newUserSelections.subprocess = null;
        newUserSelections.task = null;
        break;
      case 'stage':
        newUserSelections.stage = id;
        newUserSelections.subprocess = null;
        newUserSelections.task = null;
        break;
      case 'subprocess':
        newUserSelections.subprocess = id;
        newUserSelections.task = null;
        break;
      case 'task':
        newUserSelections.task = id;
        break;
    }

    setUserSelections(newUserSelections);

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

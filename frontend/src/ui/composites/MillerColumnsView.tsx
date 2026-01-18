/**
 * MillerColumnsView - Miller columns browser for hierarchy navigation
 *
 * This is a COMPOSITE that provides a multi-column drill-down view
 * of the project hierarchy: Project → Process → Stage → Subprocess → Task
 *
 * Features:
 * - Progressive disclosure via column selection
 * - Auto-scroll to reveal new columns
 * - Synced with UI store for selection state
 */

import { useState, useEffect, useRef, useMemo } from 'react';

import { useHierarchyStore } from '../../stores/hierarchyStore';
import { useUIStore } from '../../stores/uiStore';
import type { NodeType } from '../../types';
import { MillerColumn } from '../../ui/molecules/MillerColumn';

// ==================== TYPES ====================

export interface MillerColumnsViewProps {
    /** Additional className */
    className?: string;
}

interface ColumnSelections {
    project: string | null;
    process: string | null;
    stage: string | null;
    subprocess: string | null;
    task: string | null;
}

// ==================== MILLER COLUMNS VIEW ====================

export function MillerColumnsView({ className }: MillerColumnsViewProps) {
    const { getChildren, getNode } = useHierarchyStore();
    const { activeProjectId, setSelection, openDrawer } = useUIStore();
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
    }, [activeProjectId, selections.project, setSelections]);

    // Auto-scroll right when new columns appear
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTo({
                left: containerRef.current.scrollWidth,
                behavior: 'smooth',
            });
        }
    }, [selections]);

    // Get items for each column
    const projects = useMemo(() => getChildren(null), [getChildren]);
    const processes = useMemo(
        () => (selections.project ? getChildren(selections.project) : []),
        [selections.project, getChildren]
    );
    const stages = useMemo(
        () => (selections.process ? getChildren(selections.process) : []),
        [selections.process, getChildren]
    );
    const subprocesses = useMemo(
        () => (selections.stage ? getChildren(selections.stage) : []),
        [selections.stage, getChildren]
    );
    const tasks = useMemo(
        () => (selections.subprocess ? getChildren(selections.subprocess) : []),
        [selections.subprocess, getChildren]
    );

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

    // Add handlers for each level
    const handleAddProject = () => openDrawer('create-project', {});
    const handleAddProcess = () => selections.project && openDrawer('create-node', { parentId: selections.project, nodeType: 'process' });
    const handleAddStage = () => selections.process && openDrawer('create-node', { parentId: selections.process, nodeType: 'stage' });
    const handleAddSubprocess = () => selections.stage && openDrawer('create-node', { parentId: selections.stage, nodeType: 'subprocess' });
    const handleAddTask = () => selections.subprocess && openDrawer('create-node', { parentId: selections.subprocess, nodeType: 'task' });

    return (
        <div
            className={`flex-1 flex flex-col bg-slate-100 overflow-hidden ${className || ''}`}
            data-aa-component="MillerColumnsView"
            data-aa-view="miller"
        >
            <div
                ref={containerRef}
                className="flex flex-1 overflow-x-auto custom-scroll"
                style={{ scrollBehavior: 'smooth' }}
            >
                {/* Column 1: Projects */}
                <MillerColumn
                    type="project"
                    items={projects}
                    selectedId={selections.project}
                    onSelect={(id) => handleSelect('project', id)}
                    onAdd={handleAddProject}
                    hasChildren={hasChildren}
                />

                {/* Column 2: Processes (if project selected) */}
                {selections.project && (
                    <MillerColumn
                        type="process"
                        items={processes}
                        selectedId={selections.process}
                        onSelect={(id) => handleSelect('process', id)}
                        onAdd={handleAddProcess}
                        hasChildren={hasChildren}
                    />
                )}

                {/* Column 3: Stages (if process selected) */}
                {selections.process && (
                    <MillerColumn
                        type="stage"
                        items={stages}
                        selectedId={selections.stage}
                        onSelect={(id) => handleSelect('stage', id)}
                        onAdd={handleAddStage}
                        hasChildren={hasChildren}
                    />
                )}

                {/* Column 4: Subprocesses (if stage selected) */}
                {selections.stage && (
                    <MillerColumn
                        type="subprocess"
                        items={subprocesses}
                        selectedId={selections.subprocess}
                        onSelect={(id) => handleSelect('subprocess', id)}
                        onAdd={handleAddSubprocess}
                        hasChildren={hasChildren}
                    />
                )}

                {/* Column 5: Tasks (if subprocess selected) */}
                {selections.subprocess && (
                    <MillerColumn
                        type="task"
                        items={tasks}
                        selectedId={selections.task}
                        onSelect={(id) => handleSelect('task', id)}
                        onAdd={handleAddTask}
                        hasChildren={() => false}
                    />
                )}
            </div>
        </div>
    );
}

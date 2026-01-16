import { useState, useCallback, useEffect } from 'react';
import { Columns, Layers, Table as TableIcon, Play } from 'lucide-react';
import { Stack } from '../../../../ui/atoms/Stack';
import { Text } from '../../../../ui/atoms/Text';
import { Button } from '../../../../ui/atoms/Button';

import { ImportPreview } from '../../ImportPreview';
import { ClassificationPanel } from '../../ClassificationPanel';
import { SelectionInspector } from '../../../../ui/composites/SelectionInspector';
import { useUIStore } from '../../../../stores/uiStore';
import type { ImportSession, ImportPlan } from '../../../../api/hooks/imports';

interface StepProps {
    onNext: () => void;
    onBack: () => void;
    session: ImportSession | null;
    plan: ImportPlan | null;
    onSelectItem: (item: any) => void;
    onSessionCreated: (session: ImportSession, plan: ImportPlan) => void;
}

type ProjectionType = 'hierarchy-projection' | 'stage-projection' | 'table-projection';

export function Step6Preview({ onNext, onBack, session, plan, onSelectItem, onSessionCreated }: StepProps) {
    const [projection, setProjection] = useState<ProjectionType>('hierarchy-projection');
    const { setSelection, setInspectorWidth } = useUIStore();

    // Reset layout on mount
    useEffect(() => {
        setInspectorWidth(400);
    }, [setInspectorWidth]);

    const handleSelect = useCallback((id: string) => {
        // Update global selection for Inspector
        setSelection({ type: 'import_item', id });
        // Call generic handler (might be redundant if setSelection is enough, but keeping for compatibility)
        onSelectItem({ id, type: 'import_item' });
    }, [setSelection, onSelectItem]);

    // Handle plan updates from ClassificationPanel
    const handlePlanUpdate = useCallback((updatedPlan: ImportPlan) => {
        if (session) {
            onSessionCreated(session, updatedPlan);
        }
    }, [session, onSessionCreated]);

    if (!session || !plan) {
        return (
            <Stack className="h-full items-center justify-center">
                <Text>No plan available.</Text>
                <Button onClick={onBack}>Back</Button>
            </Stack>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
            {/* Header / Toolbar */}
            <div className="shrink-0 px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
                <Stack gap="xs">
                    <Text size="lg" weight="bold">Review & Reconcile</Text>
                    <Text size="sm" color="muted">
                        Review the plan, resolve ambiguities, and inspect details before executing.
                    </Text>
                </Stack>

                <div className="flex gap-4 items-center">
                    {/* View Toggles */}
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setProjection('hierarchy-projection')}
                            className={`p-1.5 rounded ${projection === 'hierarchy-projection' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            title="Hierarchy View"
                        >
                            <Columns size={16} />
                        </button>
                        <button
                            onClick={() => setProjection('stage-projection')}
                            className={`p-1.5 rounded ${projection === 'stage-projection' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            title="Process View"
                        >
                            <Layers size={16} />
                        </button>
                        <button
                            onClick={() => setProjection('table-projection')}
                            className={`p-1.5 rounded ${projection === 'table-projection' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            title="Table View"
                        >
                            <TableIcon size={16} />
                        </button>
                    </div>

                    <div className="h-6 w-px bg-slate-200 mx-2" />

                    <Button onClick={onBack} variant="secondary">Back</Button>
                    <Button onClick={onNext} variant="primary">
                        <Play size={16} className="mr-2" />
                        Execute Import
                    </Button>
                </div>
            </div>

            {/* Main Workbench Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Center: Preview Projection */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white">
                    <div className="flex-1 overflow-auto relative">
                        <ImportPreview
                            plan={plan}
                            projectionId={projection}
                            selectedRecordId={useUIStore.getState().selection?.id || null}
                            onRecordSelect={handleSelect}
                        />
                    </div>

                    {/* Bottom: Classification Panel */}
                    <div className="shrink-0 z-20 relative">
                        <ClassificationPanel
                            sessionId={session.id}
                            plan={plan}
                            onResolutionsSaved={handlePlanUpdate}
                        />
                    </div>
                </div>

                {/* Right: Inspector */}
                <SelectionInspector />
            </div>
        </div>
    );
}

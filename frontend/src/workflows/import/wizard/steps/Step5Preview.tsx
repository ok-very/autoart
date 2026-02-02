import { useState, useCallback } from 'react';
import { Columns, Layers, Table as TableIcon, Play } from 'lucide-react';
import { Stack, Text, Button } from '@autoart/ui';
import { ImportPreview } from '../../components/ImportPreview';
import { useImportContext } from '../../context/ImportContextProvider';

interface StepProps {
    onNext: () => void;
    onBack: () => void;
}

type ProjectionType = 'hierarchy-projection' | 'stage-projection' | 'table-projection';

export function Step5Preview({ onNext, onBack }: StepProps) {
    const [projection, setProjection] = useState<ProjectionType>('hierarchy-projection');
    const { session, plan, selectedItemId, selectItem } = useImportContext();

    const handleSelect = useCallback((id: string) => {
        selectItem(id);
    }, [selectItem]);

    if (!session || !plan) {
        return (
            <Stack className="h-full items-center justify-center">
                <Text>No plan available.</Text>
                <Button onClick={onBack}>Back</Button>
            </Stack>
        );
    }

    return (
        <div className="flex flex-col h-full bg-ws-bg">
            {/* Header / Toolbar */}
            <div className="shrink-0 px-6 py-3 bg-ws-panel-bg border-b border-ws-panel-border flex items-center justify-between">
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
                            className={`p-1.5 rounded ${projection === 'hierarchy-projection' ? 'bg-ws-panel-bg shadow-sm text-blue-600' : 'text-ws-text-secondary hover:text-ws-text-secondary'}`}
                            title="Hierarchy View"
                        >
                            <Columns size={16} />
                        </button>
                        <button
                            onClick={() => setProjection('stage-projection')}
                            className={`p-1.5 rounded ${projection === 'stage-projection' ? 'bg-ws-panel-bg shadow-sm text-blue-600' : 'text-ws-text-secondary hover:text-ws-text-secondary'}`}
                            title="Process View"
                        >
                            <Layers size={16} />
                        </button>
                        <button
                            onClick={() => setProjection('table-projection')}
                            className={`p-1.5 rounded ${projection === 'table-projection' ? 'bg-ws-panel-bg shadow-sm text-blue-600' : 'text-ws-text-secondary hover:text-ws-text-secondary'}`}
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

            {/* Main Preview Area */}
            <div className="flex-1 overflow-auto bg-ws-panel-bg">
                <ImportPreview
                    plan={plan}
                    projectionId={projection}
                    selectedRecordId={selectedItemId}
                    onRecordSelect={handleSelect}
                />
            </div>
        </div>
    );
}

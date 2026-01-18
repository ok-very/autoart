import { useState } from 'react';
import { Columns, Layers, Table as TableIcon } from 'lucide-react';
import { Stack } from '@autoart/ui';
import { Text } from '@autoart/ui';
import { Button } from '@autoart/ui';
import { Inline } from '@autoart/ui';
import { ImportPreview } from '../../ImportPreview';
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

export function Step6Preview({ onNext, onBack, session, plan, onSelectItem }: StepProps) {
    const [projection, setProjection] = useState<ProjectionType>('hierarchy-projection');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const handleSelect = (id: string) => {
        setSelectedId(id);
        onSelectItem({ id, type: 'import_item' }); // Generic wrapper
    };

    if (!session || !plan) {
        return (
            <Stack className="h-full items-center justify-center">
                <Text>No plan available.</Text>
                <Button onClick={onBack}>Back</Button>
            </Stack>
        );
    }

    return (
        <Stack className="h-full" gap="md">
            <Inline justify="between" align="center">
                <Stack gap="xs">
                    <Text size="lg" weight="bold">Step 6: Preview Import</Text>
                    <Text color="muted">
                        Review the interpreted plan. This is how your data will be imported.
                    </Text>
                </Stack>

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
            </Inline>

            <div className="flex-1 border rounded-lg bg-white overflow-hidden relative">
                <ImportPreview
                    plan={plan}
                    projectionId={projection}
                    selectedRecordId={selectedId}
                    onRecordSelect={handleSelect}
                />
            </div>

            <Inline justify="between" className="pt-4 border-t border-slate-200">
                <Button onClick={onBack} variant="secondary">Back</Button>
                <Button onClick={onNext} variant="primary">Next: Execute</Button>
            </Inline>
        </Stack>
    );
}

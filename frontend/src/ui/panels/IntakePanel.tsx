/**
 * IntakePanel - Dockview panel wrapper for Intake Form Builder
 *
 * Renders IntakeDashboard or IntakeEditorView based on internal state.
 */

import type { IDockviewPanelProps } from 'dockview';
import { useState } from 'react';

import { IntakeDashboard } from '../../pages/Intake/IntakeDashboard';
import { IntakeEditorView } from '../../pages/Intake/IntakeEditorView';

export function IntakePanel(_props: IDockviewPanelProps) {
    // Track which form is being edited (null = dashboard)
    const [editingFormId, setEditingFormId] = useState<string | null>(null);

    return (
        <div className="h-full overflow-hidden bg-slate-50 flex flex-col">
            {editingFormId ? (
                <IntakeEditorView
                    formId={editingFormId}
                    onBack={() => setEditingFormId(null)}
                />
            ) : (
                <IntakeDashboard onOpenForm={setEditingFormId} />
            )}
        </div>
    );
}

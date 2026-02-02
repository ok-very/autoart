/**
 * IntakeContent
 *
 * Thin wrapper for embedding Intake workflow as center content.
 * Manages internal state for form editing vs dashboard view.
 */

import { useState } from 'react';
import { IntakeDashboard } from '../../../pages/Intake/IntakeDashboard';
import { IntakeEditorView } from '../../../pages/Intake/IntakeEditorView';

export function IntakeContent() {
    // Track which form is being edited (null = dashboard)
    const [editingFormId, setEditingFormId] = useState<string | null>(null);

    return (
        <div className="h-full overflow-hidden bg-ws-bg flex flex-col">
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

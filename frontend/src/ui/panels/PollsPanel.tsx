/**
 * PollsPanel - Dockview panel wrapper for Polls
 *
 * Renders PollsDashboard or PollEditorView based on internal state.
 */

import type { IDockviewPanelProps } from 'dockview';
import { useState } from 'react';

import { PollsDashboard } from '../../pages/Polls/PollsDashboard';
import { PollEditorView } from '../../pages/Polls/PollEditorView';

export function PollsPanel(_props: IDockviewPanelProps) {
    // Track which poll is being edited (null = dashboard)
    const [editingPollId, setEditingPollId] = useState<string | null>(null);

    return (
        <div className="h-full overflow-hidden bg-ws-bg flex flex-col">
            {editingPollId ? (
                <PollEditorView
                    pollId={editingPollId}
                    onBack={() => setEditingPollId(null)}
                    onDeleted={() => setEditingPollId(null)}
                />
            ) : (
                <PollsDashboard onOpenPoll={setEditingPollId} />
            )}
        </div>
    );
}

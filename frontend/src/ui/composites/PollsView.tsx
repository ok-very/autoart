import { useState, useCallback } from 'react';
import type { Poll } from '@autoart/shared';
import { PollsListView } from './polls/PollsListView';
import { CreatePollView } from './polls/CreatePollView';
import { PollDetailView } from './polls/PollDetailView';

type ViewState =
    | { view: 'list' }
    | { view: 'create' }
    | { view: 'detail'; poll: Poll };

export function PollsView() {
    const [viewState, setViewState] = useState<ViewState>({ view: 'list' });

    const handleCreatePoll = useCallback(() => {
        setViewState({ view: 'create' });
    }, []);

    const handleSelectPoll = useCallback((poll: Poll) => {
        setViewState({ view: 'detail', poll });
    }, []);

    const handleBack = useCallback(() => {
        setViewState({ view: 'list' });
    }, []);

    const handleCreated = useCallback((_pollId: string, _uniqueId: string) => {
        // After creation, go back to list so user sees the new poll
        setViewState({ view: 'list' });
    }, []);

    switch (viewState.view) {
        case 'list':
            return (
                <PollsListView
                    onCreatePoll={handleCreatePoll}
                    onSelectPoll={handleSelectPoll}
                />
            );
        case 'create':
            return (
                <CreatePollView
                    onBack={handleBack}
                    onCreated={handleCreated}
                />
            );
        case 'detail':
            return (
                <PollDetailView
                    poll={viewState.poll}
                    onBack={handleBack}
                />
            );
    }
}

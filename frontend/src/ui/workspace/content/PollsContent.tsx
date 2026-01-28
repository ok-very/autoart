/**
 * PollsContent
 *
 * Thin wrapper for embedding Polls view as center content.
 */

import { PollsView } from '../../composites/PollsView';

export function PollsContent() {
    return (
        <div className="h-full overflow-hidden">
            <PollsView />
        </div>
    );
}

/**
 * PollsContent
 *
 * Thin wrapper for embedding Polls dashboard as center content.
 */

import { PollsDashboard } from '../../../pages/Polls/PollsDashboard';

export function PollsContent() {
    return (
        <div className="h-full overflow-hidden bg-[#F5F2ED] flex flex-col">
            <PollsDashboard />
        </div>
    );
}

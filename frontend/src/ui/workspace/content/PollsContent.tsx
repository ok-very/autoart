/**
 * PollsContent
 *
 * Thin wrapper for embedding Polls view as center content.
 */

import { Text } from '@autoart/ui';

export function PollsContent() {
    return (
        <div className="h-full flex items-center justify-center">
            <Text color="dimmed">Polls workspace</Text>
        </div>
    );
}

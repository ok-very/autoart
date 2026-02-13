/**
 * ComposerPanel
 *
 * Dockview-compatible Composer panel.
 */

import { ComposerView } from '../composer';

export function ComposerPanel() {
    return (
        <div className="h-full bg-ws-bg overflow-hidden">
            <ComposerView mode="page" />
        </div>
    );
}

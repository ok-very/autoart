/**
 * ComposerPanel
 *
 * Docker-compatible version of ComposerPage.
 */

import { ComposerView } from '../composer';

export function ComposerPanel() {
    return (
        <div className="flex flex-col h-full bg-ws-bg overflow-hidden">
            <div className="flex-1 overflow-hidden p-4">
                <div className="h-full bg-ws-panel-bg rounded-xl shadow-sm border border-ws-panel-border overflow-hidden">
                    <ComposerView
                        mode="page"
                        onSuccess={(actionId: string) => {
                            console.log('Action created:', actionId);
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

/**
 * ComposerPanel
 *
 * Docker-compatible version of ComposerPage.
 */

import { ComposerView } from '../composer';

export function ComposerPanel() {
    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            <div className="flex-1 overflow-hidden p-4">
                <div className="h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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

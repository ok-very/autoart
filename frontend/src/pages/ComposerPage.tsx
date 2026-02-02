/**
 * ComposerPage
 *
 * Route wrapper that renders ComposerSurface in page mode.
 * All composer logic is now encapsulated in ComposerSurface.
 */

import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ComposerView } from '../ui/composer';
import { Header } from '../ui/layout/Header';

export function ComposerPage() {
    return (
        <div className="flex flex-col h-full bg-ws-bg">
            <Header />

            <div className="flex-1 overflow-hidden">
                <div className="h-full max-w-5xl mx-auto px-6 py-4">
                    {/* Back Link */}
                    <Link
                        to="/"
                        className="inline-flex items-center gap-1 text-sm text-ws-text-secondary hover:text-ws-text-secondary mb-4"
                    >
                        <ArrowLeft size={14} />
                        Back to Projects
                    </Link>

                    {/* ComposerSurface in page mode */}
                    <div className="h-[calc(100%-40px)] bg-ws-panel-bg rounded-xl shadow-sm border border-ws-panel-border overflow-hidden">
                        <ComposerView
                            mode="page"
                            onSuccess={(actionId: string) => {
                                console.log('Action created:', actionId);
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

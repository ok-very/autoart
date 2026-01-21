/**
 * IntakePage - Page wrapper for Intake Form Builder
 *
 * Layout: Sidebar | Center View (Dashboard or Editor) | Inspector
 *
 * Center view swaps based on route:
 * - /intake: IntakeDashboard (list of forms)
 * - /intake/:formId: IntakeEditorView (builder)
 */

import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';

import { Header } from '../../ui/layout/Header';
import { ResizeHandle } from '@autoart/ui';
import { IntakeDashboard } from './IntakeDashboard';
import { IntakeEditorView } from './IntakeEditorView';

export function IntakePage() {
    const { formId } = useParams<{ formId?: string }>();
    const [sidebarWidth, setSidebarWidth] = useState(280);

    const handleSidebarResize = useCallback((delta: number) => {
        setSidebarWidth((w) => Math.max(200, Math.min(400, w + delta)));
    }, []);

    const isEditing = Boolean(formId);

    return (
        <div className="flex flex-col h-full">
            <Header />
            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar: Form list or editor tools */}
                <div
                    className="flex flex-col border-r border-slate-200 bg-white shrink-0"
                    style={{ width: sidebarWidth }}
                >
                    <div className="p-4 border-b border-slate-100">
                        <h2 className="text-sm font-semibold text-slate-700">
                            {isEditing ? 'Form Tools' : 'Intake Forms'}
                        </h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {/* Sidebar content will be populated based on view */}
                    </div>
                </div>
                <ResizeHandle direction="right" onResize={handleSidebarResize} />

                {/* Center: Dashboard or Editor */}
                <div className="flex-1 flex flex-col overflow-hidden relative bg-slate-50">
                    {isEditing ? (
                        <IntakeEditorView formId={formId!} />
                    ) : (
                        <IntakeDashboard />
                    )}
                </div>
            </div>
        </div>
    );
}

export default IntakePage;

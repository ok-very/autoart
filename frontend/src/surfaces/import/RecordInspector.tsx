/**
 * Record Inspector
 *
 * Shows planned actions/events for a single import record.
 */

import { X, FileText, Zap, Database } from 'lucide-react';
import type { ImportPlan } from '../../api/hooks/imports';

// ============================================================================
// TYPES
// ============================================================================

interface RecordInspectorProps {
    recordId: string;
    plan: ImportPlan;
    onClose: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RecordInspector({ recordId, plan, onClose }: RecordInspectorProps) {
    // Find the record in the plan
    const record = plan.items.find((item) => item.tempId === recordId);

    if (!record) {
        return (
            <div className="p-4">
                <div className="text-sm text-slate-500">Record not found</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <h3 className="text-sm font-bold text-slate-700">Record Inspector</h3>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
                {/* Title */}
                <Section title="Title">
                    <div className="text-sm font-medium text-slate-800">{record.title}</div>
                </Section>

                {/* Planned Action */}
                <Section title="Planned Action" icon={<Zap className="w-3 h-3" />}>
                    <div className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-1.5 rounded">
                        {record.plannedAction.type}
                    </div>
                    {Object.keys(record.plannedAction.payload || {}).length > 0 && (
                        <pre className="mt-2 text-[10px] text-slate-600 bg-slate-50 p-2 rounded overflow-auto">
                            {JSON.stringify(record.plannedAction.payload, null, 2)}
                        </pre>
                    )}
                </Section>

                {/* Field Recordings */}
                {record.fieldRecordings.length > 0 && (
                    <Section title="Field Recordings" icon={<Database className="w-3 h-3" />}>
                        <div className="space-y-1">
                            {record.fieldRecordings.map((field, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-start gap-2 text-xs"
                                >
                                    <span className="font-medium text-slate-600 min-w-[80px]">
                                        {field.fieldName}:
                                    </span>
                                    <span className="text-slate-800 break-words">
                                        {String(field.value)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {/* Source Metadata */}
                <Section title="Source Metadata">
                    <pre className="text-[10px] text-slate-600 bg-slate-50 p-2 rounded overflow-auto max-h-40">
                        {JSON.stringify(record.metadata, null, 2)}
                    </pre>
                </Section>

                {/* Parent Info */}
                <Section title="Parent Container">
                    <div className="text-xs font-mono text-slate-500">
                        {record.parentTempId}
                    </div>
                </Section>
            </div>
        </div>
    );
}

// ============================================================================
// SECTION HELPER
// ============================================================================

interface SectionProps {
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
}

function Section({ title, icon, children }: SectionProps) {
    return (
        <div>
            <div className="flex items-center gap-1.5 mb-1.5">
                {icon && <span className="text-slate-400">{icon}</span>}
                <span className="text-xs font-bold text-slate-400 uppercase">{title}</span>
            </div>
            <div>{children}</div>
        </div>
    );
}

export default RecordInspector;

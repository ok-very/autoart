/**
 * InterpretationInspectorView
 *
 * Displays the semantic interpretation plan for an action/import item.
 * This is the canonical place to review and approve interpretation outputs.
 *
 * Sections:
 * 1. Intent Hints - Never committed (informational only)
 * 2. Proposed Facts - Approval required (checkbox approve/reject)
 * 3. Work Lifecycle - Auto-committed (read-only)
 * 4. Field Values - Editable
 * 5. Unclassified Rows - Optional manual classification
 *
 * Design principles:
 * - Read-only by default except approve/reject and field edits
 * - Shows confidence + source for each fact candidate
 * - No free-form editing of fact kinds or payloads
 */

import { clsx } from 'clsx';
import {
    Lightbulb,
    CheckCircle2,
    Circle,
    Zap,
    FileText,
    HelpCircle,
    ChevronDown,
    ChevronRight,
    AlertTriangle,
    Loader2
} from 'lucide-react';
import { useState } from 'react';

import { useInterpretationPlan } from '../../../api/hooks';

interface InterpretationInspectorViewProps {
    actionId: string;
}

// Confidence badge component
function ConfidenceBadge({ confidence }: { confidence: string }) {
    const styles = {
        low: 'bg-red-100 text-red-700',
        medium: 'bg-amber-100 text-amber-700',
        high: 'bg-green-100 text-green-700',
    };
    return (
        <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-medium', styles[confidence as keyof typeof styles] || styles.medium)}>
            {confidence}
        </span>
    );
}

// Collapsible section component
function Section({
    title,
    icon: Icon,
    count,
    children,
    defaultExpanded = true,
    muted = false
}: {
    title: string;
    icon: React.ElementType;
    count: number;
    children: React.ReactNode;
    defaultExpanded?: boolean;
    muted?: boolean;
}) {
    const [expanded, setExpanded] = useState(defaultExpanded);

    if (count === 0) return null;

    return (
        <div className={clsx('mb-4', muted && 'opacity-60')}>
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-2 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
            >
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Icon size={14} className={muted ? 'text-slate-400' : 'text-blue-500'} />
                <span>{title}</span>
                <span className="text-xs text-slate-400 ml-auto">{count}</span>
            </button>
            {expanded && <div className="pl-6 space-y-2">{children}</div>}
        </div>
    );
}

export function InterpretationInspectorView({ actionId }: InterpretationInspectorViewProps) {
    const { data: plan, isLoading, error } = useInterpretationPlan(actionId);

    // Track approved facts (local state for now - will be persisted via API in follow-up)
    const [approvedFacts, setApprovedFacts] = useState<Set<number>>(new Set());

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8 text-slate-400">
                <Loader2 size={20} className="animate-spin mr-2" />
                <span className="text-sm">Loading interpretation...</span>
            </div>
        );
    }

    if (error || !plan) {
        return (
            <div className="text-sm text-slate-500 text-center py-8">
                No interpretation data available
            </div>
        );
    }

    // Categorize outputs
    const actionHints = plan.outputs.filter(o => o.kind === 'action_hint');
    const factCandidates = plan.outputs.filter(o => o.kind === 'fact_candidate');
    const workEvents = plan.statusEvent ? [plan.statusEvent] : [];
    const fieldValues = plan.outputs.filter(o => o.kind === 'field_value');

    // Toggle fact approval
    const toggleFactApproval = (index: number) => {
        setApprovedFacts(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Lightbulb size={16} className="text-amber-500" />
                <span className="text-sm font-medium text-slate-700">Interpretation Plan</span>
                <span className="text-xs text-slate-400 ml-auto">Action: {actionId.slice(0, 8)}...</span>
            </div>

            {/* Intent Hints Section - Never committed */}
            <Section
                title="Intent Hints"
                icon={Lightbulb}
                count={actionHints.length}
                muted
            >
                <p className="text-xs text-slate-400 mb-2 italic">
                    These are preparatory/internal actions. They are never committed.
                </p>
                {actionHints.map((hint, i) => (
                    <div key={i} className="flex items-start gap-2 py-1.5 text-sm text-slate-600">
                        <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                            {String(hint.hintType || 'hint')}
                        </span>
                        <span className="truncate">{String(hint.text || '')}</span>
                    </div>
                ))}
            </Section>

            {/* Proposed Facts Section - Approval required */}
            <Section
                title="Proposed Facts"
                icon={AlertTriangle}
                count={factCandidates.length}
            >
                <p className="text-xs text-slate-500 mb-2">
                    Review and approve facts before commit.
                </p>
                {factCandidates.map((fact, i) => {
                    const isApproved = approvedFacts.has(i);
                    const factIndex = plan.outputs.indexOf(fact);
                    return (
                        <div
                            key={i}
                            className={clsx(
                                'flex items-start gap-2 py-2 px-2 rounded cursor-pointer transition-colors',
                                isApproved ? 'bg-green-50 border border-green-200' : 'hover:bg-slate-50'
                            )}
                            onClick={() => toggleFactApproval(factIndex)}
                        >
                            {isApproved ? (
                                <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />
                            ) : (
                                <Circle size={16} className="text-slate-300 shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-slate-700">
                                        {String(fact.factKind || 'UNKNOWN')}
                                    </span>
                                    <ConfidenceBadge confidence={String(fact.confidence || 'medium')} />
                                    <span className="text-[10px] text-slate-400">source: CSV import</span>
                                </div>
                                {fact.payload ? (
                                    <div className="text-xs text-slate-500 mt-1 truncate">
                                        {JSON.stringify(fact.payload)}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </Section>

            {/* Work Lifecycle Section - Auto-commit */}
            <Section
                title="Work Lifecycle"
                icon={Zap}
                count={workEvents.length}
                muted
            >
                <p className="text-xs text-slate-400 mb-2 italic">
                    Auto-committed from status column.
                </p>
                {workEvents.map((event, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 text-sm text-slate-600">
                        <CheckCircle2 size={14} className="text-green-500" />
                        <span className="font-medium">{String(event.eventType || 'WORK_EVENT')}</span>
                        <span className="text-xs text-slate-400">(auto)</span>
                    </div>
                ))}
            </Section>

            {/* Field Values Section - Editable */}
            <Section
                title="Field Values"
                icon={FileText}
                count={fieldValues.length}
            >
                <p className="text-xs text-slate-500 mb-2">
                    These update action fields. Click to edit.
                </p>
                {fieldValues.map((fv, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 text-sm">
                        <span className="text-slate-500 min-w-[80px]">{String(fv.field || 'field')}:</span>
                        <input
                            type="text"
                            defaultValue={String(fv.value || '')}
                            className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded hover:border-slate-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
                        />
                    </div>
                ))}
            </Section>

            {/* Unclassified Rows Section */}
            {plan.outputs.length === 0 && (
                <Section
                    title="Unclassified Rows"
                    icon={HelpCircle}
                    count={1}
                >
                    <p className="text-xs text-slate-500 mb-2">
                        These items were not interpreted as observable facts.
                        You may optionally classify them manually.
                    </p>
                    <div className="py-2 px-3 bg-slate-50 rounded text-sm text-slate-600 italic">
                        No semantic patterns matched for this item.
                    </div>
                </Section>
            )}

            {/* Summary */}
            <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
                {approvedFacts.size} of {factCandidates.length} facts approved
                {workEvents.length > 0 && ` • ${workEvents.length} auto-commit`}
            </div>
        </div>
    );
}

/**
 * LogPreview
 *
 * Chronological event log view of import items.
 * Shows parsed entries with classification decisions and field mappings.
 */

import { ScrollText, CheckCircle, AlertCircle, HelpCircle, ArrowRight } from 'lucide-react';
import { useMemo } from 'react';

import type { ImportPlan } from '../../../api/hooks/imports';

interface LogPreviewProps {
    plan: ImportPlan;
    selectedRecordId: string | null;
    onSelect: (recordId: string) => void;
}

export function LogPreview({ plan, selectedRecordId, onSelect }: LogPreviewProps) {
    // Build log entries from items and classifications
    const logEntries = useMemo(() => {
        const entries: Array<{
            id: string;
            type: 'item' | 'classification' | 'container';
            title: string;
            details: string;
            outcome?: string;
            tempId: string;
        }> = [];

        // Add container entries
        for (const container of plan.containers) {
            entries.push({
                id: `container-${container.tempId}`,
                type: 'container',
                title: container.title || container.tempId,
                details: `Container (${container.type})`,
                tempId: container.tempId,
            });
        }

        // Add item entries
        for (const item of plan.items) {
            const fieldCount = item.fieldRecordings?.length || 0;
            entries.push({
                id: `item-${item.tempId}`,
                type: 'item',
                title: item.title || item.tempId,
                details: `${fieldCount} field${fieldCount !== 1 ? 's' : ''} recorded`,
                tempId: item.tempId,
            });
        }

        // Add classification entries
        if (plan.classifications) {
            for (const classification of plan.classifications) {
                entries.push({
                    id: `class-${classification.itemTempId}`,
                    type: 'classification',
                    title: classification.rationale || classification.itemTempId,
                    details: `Confidence: ${classification.confidence}`,
                    outcome: classification.outcome,
                    tempId: classification.itemTempId,
                });
            }
        }

        return entries;
    }, [plan]);

    if (logEntries.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                    <ScrollText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No log entries</p>
                </div>
            </div>
        );
    }

    const getOutcomeIcon = (outcome?: string) => {
        switch (outcome) {
            case 'FACT_EMITTED':
            case 'DERIVED_STATE':
                return <CheckCircle size={14} className="text-green-500" />;
            case 'AMBIGUOUS':
                return <AlertCircle size={14} className="text-amber-500" />;
            case 'UNCLASSIFIED':
                return <HelpCircle size={14} className="text-slate-400" />;
            default:
                return <ArrowRight size={14} className="text-blue-400" />;
        }
    };

    const getTypeBadge = (type: string) => {
        const styles = {
            container: 'bg-purple-100 text-purple-700',
            item: 'bg-blue-100 text-blue-700',
            classification: 'bg-green-100 text-green-700',
        }[type] || 'bg-slate-100 text-slate-700';

        return (
            <span className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded ${styles}`}>
                {type}
            </span>
        );
    };

    return (
        <div className="flex-1 overflow-auto p-4">
            <div className="space-y-2">
                {logEntries.map((entry) => {
                    const isSelected = entry.tempId === selectedRecordId;

                    return (
                        <div
                            key={entry.id}
                            onClick={() => onSelect(entry.tempId)}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isSelected
                                    ? 'bg-blue-50 border-blue-200 shadow-sm'
                                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                                }`}
                        >
                            <div className="pt-0.5">
                                {getOutcomeIcon(entry.outcome)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    {getTypeBadge(entry.type)}
                                    <span className="font-medium text-slate-800 truncate">
                                        {entry.title}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-500">{entry.details}</p>
                            </div>
                            {entry.outcome && (
                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${entry.outcome === 'FACT_EMITTED' || entry.outcome === 'DERIVED_STATE'
                                        ? 'bg-green-50 text-green-700'
                                        : entry.outcome === 'AMBIGUOUS'
                                            ? 'bg-amber-50 text-amber-700'
                                            : 'bg-slate-50 text-slate-600'
                                    }`}>
                                    {entry.outcome}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default LogPreview;

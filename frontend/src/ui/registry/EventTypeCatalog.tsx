/**
 * EventTypeCatalog
 *
 * Registry panel for browsing Event Types.
 * Documents all event types from the EventTypeSchema with descriptions.
 */

import { clsx } from 'clsx';
import { Activity, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { useState } from 'react';

// ==================== EVENT TYPE DATA ====================

interface EventTypeInfo {
    type: string;
    description: string;
    payloadFields?: string[];
}

interface EventCategory {
    name: string;
    description: string;
    types: EventTypeInfo[];
}

const EVENT_CATEGORIES: EventCategory[] = [
    {
        name: 'Action Lifecycle',
        description: 'Events marking the lifecycle of actions',
        types: [
            { type: 'ACTION_DECLARED', description: 'An action was created/declared', payloadFields: ['actionType', 'fieldBindings'] },
            { type: 'WORK_STARTED', description: 'Work began on an action' },
            { type: 'WORK_STOPPED', description: 'Work was paused on an action' },
            { type: 'WORK_FINISHED', description: 'Work was completed on an action' },
            { type: 'WORK_BLOCKED', description: 'Action became blocked' },
            { type: 'WORK_UNBLOCKED', description: 'Blockage was resolved' },
        ],
    },
    {
        name: 'Field Events',
        description: 'Events recording field value changes',
        types: [
            { type: 'FIELD_VALUE_RECORDED', description: 'A field value was captured', payloadFields: ['fieldKey', 'value'] },
        ],
    },
    {
        name: 'Domain Facts',
        description: 'Business domain facts (discriminated by factKind)',
        types: [
            { type: 'FACT_RECORDED', description: 'A domain fact occurred', payloadFields: ['factKind', '...factPayload'] },
        ],
    },
    {
        name: 'Financial Facts',
        description: 'Finance-specific fact kinds (emitted as FACT_RECORDED)',
        types: [
            { type: 'INVOICE_PREPARED', description: 'An invoice was drafted', payloadFields: ['counterparty', 'amount', 'currency'] },
            { type: 'PAYMENT_RECORDED', description: 'A payment was received or made', payloadFields: ['counterparty', 'amount', 'currency'] },
            { type: 'BUDGET_ALLOCATED', description: 'A budget allocation was created', payloadFields: ['budgetName', 'allocationType', 'amount'] },
            { type: 'EXPENSE_RECORDED', description: 'An expense was recorded', payloadFields: ['description', 'category', 'amount'] },
            { type: 'BILL_RECEIVED', description: 'A vendor bill was received', payloadFields: ['vendor', 'billNumber', 'amount'] },
        ],
    },
    {
        name: 'Assignments',
        description: 'Events for assigning/unassigning work',
        types: [
            { type: 'ASSIGNMENT_OCCURRED', description: 'Someone was assigned to the action', payloadFields: ['assigneeId'] },
            { type: 'ASSIGNMENT_REMOVED', description: 'Assignment was removed' },
        ],
    },
    {
        name: 'Dependencies',
        description: 'Workflow dependency events',
        types: [
            { type: 'DEPENDENCY_ADDED', description: 'Action depends on another', payloadFields: ['dependsOnActionId'] },
            { type: 'DEPENDENCY_REMOVED', description: 'Dependency was removed', payloadFields: ['dependsOnActionId'] },
        ],
    },
    {
        name: 'References',
        description: 'Action-record link events',
        types: [
            { type: 'ACTION_REFERENCE_ADDED', description: 'Action references a record', payloadFields: ['sourceRecordId', 'targetFieldKey'] },
            { type: 'ACTION_REFERENCE_REMOVED', description: 'Reference was removed', payloadFields: ['sourceRecordId', 'targetFieldKey'] },
        ],
    },
    {
        name: 'Ordering',
        description: 'Workflow surface ordering events',
        types: [
            { type: 'WORKFLOW_ROW_MOVED', description: 'Row was reordered in workflow', payloadFields: ['surfaceType', 'afterActionId'] },
        ],
    },
];

// ==================== TYPES ====================

interface EventTypeCatalogProps {
    className?: string;
}

// ==================== MAIN COMPONENT ====================

export function EventTypeCatalog({ className }: EventTypeCatalogProps) {
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
        new Set(EVENT_CATEGORIES.map((c) => c.name)) // All expanded by default
    );
    const [selectedType, setSelectedType] = useState<string | null>(null);

    const toggleCategory = (name: string) => {
        setExpandedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });
    };

    const totalTypes = EVENT_CATEGORIES.reduce((acc, cat) => acc + cat.types.length, 0);

    return (
        <div className={clsx('flex flex-col h-full bg-ws-bg', className)}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-ws-panel-border bg-ws-panel-bg">
                <div className="flex items-center gap-2 mb-2">
                    <Activity size={16} className="text-blue-500" />
                    <h3 className="text-sm font-semibold text-ws-fg">Event Types</h3>
                </div>
                <p className="text-xs text-ws-text-secondary">
                    {totalTypes} event types in {EVENT_CATEGORIES.length} categories
                </p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-2">
                {EVENT_CATEGORIES.map((category) => (
                    <div key={category.name} className="mb-2">
                        {/* Category Header */}
                        <button
                            onClick={() => toggleCategory(category.name)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 text-left"
                        >
                            {expandedCategories.has(category.name) ? (
                                <ChevronDown size={14} className="text-ws-muted" />
                            ) : (
                                <ChevronRight size={14} className="text-ws-muted" />
                            )}
                            <span className="text-xs font-medium text-ws-text-secondary uppercase tracking-wide">
                                {category.name}
                            </span>
                            <span className="text-xs text-ws-muted">
                                ({category.types.length})
                            </span>
                        </button>

                        {/* Category Types */}
                        {expandedCategories.has(category.name) && (
                            <div className="ml-4 mt-1 space-y-1">
                                {category.types.map((eventType) => (
                                    <EventTypeRow
                                        key={eventType.type}
                                        eventType={eventType}
                                        isSelected={selectedType === eventType.type}
                                        onClick={() => setSelectedType(eventType.type)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-ws-panel-border bg-ws-panel-bg">
                <div className="flex items-center gap-1 text-xs text-ws-muted">
                    <Info size={12} />
                    <span>Events are immutable facts</span>
                </div>
            </div>
        </div>
    );
}

// ==================== SUB-COMPONENTS ====================

interface EventTypeRowProps {
    eventType: EventTypeInfo;
    isSelected: boolean;
    onClick: () => void;
}

function EventTypeRow({ eventType, isSelected, onClick }: EventTypeRowProps) {
    return (
        <button
            onClick={onClick}
            className={clsx(
                'w-full flex flex-col gap-0.5 px-3 py-2 rounded-md text-left transition-colors',
                isSelected
                    ? 'bg-blue-100 border border-blue-200'
                    : 'hover:bg-slate-100'
            )}
        >
            <code className="text-xs font-mono text-blue-600">{eventType.type}</code>
            <span className="text-xs text-ws-text-secondary">{eventType.description}</span>
            {eventType.payloadFields && (
                <div className="flex items-center gap-1 mt-1">
                    {eventType.payloadFields.map((field) => (
                        <span
                            key={field}
                            className="px-1.5 py-0.5 text-[10px] bg-slate-100 text-ws-text-secondary rounded"
                        >
                            {field}
                        </span>
                    ))}
                </div>
            )}
        </button>
    );
}

// ==================== EXPORTS ====================

export default EventTypeCatalog;

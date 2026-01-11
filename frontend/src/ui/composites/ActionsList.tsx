/**
 * ActionsList - Scrollable list of ActionCards
 *
 * Main view component for the action log, showing actions as cards
 * with expandable event details.
 *
 * Features:
 * - Scrollable card list
 * - Toggle for system events
 * - Empty state
 * - Loading state
 */

import { clsx } from 'clsx';
import { Zap, Eye, EyeOff } from 'lucide-react';

import type { Action } from '@autoart/shared';

import { ActionCard } from './ActionCard';
import { useActionEvents } from '../../api/hooks';

// ==================== TYPES ====================

export interface ActionsListProps {
    /** Actions to display */
    actions: Action[];
    /** Whether to include system events */
    includeSystemEvents?: boolean;
    /** Toggle system events visibility */
    onToggleSystemEvents?: () => void;
    /** Loading state */
    isLoading?: boolean;
    /** Callback when action is clicked */
    onActionClick?: (actionId: string) => void;
    /** Callback to retract action */
    onRetractAction?: (actionId: string) => void;
    /** Callback to amend action */
    onAmendAction?: (actionId: string) => void;
    /** Custom className */
    className?: string;
}

// ==================== ACTION CARD WRAPPER ====================

/**
 * Wrapper that fetches events for a single action card
 */
function ActionCardWithEvents({
    action,
    includeSystemEvents,
    onClick,
    onRetract,
    onAmend,
}: {
    action: Action;
    includeSystemEvents: boolean;
    onClick?: () => void;
    onRetract?: () => void;
    onAmend?: () => void;
}) {
    const { data: events = [] } = useActionEvents(action.id);

    return (
        <ActionCard
            action={action}
            events={events}
            includeSystemEvents={includeSystemEvents}
            onClick={onClick}
            onRetract={onRetract}
            onAmend={onAmend}
        />
    );
}

// ==================== MAIN COMPONENT ====================

export function ActionsList({
    actions,
    includeSystemEvents = false,
    onToggleSystemEvents,
    isLoading = false,
    onActionClick,
    onRetractAction,
    onAmendAction,
    className,
}: ActionsListProps) {
    // Loading state
    if (isLoading) {
        return (
            <div className={clsx('flex items-center justify-center h-64 text-slate-400', className)}>
                <div className="animate-spin w-8 h-8 border-2 border-slate-300 border-t-purple-500 rounded-full" />
            </div>
        );
    }

    // Empty state
    if (actions.length === 0) {
        return (
            <div className={clsx('flex flex-col items-center justify-center h-64 text-slate-400', className)}>
                <Zap size={40} className="mb-3 text-slate-200" />
                <p className="text-lg font-medium">No actions yet</p>
                <p className="text-sm">Actions will appear here once declared</p>
            </div>
        );
    }

    return (
        <div className={clsx('flex flex-col h-full', className)}>
            {/* Header with toggle */}
            {onToggleSystemEvents && (
                <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white shrink-0">
                    <div className="text-sm text-slate-500">
                        {actions.length} action{actions.length !== 1 ? 's' : ''}
                    </div>
                    <button
                        onClick={onToggleSystemEvents}
                        className={clsx(
                            'flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors',
                            includeSystemEvents
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
                        )}
                    >
                        {includeSystemEvents ? (
                            <>
                                <Eye size={12} />
                                System events visible
                            </>
                        ) : (
                            <>
                                <EyeOff size={12} />
                                System events hidden
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto custom-scroll p-6 md:p-8 bg-slate-50">
                <div className="max-w-4xl mx-auto space-y-6">
                    {actions.map((action) => (
                        <ActionCardWithEvents
                            key={action.id}
                            action={action}
                            includeSystemEvents={includeSystemEvents}
                            onClick={onActionClick ? () => onActionClick(action.id) : undefined}
                            onRetract={onRetractAction ? () => onRetractAction(action.id) : undefined}
                            onAmend={onAmendAction ? () => onAmendAction(action.id) : undefined}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

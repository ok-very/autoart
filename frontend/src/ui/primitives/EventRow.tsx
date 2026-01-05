/**
 * EventRow - Immutable event display component
 *
 * A single row displaying an event with:
 * - Event type badge
 * - Timestamp
 * - Payload preview
 * - Visual distinction for system events
 */

import { ArrowDownRight, Info } from 'lucide-react';
import type { Event } from '@autoart/shared';

// ==================== TYPES ====================

export interface EventRowProps {
    event: Event;
    /** Whether to highlight as system event */
    isSystem?: boolean;
}

// ==================== HELPERS ====================

function formatTimestamp(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatPayload(event: Event): string {
    const payload = event.payload;
    if (!payload || Object.keys(payload).length === 0) {
        return '—';
    }

    // Show first few key-value pairs
    const entries = Object.entries(payload).slice(0, 3);
    const parts = entries.map(([key, value]) => {
        const displayValue = typeof value === 'string'
            ? value.length > 30 ? value.slice(0, 30) + '…' : value
            : JSON.stringify(value);
        return `${key}: ${displayValue}`;
    });

    if (Object.keys(payload).length > 3) {
        parts.push('...');
    }

    return parts.join(', ');
}

// ==================== COMPONENT ====================

export function EventRow({ event, isSystem = false }: EventRowProps) {
    const Icon = isSystem ? Info : ArrowDownRight;
    const iconColor = isSystem ? 'text-amber-400' : 'text-slate-400';

    return (
        <div className={`event-row flex gap-3 py-2 border-b border-dashed border-slate-200 last:border-b-0`}>
            {/* Icon */}
            <div className={`pt-0.5 ${iconColor}`}>
                <Icon size={14} />
            </div>

            {/* Content */}
            <div className={`flex-1 ${isSystem ? 'system-event rounded-sm py-1 bg-amber-50 border-l-2 border-amber-300 pl-2 ml-1' : ''}`}>
                {/* Type and timestamp */}
                <div className="flex items-center gap-2 mb-0.5">
                    <span className={isSystem
                        ? 'text-[10px] font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded'
                        : 'text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono'
                    }>
                        {isSystem ? `sys: ${event.type}` : event.type}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                        {event.id.slice(0, 8)} • {formatTimestamp(event.occurredAt)}
                    </span>
                </div>

                {/* Payload */}
                <div className={`pl-1 text-[11px] ${isSystem ? 'text-amber-700' : 'text-slate-600'}`}>
                    {formatPayload(event)}
                </div>
            </div>
        </div>
    );
}

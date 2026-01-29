/**
 * ProjectLogEventRow
 *
 * Renders a single event in the project log timeline.
 * Implements narrative-first rendering for FACT_RECORDED events.
 *
 * Features:
 * - Timeline dot (major events have icon, minor events have colored dot)
 * - FACT_RECORDED: narrative as primary text (not truncated)
 * - Other events: label + summary text
 * - Relative timestamp
 * - Optional expandable payload details
 */

import { clsx } from 'clsx';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import type { Event } from '@autoart/shared';

import { getEventFormatter } from './eventFormatters';


interface ProjectLogEventRowProps {
  event: Event;
  /** Whether this is the last event in the list (hides timeline connector) */
  isLast?: boolean;
  /** Action title for context (when grouping by action) */
  actionTitle?: string;
  /** Click handler for navigating to action */
  onActionClick?: (actionId: string) => void;
}

/**
 * Format timestamp as relative time (e.g., "2 hours ago", "Yesterday 14:30")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) {
    return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function ProjectLogEventRow({
  event,
  isLast = false,
  actionTitle,
  onActionClick,
}: ProjectLogEventRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const formatter = getEventFormatter(event.type);
  const Icon = formatter.icon;
  const summary = formatter.summarize(event.payload);
  const hasPayload = Object.keys(event.payload).length > 0;

  // Special rendering for FACT_RECORDED: narrative as primary text
  const isFactRecorded = event.type === 'FACT_RECORDED';

  return (
    <div className="relative pl-8 pb-4">
      {/* Timeline connector line */}
      {!isLast && (
        <div
          className="absolute left-[11px] top-7 bottom-0 w-0.5 bg-slate-200"
          aria-hidden="true"
        />
      )}

      {/* Event dot */}
      {formatter.isMajor ? (
        // Major event: larger dot with icon
        <div
          className={clsx(
            'absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center',
            'border-2 border-white shadow-sm z-10',
            formatter.dotBgClass
          )}
        >
          <Icon className={clsx('w-3 h-3', formatter.dotTextClass)} />
        </div>
      ) : (
        // Minor event: small colored dot
        <div
          className={clsx(
            'absolute left-[7px] top-2 w-2.5 h-2.5 rounded-full',
            'border-2 border-white shadow-sm z-10',
            formatter.dotBgClass
          )}
        />
      )}

      {/* Event content */}
      <div className="min-w-0">
        {/* Header row: label/narrative + timestamp */}
        <div className="flex items-start justify-between gap-2">
          {isFactRecorded && summary ? (
            // FACT_RECORDED: narrative as primary text (not truncated, allow wrapping)
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm text-slate-700">
                {summary}
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                Fact
              </span>
            </div>
          ) : (
            // Other events: label + summary
            <div className="flex items-center gap-2 min-w-0">
              <span className={clsx('text-xs', formatter.labelClass)}>
                {formatter.label}
              </span>
              {summary && (
                <span className="text-xs text-slate-500 truncate">
                  {summary}
                </span>
              )}
            </div>
          )}
          <span className="text-xs font-mono text-slate-400 whitespace-nowrap">
            {formatRelativeTime(event.occurredAt instanceof Date ? event.occurredAt.toISOString() : String(event.occurredAt))}
          </span>
        </div>

        {/* Action context (when not grouped) */}
        {actionTitle && event.actionId && (
          <button
            onClick={() => onActionClick?.(event.actionId!)}
            className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline mt-0.5"
          >
            {actionTitle}
          </button>
        )}

        {/* Payload details (expandable) */}
        {hasPayload && (
          <div className="mt-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span>Details</span>
            </button>
            {isExpanded && (
              <div className="mt-1 p-2 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-slate-600 overflow-x-auto">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Special rendering for blocked events with reason */}
        {event.type === 'WORK_BLOCKED' && typeof event.payload.reason === 'string' && (
          <div className="mt-1 p-2 bg-red-50 border border-red-100 rounded text-xs text-slate-600 italic">
            "{event.payload.reason}"
          </div>
        )}

        {/* Special rendering for field updates */}
        {event.type === 'FIELD_VALUE_RECORDED' && typeof event.payload.field_key === 'string' && (
          <div className="mt-1 p-2 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-slate-600 inline-block">
            {String(event.payload.field_key)} = {JSON.stringify(event.payload.value)}
          </div>
        )}
      </div>
    </div>
  );
}

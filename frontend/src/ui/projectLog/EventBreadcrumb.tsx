/**
 * EventBreadcrumb
 *
 * Renders a clickable breadcrumb showing the hierarchy path for an event's context.
 * e.g. "Project: X > Process: Y > Subprocess: Z"
 *
 * Uses --ws-* tokens (workspace UI component).
 */

import { ChevronRight } from 'lucide-react';

import { useNodePath } from '../../api/hooks';

interface EventBreadcrumbProps {
  /** The context node ID from the event */
  contextId: string;
  /** Called when a breadcrumb segment is clicked */
  onSegmentClick?: (nodeId: string) => void;
}

/** Capitalize first letter of node type for display */
function formatType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function EventBreadcrumb({ contextId, onSegmentClick }: EventBreadcrumbProps) {
  const { data: path } = useNodePath(contextId);

  if (!path || path.length === 0) return null;

  return (
    <nav className="flex items-center gap-0.5 text-[11px] text-ws-muted overflow-hidden" aria-label="Context path">
      {path.map((segment, i) => (
        <span key={segment.id} className="flex items-center gap-0.5 min-w-0">
          {i > 0 && <ChevronRight size={10} className="shrink-0 text-ws-muted opacity-50" />}
          {onSegmentClick ? (
            <button
              type="button"
              onClick={() => onSegmentClick(segment.id)}
              className="truncate hover:text-ws-accent hover:underline transition-colors"
              title={`${formatType(segment.type)}: ${segment.title}`}
            >
              {segment.title}
            </button>
          ) : (
            <span
              className="truncate"
              title={`${formatType(segment.type)}: ${segment.title}`}
            >
              {segment.title}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

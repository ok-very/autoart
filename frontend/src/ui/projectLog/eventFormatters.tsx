/**
 * Event Formatters Registry
 *
 * Maps event types to display configuration for the Project Log.
 * Each formatter provides:
 * - label: Human-readable event name
 * - category: For filtering (workflow, field, assignment, reference, dependency, system)
 * - icon: Lucide icon name
 * - colorClass: Tailwind color classes for styling
 * - summarize: Function to generate summary text from payload
 */

import {
  Play,
  Square,
  CheckCircle,
  AlertOctagon,
  CircleOff,
  PenLine,
  UserPlus,
  UserMinus,
  Link2,
  Unlink,
  ArrowUpDown,
  FileText,
  RefreshCw,
  Bug,
  HelpCircle,
  Sparkles,
  Receipt,
  Wallet,
  PiggyBank,
  FileSpreadsheet,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';

import { renderFact, type BaseFactPayload } from '@autoart/shared';

export type EventCategory =
  | 'workflow'
  | 'field'
  | 'fact'
  | 'assignment'
  | 'reference'
  | 'dependency'
  | 'system';

export interface EventFormatter {
  label: string;
  category: EventCategory;
  icon: LucideIcon;
  /** Color for the dot/icon (bg for container, text for icon) */
  dotBgClass: string;
  dotTextClass: string;
  /** Text color for the label */
  labelClass: string;
  /** Whether this is a "major" event (larger dot with icon) vs minor (small colored dot) */
  isMajor: boolean;
  /** Generate summary text from event payload */
  summarize: (payload: Record<string, unknown>) => string | null;
}

/**
 * Registry of all known event formatters
 */
export const eventFormatters: Record<string, EventFormatter> = {
  // ─────────────────────────────────────────────────────────────
  // Workflow Events (Action Lifecycle)
  // ─────────────────────────────────────────────────────────────

  ACTION_DECLARED: {
    label: 'Action Declared',
    category: 'workflow',
    icon: FileText,
    dotBgClass: 'bg-slate-200',
    dotTextClass: 'text-slate-600',
    labelClass: 'text-slate-700',
    isMajor: false,
    summarize: (payload) => {
      const title = payload.title as string | undefined;
      return title ? `"${title}"` : null;
    },
  },

  WORK_STARTED: {
    label: 'Work Started',
    category: 'workflow',
    icon: Play,
    dotBgClass: 'bg-indigo-100',
    dotTextClass: 'text-indigo-600',
    labelClass: 'text-indigo-700 font-semibold',
    isMajor: true,
    summarize: () => null,
  },

  WORK_STOPPED: {
    label: 'Work Stopped',
    category: 'workflow',
    icon: Square,
    dotBgClass: 'bg-slate-100',
    dotTextClass: 'text-slate-600',
    labelClass: 'text-slate-700',
    isMajor: true,
    summarize: () => null,
  },

  WORK_FINISHED: {
    label: 'Work Finished',
    category: 'workflow',
    icon: CheckCircle,
    dotBgClass: 'bg-emerald-100',
    dotTextClass: 'text-emerald-600',
    labelClass: 'text-emerald-700 font-semibold',
    isMajor: true,
    summarize: () => null,
  },

  WORK_BLOCKED: {
    label: 'Blocked',
    category: 'workflow',
    icon: AlertOctagon,
    dotBgClass: 'bg-red-100',
    dotTextClass: 'text-red-600',
    labelClass: 'text-red-700 font-semibold',
    isMajor: true,
    summarize: (payload) => {
      const reason = payload.reason as string | undefined;
      return reason ? `"${reason}"` : null;
    },
  },

  WORK_UNBLOCKED: {
    label: 'Unblocked',
    category: 'workflow',
    icon: CircleOff,
    dotBgClass: 'bg-emerald-400',
    dotTextClass: 'text-white',
    labelClass: 'text-emerald-700',
    isMajor: false,
    summarize: () => null,
  },

  // ─────────────────────────────────────────────────────────────
  // Field Events
  // ─────────────────────────────────────────────────────────────

  FIELD_VALUE_RECORDED: {
    label: 'Field Value Recorded',
    category: 'field',
    icon: PenLine,
    dotBgClass: 'bg-blue-400',
    dotTextClass: 'text-white',
    labelClass: 'text-slate-700',
    isMajor: false,
    summarize: (payload) => {
      const field = payload.field_key as string | undefined;
      const value = payload.value;
      if (field && value !== undefined) {
        const displayValue = typeof value === 'string' ? value : JSON.stringify(value);
        const truncated = displayValue.length > 50 ? displayValue.slice(0, 47) + '...' : displayValue;
        return `${field} = "${truncated}"`;
      }
      return field ? `${field} updated` : null;
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Fact Events (Domain facts via FACT_RECORDED)
  // ─────────────────────────────────────────────────────────────

  FACT_RECORDED: {
    label: 'Fact Recorded',
    category: 'fact',
    icon: Sparkles,
    dotBgClass: 'bg-amber-100',
    dotTextClass: 'text-amber-600',
    labelClass: 'text-amber-700',
    isMajor: true,
    summarize: (payload) => {
      // Use shared renderFact for deterministic narrative
      try {
        return renderFact(payload as BaseFactPayload);
      } catch {
        const factKind = payload.factKind as string | undefined;
        return factKind ? `${factKind.replace(/_/g, ' ').toLowerCase()}` : null;
      }
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Assignment Events
  // ─────────────────────────────────────────────────────────────

  ASSIGNMENT_OCCURRED: {
    label: 'Assigned',
    category: 'assignment',
    icon: UserPlus,
    dotBgClass: 'bg-purple-100',
    dotTextClass: 'text-purple-600',
    labelClass: 'text-purple-700',
    isMajor: true,
    summarize: (payload) => {
      const assignee = payload.assignee_name as string | undefined;
      return assignee ? `to ${assignee}` : null;
    },
  },

  ASSIGNMENT_REMOVED: {
    label: 'Unassigned',
    category: 'assignment',
    icon: UserMinus,
    dotBgClass: 'bg-purple-50',
    dotTextClass: 'text-purple-400',
    labelClass: 'text-purple-600',
    isMajor: false,
    summarize: (payload) => {
      const assignee = payload.assignee_name as string | undefined;
      return assignee ? `from ${assignee}` : null;
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Dependency Events
  // ─────────────────────────────────────────────────────────────

  DEPENDENCY_ADDED: {
    label: 'Dependency Added',
    category: 'dependency',
    icon: Link2,
    dotBgClass: 'bg-amber-100',
    dotTextClass: 'text-amber-600',
    labelClass: 'text-amber-700',
    isMajor: false,
    summarize: (payload) => {
      const depTitle = payload.depends_on_title as string | undefined;
      return depTitle ? `depends on "${depTitle}"` : null;
    },
  },

  DEPENDENCY_REMOVED: {
    label: 'Dependency Removed',
    category: 'dependency',
    icon: Unlink,
    dotBgClass: 'bg-amber-50',
    dotTextClass: 'text-amber-400',
    labelClass: 'text-amber-600',
    isMajor: false,
    summarize: (payload) => {
      const depTitle = payload.depends_on_title as string | undefined;
      return depTitle ? `removed "${depTitle}"` : null;
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Reference Events
  // ─────────────────────────────────────────────────────────────

  ACTION_REFERENCE_ADDED: {
    label: 'Reference Added',
    category: 'reference',
    icon: Link2,
    dotBgClass: 'bg-cyan-100',
    dotTextClass: 'text-cyan-600',
    labelClass: 'text-cyan-700',
    isMajor: false,
    summarize: (payload) => {
      const recordName = payload.record_name as string | undefined;
      return recordName ? `linked to "${recordName}"` : null;
    },
  },

  ACTION_REFERENCE_REMOVED: {
    label: 'Reference Removed',
    category: 'reference',
    icon: Unlink,
    dotBgClass: 'bg-cyan-50',
    dotTextClass: 'text-cyan-400',
    labelClass: 'text-cyan-600',
    isMajor: false,
    summarize: (payload) => {
      const recordName = payload.record_name as string | undefined;
      return recordName ? `unlinked "${recordName}"` : null;
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Ordering Events
  // ─────────────────────────────────────────────────────────────

  WORKFLOW_ROW_MOVED: {
    label: 'Row Reordered',
    category: 'workflow',
    icon: ArrowUpDown,
    dotBgClass: 'bg-slate-200',
    dotTextClass: 'text-slate-500',
    labelClass: 'text-slate-600',
    isMajor: false,
    summarize: (payload) => {
      const from = payload.from_position as number | undefined;
      const to = payload.to_position as number | undefined;
      if (from !== undefined && to !== undefined) {
        return `moved from #${from + 1} to #${to + 1}`;
      }
      return null;
    },
  },

  // ─────────────────────────────────────────────────────────────
  // System Events (hidden by default)
  // ─────────────────────────────────────────────────────────────

  PROJECTION_REFRESH: {
    label: 'Projection Refreshed',
    category: 'system',
    icon: RefreshCw,
    dotBgClass: 'bg-gray-100',
    dotTextClass: 'text-gray-400',
    labelClass: 'text-gray-500 italic',
    isMajor: false,
    summarize: () => null,
  },

  DEBUG_EVENT: {
    label: 'Debug',
    category: 'system',
    icon: Bug,
    dotBgClass: 'bg-gray-100',
    dotTextClass: 'text-gray-400',
    labelClass: 'text-gray-500 italic',
    isMajor: false,
    summarize: (payload) => {
      const msg = payload.message as string | undefined;
      return msg || null;
    },
  },

  SYSTEM_MAINTENANCE: {
    label: 'System Maintenance',
    category: 'system',
    icon: RefreshCw,
    dotBgClass: 'bg-gray-100',
    dotTextClass: 'text-gray-400',
    labelClass: 'text-gray-500 italic',
    isMajor: false,
    summarize: () => null,
  },
};

/**
 * Fallback formatter for unknown event types
 */
export const unknownEventFormatter: EventFormatter = {
  label: 'Event',
  category: 'system',
  icon: HelpCircle,
  dotBgClass: 'bg-slate-200',
  dotTextClass: 'text-slate-400',
  labelClass: 'text-slate-600',
  isMajor: false,
  summarize: () => null,
};

/**
 * Finance fact-kind overrides for FACT_RECORDED events.
 * When a FACT_RECORDED event has a financial factKind, these overrides
 * provide finance-specific icon and color treatment.
 */
const FINANCE_FACT_OVERRIDES: Record<string, Partial<EventFormatter>> = {
  INVOICE_PREPARED: {
    label: 'Invoice Prepared',
    icon: Receipt,
    dotBgClass: 'bg-emerald-100',
    dotTextClass: 'text-emerald-600',
    labelClass: 'text-emerald-700',
  },
  PAYMENT_RECORDED: {
    label: 'Payment Recorded',
    icon: Wallet,
    dotBgClass: 'bg-green-100',
    dotTextClass: 'text-green-600',
    labelClass: 'text-green-700',
  },
  BUDGET_ALLOCATED: {
    label: 'Budget Allocated',
    icon: PiggyBank,
    dotBgClass: 'bg-blue-100',
    dotTextClass: 'text-blue-600',
    labelClass: 'text-blue-700',
  },
  EXPENSE_RECORDED: {
    label: 'Expense Recorded',
    icon: CreditCard,
    dotBgClass: 'bg-orange-100',
    dotTextClass: 'text-orange-600',
    labelClass: 'text-orange-700',
  },
  BILL_RECEIVED: {
    label: 'Bill Received',
    icon: FileSpreadsheet,
    dotBgClass: 'bg-purple-100',
    dotTextClass: 'text-purple-600',
    labelClass: 'text-purple-700',
  },
};

/**
 * Get formatter for an event type, with fallback for unknown types.
 * For FACT_RECORDED events, checks the payload's factKind for finance-specific overrides.
 */
export function getEventFormatter(eventType: string, payload?: Record<string, unknown>): EventFormatter {
  const base = eventFormatters[eventType];

  if (base && eventType === 'FACT_RECORDED' && payload) {
    const factKind = payload.factKind as string | undefined;
    if (factKind && FINANCE_FACT_OVERRIDES[factKind]) {
      return { ...base, ...FINANCE_FACT_OVERRIDES[factKind] };
    }
  }

  return base || {
    ...unknownEventFormatter,
    label: eventType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
  };
}

/**
 * Get all categories for filtering UI
 */
export const EVENT_CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: 'workflow', label: 'Workflow' },
  { value: 'fact', label: 'Facts' },
  { value: 'field', label: 'Fields' },
  { value: 'assignment', label: 'Assignments' },
  { value: 'dependency', label: 'Dependencies' },
  { value: 'reference', label: 'References' },
  { value: 'system', label: 'System' },
];

/**
 * Get event types by category
 */
export function getEventTypesByCategory(category: EventCategory): string[] {
  return Object.entries(eventFormatters)
    .filter(([_, formatter]) => formatter.category === category)
    .map(([type]) => type);
}

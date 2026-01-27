/**
 * EmailFactCard
 *
 * Displays an email as a potential fact source in the narrative stream.
 * Emails are grouped under the "Communication" fact family and can be
 * linked to actions to record facts like INFORMATION_SENT.
 */

import { clsx } from 'clsx';
import {
    Mail,
    Paperclip,
    Link2,
} from 'lucide-react';
import { useMemo } from 'react';

import { Badge } from '@autoart/ui';

import type { LinkedEntity } from './LinkedEntityBadge';
import { LinkedEntityGroup } from './LinkedEntityBadge';

export interface EmailFactCardProps {
    /** Email ID */
    id: string;
    /** Email subject */
    subject: string;
    /** Sender name */
    senderName: string;
    /** Sender email address */
    senderEmail: string;
    /** Received timestamp */
    receivedAt: string;
    /** Preview of email body */
    bodyPreview?: string;
    /** Whether email has attachments */
    hasAttachments?: boolean;
    /** Linked entities (actions, records) */
    linkedEntities?: LinkedEntity[];
    /** Suggested fact kind this email could record */
    suggestedFactKind?: 'INFORMATION_SENT' | 'DOCUMENT_SUBMITTED' | 'MEETING_SCHEDULED';
    /** Whether this card is selected */
    selected?: boolean;
    /** Click handler */
    onClick?: () => void;
    /** Handler to link email to entity */
    onLinkClick?: () => void;
    /** Handler to navigate to linked entity */
    onEntityNavigate?: (entity: LinkedEntity) => void;
    /** Additional className */
    className?: string;
}

/**
 * Format relative time
 */
function formatTimeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

/**
 * Fact kind display configuration
 */
const factKindConfig: Record<string, {
    label: string;
    colorClass: string;
    bgClass: string;
}> = {
    INFORMATION_SENT: {
        label: 'Information',
        colorClass: 'text-blue-700',
        bgClass: 'bg-blue-50',
    },
    DOCUMENT_SUBMITTED: {
        label: 'Document',
        colorClass: 'text-green-700',
        bgClass: 'bg-green-50',
    },
    MEETING_SCHEDULED: {
        label: 'Meeting',
        colorClass: 'text-purple-700',
        bgClass: 'bg-purple-50',
    },
};

/**
 * EmailFactCard Component
 */
export function EmailFactCard({
    id: _id,
    subject,
    senderName,
    senderEmail,
    receivedAt,
    bodyPreview,
    hasAttachments = false,
    linkedEntities = [],
    suggestedFactKind,
    selected = false,
    onClick,
    onLinkClick,
    onEntityNavigate,
    className,
}: EmailFactCardProps) {
    const timeAgo = useMemo(() => formatTimeAgo(receivedAt), [receivedAt]);
    const isLinked = linkedEntities.length > 0;

    const factConfig = suggestedFactKind ? factKindConfig[suggestedFactKind] : null;

    return (
        <div
            className={clsx(
                'rounded-lg border bg-white transition-all duration-150',
                selected
                    ? 'border-blue-400 ring-2 ring-blue-100 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm',
                onClick && 'cursor-pointer',
                className
            )}
            onClick={onClick}
        >
            {/* Header */}
            <div className="px-3 py-2 flex items-start gap-2">
                {/* Mail icon */}
                <div className={clsx(
                    'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5',
                    isLinked ? 'bg-blue-100' : 'bg-slate-100'
                )}>
                    <Mail size={16} className={isLinked ? 'text-blue-600' : 'text-slate-600'} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Subject and time */}
                    <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm text-slate-900 truncate flex-1">
                            {subject}
                        </h4>
                        {hasAttachments && (
                            <Paperclip size={12} className="text-slate-400 shrink-0" />
                        )}
                        <span className="text-xs text-slate-400 shrink-0">
                            {timeAgo}
                        </span>
                    </div>

                    {/* Sender */}
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                        {senderName} &lt;{senderEmail}&gt;
                    </p>

                    {/* Body preview */}
                    {bodyPreview && (
                        <p className="text-xs text-slate-400 truncate mt-1">
                            {bodyPreview}
                        </p>
                    )}
                </div>
            </div>

            {/* Footer with linked entities and suggestions */}
            <div className="px-3 pb-2 flex items-center justify-between gap-2">
                {/* Linked entities */}
                {isLinked ? (
                    <LinkedEntityGroup
                        entities={linkedEntities}
                        maxVisible={2}
                        size="xs"
                        onEntityClick={onEntityNavigate}
                    />
                ) : (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onLinkClick?.();
                        }}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <Link2 size={12} />
                        Link to action
                    </button>
                )}

                {/* Suggested fact kind */}
                {factConfig && (
                    <Badge
                        variant="neutral"
                        size="xs"
                        className={clsx(factConfig.bgClass, factConfig.colorClass)}
                    >
                        {factConfig.label}
                    </Badge>
                )}
            </div>
        </div>
    );
}

export default EmailFactCard;

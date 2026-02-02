/**
 * EmailLinkActions
 *
 * "Link to Action/Record" UI for the mailbox.
 * Allows users to create connections between emails and other entities.
 */

import { clsx } from 'clsx';
import {
    Link2,
    Target,
    FileText,
    Plus,
    Loader2,
    Search,
} from 'lucide-react';
import { useState, useMemo } from 'react';

import { Button, Badge } from '@autoart/ui';

import { useSearch } from '../../api/hooks';
import { usePromoteEmail, useLinkEmail } from '../../api/hooks/mailMessages';
import type { MailLinkTargetType } from '../../api/types/mail';
import type { LinkedEntity, LinkedEntityType } from './LinkedEntityBadge';

export interface EmailLinkActionsProps {
    /** Email ID to link from */
    emailId: string;
    /** Existing linked entities */
    linkedEntities?: LinkedEntity[];
    /** Callback when a link is created */
    onLinkCreated?: (entityType: LinkedEntityType, entityId: string) => void;
    /** Callback when a link is removed */
    onLinkRemoved?: (entityType: LinkedEntityType, entityId: string) => void;
    /** Additional className */
    className?: string;
}

type LinkMode = 'action' | 'record' | null;

/**
 * Search result item
 */
function SearchResultItem({
    type,
    id: _id,
    title,
    subtitle,
    onSelect,
}: {
    type: LinkedEntityType;
    id: string;
    title: string;
    subtitle?: string;
    onSelect: () => void;
}) {
    const Icon = type === 'action' ? Target : FileText;
    const colorClass = type === 'action' ? 'text-green-600' : 'text-blue-600';

    return (
        <button
            type="button"
            onClick={onSelect}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 transition-colors text-left"
        >
            <div className={clsx('shrink-0', colorClass)}>
                <Icon size={16} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">
                    {title}
                </p>
                {subtitle && (
                    <p className="text-xs text-slate-500 truncate">
                        {subtitle}
                    </p>
                )}
            </div>
        </button>
    );
}

/**
 * EmailLinkActions Component
 */
export function EmailLinkActions({
    emailId,
    linkedEntities = [],
    onLinkCreated,
    onLinkRemoved: _onLinkRemoved,
    className,
}: EmailLinkActionsProps) {
    const [linkMode, setLinkMode] = useState<LinkMode>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLinking, setIsLinking] = useState(false);

    const promoteMutation = usePromoteEmail();
    const linkMutation = useLinkEmail();

    // Search for entities
    const { data: searchResults, isLoading: searchLoading } = useSearch(
        searchQuery,
        linkMode === 'action' ? 'action' : linkMode === 'record' ? 'record' : undefined
    );

    // Filter out already linked entities
    const filteredResults = useMemo(() => {
        if (!searchResults) return [];
        const linkedIds = new Set(linkedEntities.map((e) => e.id));
        return searchResults.filter((r) => !linkedIds.has(r.id));
    }, [searchResults, linkedEntities]);

    const handleSelectEntity = async (type: LinkedEntityType, id: string) => {
        setIsLinking(true);
        try {
            // Promote the email first (idempotent — returns existing if already promoted)
            const message = await promoteMutation.mutateAsync(emailId);

            // Create the link
            const targetType: MailLinkTargetType = type === 'action' ? 'action' : 'record';
            await linkMutation.mutateAsync({
                messageId: message.id,
                targetType,
                targetId: id,
            });

            onLinkCreated?.(type, id);
            setLinkMode(null);
            setSearchQuery('');
        } finally {
            setIsLinking(false);
        }
    };

    const handleCreateNewAction = () => {
        // TODO: Open action composer with email context
    };

    // Collapsed state - just show link button
    if (!linkMode) {
        return (
            <div className={clsx('flex items-center gap-2', className)}>
                <Button
                    variant="ghost"
                    size="xs"
                    leftSection={<Link2 size={12} />}
                    onClick={() => setLinkMode('action')}
                >
                    Link
                </Button>
                {linkedEntities.length > 0 && (
                    <Badge variant="neutral" size="xs">
                        {linkedEntities.length} linked
                    </Badge>
                )}
            </div>
        );
    }

    return (
        <div className={clsx(
            'bg-white border border-slate-200 rounded-lg shadow-lg p-3 min-w-[280px]',
            className
        )}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-700">
                    Link to {linkMode === 'action' ? 'Action' : 'Record'}
                </span>
                <button
                    type="button"
                    onClick={() => {
                        setLinkMode(null);
                        setSearchQuery('');
                    }}
                    className="text-xs text-slate-500 hover:text-slate-700"
                >
                    Cancel
                </button>
            </div>

            {/* Type selector */}
            <div className="flex gap-2 mb-3">
                <button
                    type="button"
                    onClick={() => setLinkMode('action')}
                    className={clsx(
                        'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors',
                        linkMode === 'action'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    )}
                >
                    <Target size={12} />
                    Action
                </button>
                <button
                    type="button"
                    onClick={() => setLinkMode('record')}
                    className={clsx(
                        'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors',
                        linkMode === 'record'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    )}
                >
                    <FileText size={12} />
                    Record
                </button>
            </div>

            {/* Search input */}
            <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${linkMode === 'action' ? 'actions' : 'records'}...`}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                />
            </div>

            {/* Search results */}
            <div className="max-h-[200px] overflow-y-auto border border-slate-100 rounded-lg">
                {searchLoading ? (
                    <div className="flex items-center justify-center py-4 text-slate-400">
                        <Loader2 size={16} className="animate-spin mr-2" />
                        <span className="text-sm">Searching...</span>
                    </div>
                ) : filteredResults.length > 0 ? (
                    filteredResults.slice(0, 5).map((result) => (
                        <SearchResultItem
                            key={result.id}
                            type={linkMode!}
                            id={result.id}
                            title={result.name || result.id}
                            subtitle={result.type}
                            onSelect={() => handleSelectEntity(linkMode!, result.id)}
                        />
                    ))
                ) : searchQuery.length > 0 ? (
                    <div className="text-center py-4 text-sm text-slate-400">
                        No {linkMode === 'action' ? 'actions' : 'records'} found
                    </div>
                ) : (
                    <div className="text-center py-4 text-sm text-slate-400">
                        Type to search
                    </div>
                )}
            </div>

            {/* Create new action option */}
            {linkMode === 'action' && (
                <button
                    type="button"
                    onClick={handleCreateNewAction}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                    <Plus size={12} />
                    Create new action from this email
                </button>
            )}

            {/* Linking indicator */}
            {isLinking && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
                    <Loader2 size={20} className="animate-spin text-blue-600" />
                </div>
            )}
        </div>
    );
}

export default EmailLinkActions;

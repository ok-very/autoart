/**
 * LinksManager - Semantic Component for managing record-to-record links
 *
 * Responsibilities:
 * - Fetches all links for a record (incoming and outgoing)
 * - Handles link deletion
 * - Navigates to linked records
 *
 * Design Rules:
 * - Self-contained data fetching and persistence
 * - Uses bottom drawer for delete confirmations and link creation
 * - No external onChange - all updates go through API
 */

import { ExternalLink, Trash2 } from 'lucide-react';

import { useRecordLinks, useDeleteLink, useLinkTypes } from '../../api/hooks';
import type { RecordLink } from '../../api/hooks/links';
import { useUIStore } from '../../stores/uiStore';

export interface LinksManagerProps {
    /** ID of the record to manage links for */
    recordId: string;
}

/**
 * LinksManager - Display and manage record-to-record links
 *
 * Shows:
 * - Outgoing links (this record → other records)
 * - Incoming links (other records → this record)
 * - Link type badges
 * - Create/delete actions
 */
export function LinksManager({ recordId }: LinksManagerProps) {
    const { data: linksData, isLoading } = useRecordLinks(recordId);
    const { data: linkTypes } = useLinkTypes();
    const deleteLink = useDeleteLink();
    const { openOverlay } = useUIStore();

    if (isLoading) {
        return (
            <div className="fade-in flex items-center justify-center py-8">
                <div className="text-sm text-ws-muted">Loading links...</div>
            </div>
        );
    }

    const outgoing = linksData?.outgoing || [];
    const incoming = linksData?.incoming || [];
    const totalLinks = outgoing.length + incoming.length;

    const handleDeleteLink = (link: RecordLink) => {
        openOverlay('confirm-delete', {
            title: 'Delete Link',
            message:
                'Are you sure you want to delete this link? The relationship between these records will be removed.',
            itemName: `${link.link_type} link`,
            onConfirm: async () => {
                await deleteLink.mutateAsync(link.id);
            },
        });
    };

    return (
        <div className="fade-in space-y-6">
            {/* Header Card */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                    <ExternalLink size={16} className="text-purple-600" />
                    <span className="text-sm font-semibold text-purple-900">Record Links</span>
                </div>
                <p className="text-xs text-purple-700 leading-relaxed mb-3">
                    Links connect this record to other records in the system. Use{' '}
                    <code className="bg-purple-100 px-1 rounded">@recordname</code> in fields to create
                    links.
                </p>

                <button
                    onClick={() => openOverlay('create-link', { sourceRecordId: recordId })}
                    className="w-full py-2 bg-ws-panel-bg border border-purple-200 text-purple-700 rounded text-xs font-semibold hover:bg-purple-50 hover:border-purple-300 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                    <ExternalLink size={12} />
                    Link Another Record
                </button>
            </div>

            {/* Link Types Summary */}
            {linkTypes && linkTypes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {linkTypes.map((type) => (
                        <span
                            key={type}
                            className="text-[10px] bg-slate-100 text-ws-text-secondary px-2 py-0.5 rounded"
                        >
                            {type}
                        </span>
                    ))}
                </div>
            )}

            {/* Outgoing Links */}
            <div className="space-y-3">
                <h4 className="text-xs font-semibold text-ws-muted uppercase border-b border-ws-panel-border pb-2 flex items-center gap-2">
                    <span className="text-blue-500">→</span> Outgoing Links ({outgoing.length})
                </h4>

                {outgoing.length === 0 ? (
                    <p className="text-sm text-ws-muted italic py-2">No outgoing links</p>
                ) : (
                    outgoing.map((link) => (
                        <LinkCard
                            key={link.id}
                            link={link}
                            direction="outgoing"
                            onDelete={() => handleDeleteLink(link)}
                        />
                    ))
                )}
            </div>

            {/* Incoming Links */}
            <div className="space-y-3">
                <h4 className="text-xs font-semibold text-ws-muted uppercase border-b border-ws-panel-border pb-2 flex items-center gap-2">
                    <span className="text-green-500">←</span> Incoming Links ({incoming.length})
                </h4>

                {incoming.length === 0 ? (
                    <p className="text-sm text-ws-muted italic py-2">No incoming links</p>
                ) : (
                    incoming.map((link) => (
                        <LinkCard
                            key={link.id}
                            link={link}
                            direction="incoming"
                            onDelete={() => handleDeleteLink(link)}
                        />
                    ))
                )}
            </div>

            {/* Empty State */}
            {totalLinks === 0 && (
                <div className="text-center py-6 border border-dashed border-ws-panel-border rounded-lg">
                    <div className="text-ws-muted mb-2">
                        <ExternalLink size={32} className="mx-auto" />
                    </div>
                    <p className="text-sm text-ws-muted">No links yet</p>
                    <p className="text-xs text-ws-muted mt-1">
                        Links are created when you reference other records
                    </p>
                </div>
            )}
        </div>
    );
}

interface LinkCardProps {
    link: RecordLink;
    direction: 'outgoing' | 'incoming';
    onDelete: () => void;
}

function LinkCard({ link, direction, onDelete }: LinkCardProps) {
    const { inspectRecord } = useUIStore();

    const targetInfo = direction === 'outgoing' ? link.target_record : link.source_record;
    const recordName = targetInfo?.unique_name || 'Unknown Record';
    const definitionName = targetInfo?.definition_name || 'Unknown Type';
    const recordId = direction === 'outgoing' ? link.target_record_id : link.source_record_id;

    const handleNavigate = () => {
        inspectRecord(recordId);
    };

    return (
        <div className="border border-ws-panel-border rounded-lg p-3 bg-ws-panel-bg hover:shadow-sm transition-all group">
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    {/* Link Type Badge */}
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                        {link.link_type}
                    </span>

                    {/* Record Info */}
                    <button
                        onClick={handleNavigate}
                        className="mt-2 block text-left w-full hover:bg-ws-bg rounded p-1 -m-1 transition-colors"
                    >
                        <div className="text-sm font-medium text-ws-fg truncate">{recordName}</div>
                        <div className="text-xs text-ws-muted truncate">{definitionName}</div>
                    </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={handleNavigate}
                        className="p-1 text-ws-muted hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                        title="View record"
                    >
                        <ExternalLink size={14} />
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-1 text-ws-muted hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Delete link"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Metadata preview if any */}
            {Object.keys(link.metadata).length > 0 && (
                <div className="mt-2 pt-2 border-t border-ws-panel-border">
                    <div className="text-[10px] text-ws-muted uppercase mb-1">Metadata</div>
                    <div className="text-xs text-ws-text-secondary font-mono bg-ws-bg rounded p-1 truncate">
                        {JSON.stringify(link.metadata)}
                    </div>
                </div>
            )}

            {/* Created timestamp */}
            <div className="mt-2 text-[10px] text-ws-muted">
                Created {new Date(link.created_at).toLocaleDateString()}
            </div>
        </div>
    );
}

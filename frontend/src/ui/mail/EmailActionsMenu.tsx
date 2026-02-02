/**
 * EmailActionsMenu
 *
 * Shared dropdown menu for email triage actions.
 * Consolidates the inline EmailActions that were duplicated across
 * MailContent, MailPage, and MailPanel.
 */

import { MoreHorizontal, AlertTriangle, Info, Archive, Loader2, BookmarkPlus } from 'lucide-react';

import { Menu } from '@autoart/ui';

import {
    useArchiveEmail,
    useMarkActionRequired,
    useMarkInformational,
} from '../../api/hooks/mail';
import { usePromoteEmail } from '../../api/hooks/mailMessages';
import type { ProcessedEmail } from '../../api/types/mail';

export interface EmailActionsMenuProps {
    email: ProcessedEmail;
    onAction?: () => void;
}

export function EmailActionsMenu({ email, onAction }: EmailActionsMenuProps) {
    const archiveMutation = useArchiveEmail();
    const actionRequiredMutation = useMarkActionRequired();
    const informationalMutation = useMarkInformational();
    const promoteMutation = usePromoteEmail();

    const isPending =
        archiveMutation.isPending ||
        actionRequiredMutation.isPending ||
        informationalMutation.isPending ||
        promoteMutation.isPending;

    return (
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <Menu>
                <Menu.Target>
                    <button
                        disabled={isPending}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
                    >
                        {isPending ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <MoreHorizontal size={14} />
                        )}
                    </button>
                </Menu.Target>
                <Menu.Dropdown align="end">
                    <Menu.Item
                        leftSection={<AlertTriangle size={14} className="text-red-500" />}
                        disabled={isPending}
                        onClick={() => {
                            actionRequiredMutation.mutate(email.id, { onSuccess: onAction });
                        }}
                    >
                        Action Required
                    </Menu.Item>
                    <Menu.Item
                        leftSection={<Info size={14} className="text-blue-500" />}
                        disabled={isPending}
                        onClick={() => {
                            informationalMutation.mutate(email.id, { onSuccess: onAction });
                        }}
                    >
                        Informational
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item
                        leftSection={<BookmarkPlus size={14} className="text-amber-600" />}
                        disabled={isPending}
                        onClick={() => {
                            promoteMutation.mutate(email.id, { onSuccess: onAction });
                        }}
                    >
                        Save to System
                    </Menu.Item>
                    <Menu.Item
                        leftSection={<Archive size={14} className="text-slate-400" />}
                        disabled={isPending}
                        onClick={() => {
                            archiveMutation.mutate(email.id, { onSuccess: onAction });
                        }}
                    >
                        Archive
                    </Menu.Item>
                </Menu.Dropdown>
            </Menu>
        </div>
    );
}

/**
 * ExportMenu
 *
 * Dropdown menu for invoice export actions: PDF download, DOCX download,
 * OneDrive upload, Google Drive upload. Cloud items show connection status
 * and trigger OAuth popup if not connected.
 */

import { FileText, FileType, Cloud, ChevronDown, Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';

import {
    useCloudConnectionStatus,
    useExportInvoiceToOneDrive,
    useExportInvoiceToGoogleDrive,
} from '../../api/hooks/exports';
import { useGetGoogleAuthUrl, useGetMicrosoftAuthUrl } from '../../api/connections';
import { usePopupOAuth } from '../../api/usePopupOAuth';
import { Button, Menu } from '@autoart/ui';

interface ExportMenuProps {
    invoiceId: string;
    invoiceNumber: string;
}

export function ExportMenu({ invoiceId, invoiceNumber }: ExportMenuProps) {
    const { data: cloudStatus } = useCloudConnectionStatus();
    const exportOneDrive = useExportInvoiceToOneDrive();
    const exportGoogleDrive = useExportInvoiceToGoogleDrive();

    const getGoogleAuthUrl = useGetGoogleAuthUrl();
    const getMicrosoftAuthUrl = useGetMicrosoftAuthUrl();
    const openPopup = usePopupOAuth();

    const [pending, setPending] = useState<string | null>(null);

    const googleConnected = cloudStatus?.google ?? false;
    const microsoftConnected = cloudStatus?.microsoft ?? false;

    // ── Handlers ──────────────────────────────────────────────────────

    const handlePdfDownload = useCallback(() => {
        // Trigger browser download via hidden link
        const link = document.createElement('a');
        link.href = `/api/exports/finance/invoice-pdf`;
        link.download = `invoice-${invoiceNumber}.pdf`;
        // Use POST via form for PDF (existing endpoint expects POST with invoiceId)
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = `/api/exports/finance/invoice-pdf`;
        form.target = '_blank';
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'invoiceId';
        input.value = invoiceId;
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
    }, [invoiceId, invoiceNumber]);

    const handleDocxDownload = useCallback(() => {
        window.open(`/api/exports/finance/invoice-docx/${invoiceId}/download`, '_blank');
    }, [invoiceId]);

    const handleOneDrive = useCallback(async () => {
        if (!microsoftConnected) {
            // Trigger OAuth flow, then retry
            try {
                const { url } = await getMicrosoftAuthUrl.mutateAsync();
                await openPopup(url, { name: 'microsoft-oauth' });
                // After popup closes, the connection should be established
                // Retry export
            } catch {
                return;
            }
        }

        setPending('onedrive');
        try {
            const result = await exportOneDrive.mutateAsync(invoiceId);
            if (result.webUrl) {
                window.open(result.webUrl, '_blank');
            }
        } catch {
            // Error handled by mutation state
        } finally {
            setPending(null);
        }
    }, [invoiceId, microsoftConnected, getMicrosoftAuthUrl, openPopup, exportOneDrive]);

    const handleGoogleDrive = useCallback(async () => {
        if (!googleConnected) {
            try {
                const { url } = await getGoogleAuthUrl.mutateAsync();
                await openPopup(url, { name: 'google-oauth' });
            } catch {
                return;
            }
        }

        setPending('google-drive');
        try {
            const result = await exportGoogleDrive.mutateAsync(invoiceId);
            if (result.webViewLink) {
                window.open(result.webViewLink, '_blank');
            }
        } catch {
            // Error handled by mutation state
        } finally {
            setPending(null);
        }
    }, [invoiceId, googleConnected, getGoogleAuthUrl, openPopup, exportGoogleDrive]);

    // ── Render ────────────────────────────────────────────────────────

    const isExporting = pending !== null;

    return (
        <Menu>
            <Menu.Target>
                <Button
                    variant="ghost"
                    size="sm"
                    leftSection={isExporting ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
                >
                    Export
                </Button>
            </Menu.Target>
            <Menu.Dropdown align="end" className="min-w-[220px]">
                <Menu.Label>Download</Menu.Label>
                <Menu.Item
                    leftSection={<FileText size={14} className="text-slate-400" />}
                    onClick={handlePdfDownload}
                >
                    PDF
                </Menu.Item>
                <Menu.Item
                    leftSection={<FileType size={14} className="text-slate-400" />}
                    onClick={handleDocxDownload}
                >
                    Word Document
                </Menu.Item>

                <Menu.Divider />

                <Menu.Label>Cloud Export</Menu.Label>
                <Menu.Item
                    leftSection={<Cloud size={14} className="text-slate-400" />}
                    rightSection={
                        pending === 'onedrive'
                            ? <Loader2 size={12} className="animate-spin" />
                            : !microsoftConnected
                                ? <span className="text-xs text-slate-400">Not connected</span>
                                : undefined
                    }
                    onClick={handleOneDrive}
                    disabled={isExporting}
                >
                    OneDrive
                </Menu.Item>
                <Menu.Item
                    leftSection={<Cloud size={14} className="text-slate-400" />}
                    rightSection={
                        pending === 'google-drive'
                            ? <Loader2 size={12} className="animate-spin" />
                            : !googleConnected
                                ? <span className="text-xs text-slate-400">Not connected</span>
                                : undefined
                    }
                    onClick={handleGoogleDrive}
                    disabled={isExporting}
                >
                    Google Drive
                </Menu.Item>
            </Menu.Dropdown>
        </Menu>
    );
}

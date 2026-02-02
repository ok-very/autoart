/**
 * ExportMenu
 *
 * Dropdown menu for invoice export actions: PDF download, DOCX download,
 * OneDrive upload, Google Drive upload. Cloud items show connection status
 * and trigger OAuth popup if not connected.
 */

import { FileText, FileType, Cloud, ChevronDown, Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

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

    const queryClient = useQueryClient();
    const [pending, setPending] = useState<string | null>(null);
    const [exportError, setExportError] = useState<string | null>(null);

    const googleConnected = cloudStatus?.google ?? false;
    const microsoftConnected = cloudStatus?.microsoft ?? false;

    // ── Handlers ──────────────────────────────────────────────────────

    const handlePdfDownload = useCallback(() => {
        setExportError(null);
        // Use POST via form for PDF (existing endpoint expects POST with invoiceId)
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = `/api/exports/finance/invoice-pdf`;
        form.target = '_blank';
        const idInput = document.createElement('input');
        idInput.type = 'hidden';
        idInput.name = 'invoiceId';
        idInput.value = invoiceId;
        form.appendChild(idInput);
        const numInput = document.createElement('input');
        numInput.type = 'hidden';
        numInput.name = 'invoiceNumber';
        numInput.value = invoiceNumber;
        form.appendChild(numInput);
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
    }, [invoiceId, invoiceNumber]);

    const handleDocxDownload = useCallback(() => {
        setExportError(null);
        const params = new URLSearchParams({ invoiceNumber });
        window.open(`/api/exports/finance/invoice-docx/${invoiceId}/download?${params}`, '_blank', 'noopener,noreferrer');
    }, [invoiceId, invoiceNumber]);

    const handleOneDrive = useCallback(async () => {
        setExportError(null);
        if (!microsoftConnected) {
            try {
                const { url } = await getMicrosoftAuthUrl.mutateAsync();
                await openPopup(url, { name: 'microsoft-oauth' });
                queryClient.invalidateQueries({ queryKey: ['cloud-connection-status'] });
            } catch (err) {
                console.error('Microsoft OAuth failed:', err);
                setExportError('Microsoft authentication failed');
                return;
            }
        }

        setPending('onedrive');
        try {
            const result = await exportOneDrive.mutateAsync(invoiceId);
            if (result.webUrl) {
                window.open(result.webUrl, '_blank', 'noopener,noreferrer');
            }
        } catch (err) {
            console.error('OneDrive export failed:', err);
            setExportError('OneDrive export failed');
        } finally {
            setPending(null);
        }
    }, [invoiceId, microsoftConnected, getMicrosoftAuthUrl, openPopup, exportOneDrive, queryClient]);

    const handleGoogleDrive = useCallback(async () => {
        setExportError(null);
        if (!googleConnected) {
            try {
                const { url } = await getGoogleAuthUrl.mutateAsync();
                await openPopup(url, { name: 'google-oauth' });
                queryClient.invalidateQueries({ queryKey: ['cloud-connection-status'] });
            } catch (err) {
                console.error('Google OAuth failed:', err);
                setExportError('Google authentication failed');
                return;
            }
        }

        setPending('google-drive');
        try {
            const result = await exportGoogleDrive.mutateAsync(invoiceId);
            if (result.webViewLink) {
                window.open(result.webViewLink, '_blank', 'noopener,noreferrer');
            }
        } catch (err) {
            console.error('Google Drive export failed:', err);
            setExportError('Google Drive export failed');
        } finally {
            setPending(null);
        }
    }, [invoiceId, googleConnected, getGoogleAuthUrl, openPopup, exportGoogleDrive, queryClient]);

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
                                ? <span className="text-xs text-[var(--ws-text-disabled)]">Not connected</span>
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
                                ? <span className="text-xs text-[var(--ws-text-disabled)]">Not connected</span>
                                : undefined
                    }
                    onClick={handleGoogleDrive}
                    disabled={isExporting}
                >
                    Google Drive
                </Menu.Item>
                {exportError && (
                    <div className="px-3 py-1.5 text-xs text-[var(--ws-color-error)]">{exportError}</div>
                )}
            </Menu.Dropdown>
        </Menu>
    );
}

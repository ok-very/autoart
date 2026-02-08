import { ArrowLeft, Printer, Loader2 } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { generateInvoicePdfHtml, type PdfPagePreset } from '@autoart/shared';
import { Button } from '@autoart/ui';

import { useInvoicePreview } from '../../api/hooks/exports';

interface InvoicePreviewViewProps {
    invoiceId: string;
    onClose: () => void;
}

const PAGE_PRESETS: { value: PdfPagePreset; label: string }[] = [
    { value: 'letter', label: 'Letter' },
    { value: 'a4', label: 'A4' },
    { value: 'legal', label: 'Legal' },
];

export function InvoicePreviewView({ invoiceId, onClose }: InvoicePreviewViewProps) {
    const { data: model, isLoading } = useInvoicePreview(invoiceId);
    const [pagePreset, setPagePreset] = useState<PdfPagePreset>('letter');
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const html = useMemo(() => {
        if (!model) return '';
        return generateInvoicePdfHtml(model, {
            pagePreset,
            autoHelperBaseUrl: '',
        });
    }, [model, pagePreset]);

    const handlePrint = useCallback(() => {
        iframeRef.current?.contentWindow?.print();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full text-sm text-slate-400">
                <Loader2 size={16} className="animate-spin mr-2" />
                Loading preview...
            </div>
        );
    }

    if (!model) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-2">
                <p className="text-sm text-slate-400">Invoice not found</p>
                <Button variant="ghost" size="sm" onClick={onClose}>Back</Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <header className="shrink-0 px-4 py-2 border-b border-slate-200 bg-white flex items-center gap-3">
                <button
                    onClick={onClose}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                >
                    <ArrowLeft size={16} />
                </button>
                <span className="text-sm font-medium text-slate-600">Preview</span>
                <div className="flex-1" />
                <select
                    value={pagePreset}
                    onChange={(e) => setPagePreset(e.target.value as PdfPagePreset)}
                    className="text-xs border border-slate-200 rounded px-2 py-1 text-slate-600 bg-white"
                >
                    {PAGE_PRESETS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                </select>
                <Button variant="primary" size="sm" leftSection={<Printer size={14} />} onClick={handlePrint}>
                    Print
                </Button>
            </header>

            {/* Preview iframe */}
            <div className="flex-1 overflow-auto bg-slate-100 p-4">
                <iframe
                    ref={iframeRef}
                    srcDoc={html}
                    sandbox="allow-same-origin"
                    className="mx-auto bg-white shadow-sm border border-slate-200"
                    style={{ width: '100%', maxWidth: '850px', height: '100%', minHeight: '1100px' }}
                    title="Invoice Preview"
                />
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2 } from 'lucide-react';

import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

interface PdfPreviewProps {
    url: string;
}

export function PdfPreview({ url }: PdfPreviewProps) {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setNumPages(null);
        setError(null);
        setLoading(true);
    }, [url]);

    return (
        <div
            className="w-full max-w-3xl mx-auto border rounded overflow-auto"
            style={{
                height: '70vh',
                borderColor: 'var(--ws-text-disabled, #D6D2CB)',
                background: 'var(--ws-bg, #F5F2ED)',
            }}
        >
            {loading && !error && (
                <div className="flex items-center justify-center h-full">
                    <Loader2
                        size={24}
                        className="animate-spin"
                        style={{ color: 'var(--ws-text-disabled, #8C8C88)' }}
                    />
                </div>
            )}

            {error && (
                <div className="flex items-center justify-center h-full">
                    <p className="text-sm" style={{ color: 'var(--ws-color-error, #8C4A4A)' }}>
                        Failed to load PDF
                    </p>
                </div>
            )}

            <Document
                file={url}
                onLoadSuccess={({ numPages: n }) => {
                    setNumPages(n);
                    setLoading(false);
                }}
                onLoadError={() => {
                    setError('Failed to load PDF');
                    setLoading(false);
                }}
                loading={null}
                error={null}
            >
                {numPages &&
                    Array.from({ length: numPages }, (_, i) => (
                        <Page
                            key={i}
                            pageNumber={i + 1}
                            width={760}
                            className="mx-auto"
                        />
                    ))}
            </Document>
        </div>
    );
}

export default PdfPreview;

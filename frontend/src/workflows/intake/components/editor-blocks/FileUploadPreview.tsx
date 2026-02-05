import { Upload } from 'lucide-react';
import type { EditorBlockProps } from './EditorBlockRenderer';

export function FileUploadPreview({ block: _block, isActive }: EditorBlockProps) {
    if (!isActive) {
        return (
            <div className="flex items-center gap-2 text-ws-muted">
                <Upload className="w-4 h-4 opacity-40" />
                <span className="text-sm">File upload</span>
            </div>
        );
    }

    return (
        <div className="border-2 border-dashed border-ws-panel-border rounded-lg px-6 py-8 flex flex-col items-center gap-2 text-ws-muted">
            <Upload className="w-6 h-6 opacity-40" />
            <span className="text-sm">Drop files here or click to upload</span>
            <div className="flex gap-1 mt-1">
                {['PDF', 'PNG', 'JPG'].map((ext) => (
                    <span
                        key={ext}
                        className="px-1.5 py-0.5 text-[10px] font-medium bg-ws-bg border border-ws-panel-border rounded"
                    >
                        {ext}
                    </span>
                ))}
            </div>
        </div>
    );
}

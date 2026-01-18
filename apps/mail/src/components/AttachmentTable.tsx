// AttachmentTable component - displays email attachments with checkboxes for OneDrive push
// Registry: Atom - reusable table for attachment display

import { Paperclip, FileText, Image, File, ExternalLink } from 'lucide-react';
import type { Attachment } from '../lib/types';

interface AttachmentTableProps {
    attachments: Attachment[];
    selectedIds: Set<string>;
    onSelectionChange: (selectedIds: Set<string>) => void;
}

// Format file size to human readable
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Get icon based on content type
function getFileIcon(contentType: string) {
    if (contentType.startsWith('image/')) return Image;
    if (contentType.includes('pdf') || contentType.includes('document')) return FileText;
    return File;
}

// Get short type label
function getTypeLabel(contentType: string): string {
    const typeMap: Record<string, string> = {
        'application/pdf': 'PDF',
        'image/jpeg': 'JPEG',
        'image/png': 'PNG',
        'image/heic': 'HEIC',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
        'text/csv': 'CSV',
        'text/plain': 'TXT',
    };
    return typeMap[contentType] || contentType.split('/').pop()?.toUpperCase() || 'FILE';
}

export function AttachmentTable({ attachments, selectedIds, onSelectionChange }: AttachmentTableProps) {
    const allSelected = attachments.length > 0 && attachments.every(a => selectedIds.has(a.id));
    const someSelected = attachments.some(a => selectedIds.has(a.id));

    const toggleAll = () => {
        if (allSelected) {
            onSelectionChange(new Set());
        } else {
            onSelectionChange(new Set(attachments.map(a => a.id)));
        }
    };

    const toggleOne = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        onSelectionChange(next);
    };

    if (attachments.length === 0) {
        return null;
    }

    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                <Paperclip size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                    Attachments ({attachments.length})
                </span>
            </div>
            <table className="w-full text-sm">
                <thead className="bg-slate-50/50 text-xs text-slate-500 uppercase">
                    <tr>
                        <th className="w-10 px-3 py-2 text-left">
                            <input
                                type="checkbox"
                                checked={allSelected}
                                ref={input => {
                                    if (input) input.indeterminate = someSelected && !allSelected;
                                }}
                                onChange={toggleAll}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                        </th>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="w-20 px-3 py-2 text-left">Type</th>
                        <th className="w-24 px-3 py-2 text-right">Size</th>
                        <th className="w-10"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {attachments.map(attachment => {
                        const Icon = getFileIcon(attachment.contentType);
                        const isSelected = selectedIds.has(attachment.id);

                        return (
                            <tr
                                key={attachment.id}
                                className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/30' : ''}`}
                            >
                                <td className="px-3 py-2">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleOne(attachment.id)}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <Icon size={14} className="text-slate-400 flex-shrink-0" />
                                        <span className="font-medium text-slate-700 truncate max-w-[200px]" title={attachment.filename}>
                                            {attachment.filename}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-3 py-2">
                                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                        {getTypeLabel(attachment.contentType)}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-right text-slate-500">
                                    {formatFileSize(attachment.size)}
                                </td>
                                <td className="px-3 py-2">
                                    {attachment.localPath && (
                                        <a
                                            href={`file:///${attachment.localPath.replace(/\\/g, '/')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-500 hover:text-blue-700"
                                            title="Open file"
                                        >
                                            <ExternalLink size={14} />
                                        </a>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

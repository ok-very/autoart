import { clsx } from 'clsx';

import { UserChip } from './UserChip';
import { type TaskStatus, TASK_STATUS_CONFIG } from '../../utils/nodeMetadata';

export type DataFieldKind = 'text' | 'status' | 'user' | 'date' | 'percent' | 'tags' | 'description';

export interface DataFieldWidgetProps {
    kind: DataFieldKind;
    value: unknown;
    className?: string;
}

function formatText(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return '';
}

function StatusPill({ status }: { status: TaskStatus }) {
    const cfg = TASK_STATUS_CONFIG[status];
    if (!cfg) {
        // Fallback for unknown status values
        return (
            <div className="w-full h-7 rounded flex items-center justify-center text-[11px] font-semibold bg-slate-200 text-slate-600">
                {status}
            </div>
        );
    }
    return (
        <div
            className={clsx(
                'w-full h-7 rounded flex items-center justify-center text-[11px] font-semibold',
                cfg.colorClass
            )}
        >
            {cfg.label}
        </div>
    );
}

function PercentBar({ percent }: { percent: number }) {
    const p = Math.max(0, Math.min(100, percent));
    return (
        <div className="w-full flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${p}%` }} />
            </div>
            <div className="w-10 text-right text-[11px] text-slate-600 tabular-nums">{Math.round(p)}%</div>
        </div>
    );
}

export function DataFieldWidget({ kind, value, className }: DataFieldWidgetProps) {
    if (kind === 'status') {
        const v = value as TaskStatus | undefined;
        if (!v) return <div className={clsx('w-full h-7 rounded bg-slate-100', className)} />;
        return (
            <div className={className}>
                <StatusPill status={v} />
            </div>
        );
    }

    if (kind === 'percent') {
        const n = typeof value === 'number' ? value : null;
        if (n == null || Number.isNaN(n)) {
            return <div className={clsx('text-xs text-slate-400', className)} />;
        }
        return (
            <div className={className}>
                <PercentBar percent={n} />
            </div>
        );
    }

    if (kind === 'user') {
        return (
            <div className={className}>
                <UserChip value={value} compact />
            </div>
        );
    }

    if (kind === 'date') {
        const t = formatText(value);
        return <div className={clsx('text-xs text-slate-600 text-center', className)}>{t}</div>;
    }

    if (kind === 'tags') {
        const tags = Array.isArray(value) ? value : [];
        if (tags.length === 0) return <div className={clsx('text-xs text-slate-400', className)} />;
        return (
            <div className={clsx('flex flex-wrap gap-1', className)}>
                {tags.map((tag, i) => (
                    <span
                        key={i}
                        className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium"
                    >
                        {String(tag)}
                    </span>
                ))}
            </div>
        );
    }

    if (kind === 'description') {
        // Simplified description rendering - just extract text from TipTap JSON or show string
        let text = '';
        if (typeof value === 'string') {
            text = value;
        } else if (value && typeof value === 'object') {
            // TipTap JSON document - extract text from content
            const doc = value as { content?: Array<{ content?: Array<{ text?: string }> }> };
            text = doc.content
                ?.flatMap((node) => node.content?.map((c) => c.text || '') || [])
                .join(' ')
                .trim() || '';
        }
        if (!text) return <div className={clsx('text-xs text-slate-400 italic', className)} />;
        return (
            <div className={clsx('text-xs text-slate-600 line-clamp-2', className)}>
                {text}
            </div>
        );
    }

    // text (default)
    const t = formatText(value);
    return <div className={clsx('text-xs text-slate-700', className)}>{t}</div>;
}

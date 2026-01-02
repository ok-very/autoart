import { clsx } from 'clsx';
import { UserChip } from '../atoms/UserChip';

/**
 * Field display kinds supported by the widget
 */
export type DataFieldKind = 'text' | 'status' | 'user' | 'date' | 'percent' | 'tags' | 'description';

/**
 * Status display config - passed in, not computed here
 */
export interface StatusDisplayConfig {
    label: string;
    colorClass: string;
}

export interface DataFieldWidgetProps {
    /** Type of field to render */
    kind: DataFieldKind;
    /** Value to display */
    value: unknown;
    /** Additional className */
    className?: string;
    /** Status config for status kind (required if kind='status') */
    statusConfig?: StatusDisplayConfig | null;
}

function formatText(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return '';
}

function StatusPill({ label, colorClass }: { label: string; colorClass: string }) {
    return (
        <div
            className={clsx(
                'w-full h-7 rounded flex items-center justify-center text-[11px] font-semibold',
                colorClass
            )}
        >
            {label}
        </div>
    );
}

function FallbackStatusPill({ status }: { status: string }) {
    return (
        <div className="w-full h-7 rounded flex items-center justify-center text-[11px] font-semibold bg-slate-200 text-slate-600">
            {status}
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

/**
 * DataFieldWidget - Molecule for rendering field values
 * 
 * Receives all display data via props. Does not access domain or APIs.
 * For status fields, statusConfig must be provided by the parent.
 */
export function DataFieldWidget({ kind, value, className, statusConfig }: DataFieldWidgetProps) {
    if (kind === 'status') {
        const v = value as string | undefined;
        if (!v) return <div className={clsx('w-full h-7 rounded bg-slate-100', className)} />;

        if (statusConfig) {
            return (
                <div className={className}>
                    <StatusPill label={statusConfig.label} colorClass={statusConfig.colorClass} />
                </div>
            );
        }

        // Fallback when no config provided
        return (
            <div className={className}>
                <FallbackStatusPill status={v} />
            </div>
        );
    }

    if (kind === 'percent') {
        const n = typeof value === 'number' ? value : null;
        if (n == null || Number.isNaN(n)) {
            return <div className={clsx('text-xs text-slate-400', className)}>-</div>;
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
        return <div className={clsx('text-xs text-slate-600 text-center', className)}>{t || '-'}</div>;
    }

    if (kind === 'tags') {
        const tags = Array.isArray(value) ? value : [];
        if (tags.length === 0) return <div className={clsx('text-xs text-slate-400', className)}>-</div>;
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
        // Simplified description rendering - extract text from TipTap JSON or show string
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
        if (!text) return <div className={clsx('text-xs text-slate-400 italic', className)}>No description</div>;
        return (
            <div className={clsx('text-xs text-slate-600 line-clamp-2', className)}>
                {text}
            </div>
        );
    }

    // text (default)
    const t = formatText(value);
    return <div className={clsx('text-xs text-slate-700', className)}>{t || '-'}</div>;
}

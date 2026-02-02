import { clsx } from 'clsx';
import { ExternalLink, Mail, Check, X } from 'lucide-react';

import { UserChip } from '@autoart/ui';

/**
 * Field display kinds supported by the widget
 * Matches FieldType schema plus special UI types
 */
export type DataFieldKind =
    | 'text'
    | 'number'
    | 'email'
    | 'url'
    | 'textarea'
    | 'select'
    | 'date'
    | 'checkbox'
    | 'link'
    | 'status'
    | 'percent'
    | 'user'
    | 'tags'
    | 'description';

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
    /**
     * Enable text wrapping instead of truncation.
     * When true, text wraps and expands cell height.
     * Default: false (truncate with ellipsis)
     */
    wrapText?: boolean;
}

function formatText(value: unknown): string {
    if (value === undefined || value === null || value === '') return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return new Intl.NumberFormat('en-US').format(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
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
        <div className="w-full h-7 rounded flex items-center justify-center text-[11px] font-semibold bg-slate-200 text-ws-text-secondary">
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
            <div className="w-10 text-right text-[11px] text-ws-text-secondary tabular-nums">{Math.round(p)}%</div>
        </div>
    );
}

/**
 * DataFieldWidget - Molecule for rendering field values
 * 
 * Receives all display data via props. Does not access domain or APIs.
 * For status fields, statusConfig must be provided by the parent.
 */
export function DataFieldWidget({ kind, value, className, statusConfig, wrapText = false }: DataFieldWidgetProps) {
    // Null/Empty handling (except for certain types that handle empty)
    if (value === undefined || value === null) {
        if (kind === 'checkbox') {
            // Treat null boolean as false or just render dash? Default to false behavior for checkbox usually better visually
            // but let's stick to explicit false so we don't infer too much.
            // Actually, a dash for null is safer for data integrity view.
            return <div className={clsx('text-xs text-ws-muted text-center', className)}>-</div>;
        }
        return <div className={clsx('text-xs text-ws-muted', className)} />;
    }

    if (kind === 'status') {
        const v = value as string;
        if (!v) return <div className={clsx('w-full h-7 rounded bg-slate-100', className)} />;

        if (statusConfig) {
            return (
                <div className={className}>
                    <StatusPill label={statusConfig.label} colorClass={statusConfig.colorClass} />
                </div>
            );
        }

        return (
            <div className={className}>
                <FallbackStatusPill status={v} />
            </div>
        );
    }

    if (kind === 'percent') {
        const n = typeof value === 'number' ? value : Number(value);
        if (Number.isNaN(n)) {
            return <div className={clsx('text-xs text-ws-muted', className)}>-</div>;
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
        let dateStr = '';
        if (typeof value === 'string') dateStr = new Date(value).toLocaleDateString();
        else if (value instanceof Date) dateStr = value.toLocaleDateString();

        if (!dateStr || dateStr === 'Invalid Date') return <div className={clsx('text-xs text-ws-muted', className)}>-</div>;

        return <div className={clsx('text-xs text-ws-text-secondary text-center', className)}>{dateStr}</div>;
    }

    if (kind === 'url') {
        const url = String(value);
        if (!url) return null;
        return (
            <div className={clsx('flex items-center gap-1.5', className)}>
                <ExternalLink size={12} className="text-blue-500 shrink-0" />
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={clsx(
                        'text-xs text-blue-600 hover:underline',
                        wrapText ? 'break-all' : 'truncate'
                    )}
                >
                    {url}
                </a>
            </div>
        );
    }

    if (kind === 'email') {
        const email = String(value);
        if (!email) return null;
        return (
            <div className={clsx('flex items-center gap-1.5', className)}>
                <Mail size={12} className="text-ws-muted shrink-0" />
                <a
                    href={`mailto:${email}`}
                    onClick={(e) => e.stopPropagation()}
                    className={clsx(
                        'text-xs text-ws-text-secondary hover:text-blue-600 hover:underline',
                        wrapText ? 'break-all' : 'truncate'
                    )}
                >
                    {email}
                </a>
            </div>
        );
    }

    if (kind === 'checkbox') {
        const isChecked = Boolean(value);
        return (
            <div className={clsx('flex justify-center', className)}>
                {isChecked ? (
                    <div className="w-5 h-5 bg-blue-100 rounded-md flex items-center justify-center text-blue-600">
                        <Check size={14} strokeWidth={3} />
                    </div>
                ) : (
                    <div className="w-5 h-5 bg-slate-100 rounded-md flex items-center justify-center text-ws-muted">
                        <X size={14} strokeWidth={3} />
                    </div>
                )}
            </div>
        );
    }

    if (kind === 'tags') {
        const tags = Array.isArray(value) ? value : [];
        if (tags.length === 0) return <div className={clsx('text-xs text-ws-muted', className)} />;
        return (
            <div className={clsx(
                'flex gap-1',
                wrapText ? 'flex-wrap' : 'flex-nowrap overflow-hidden',
                className
            )}>
                {tags.map((tag, i) => (
                    <span
                        key={i}
                        className="px-1.5 py-0.5 bg-slate-100 text-ws-text-secondary rounded text-[10px] font-medium border border-ws-panel-border shrink-0"
                    >
                        {String(tag)}
                    </span>
                ))}
            </div>
        );
    }

    if (kind === 'textarea' || kind === 'description') {
        // Handle potentially rich text or long text
        let text = '';
        if (typeof value === 'string') {
            text = value;
        } else if (value && typeof value === 'object') {
            // TipTap JSON extraction attempt
            try {
                const doc = value as { content?: Array<{ content?: Array<{ text?: string }> }> };
                text = doc.content
                    ?.flatMap((node) => node.content?.map((c) => c.text || '') || [])
                    .join(' ')
                    .trim() || '';
            } catch {
                text = JSON.stringify(value);
            }
        }

        if (!text) return <div className={clsx('text-xs text-ws-muted', className)} />;

        return (
            <div
                className={clsx(
                    'text-xs text-ws-text-secondary leading-relaxed',
                    wrapText ? 'whitespace-pre-wrap' : 'line-clamp-2',
                    className
                )}
                title={!wrapText ? text : undefined}
            >
                {text}
            </div>
        );
    }

    // text, number, select, link (fallback)
    const t = formatText(value);
    return (
        <div
            className={clsx(
                'text-xs text-ws-text-secondary',
                wrapText ? 'whitespace-normal break-words' : 'truncate',
                className
            )}
            title={!wrapText ? t : undefined}
        >
            {t}
        </div>
    );
}

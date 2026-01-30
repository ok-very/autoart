/**
 * FieldRenderer - Molecule for rendering editable fields
 *
 * Aligned with autoart's FieldRenderer pattern.
 * Accepts a FieldViewModel and renders the appropriate input.
 * Dispatch priority: renderHint → type → fallback
 *
 * This is a pure molecule - no API calls, no domain logic.
 */

import { clsx } from 'clsx';
import type { FieldViewModel } from '../lib';

/**
 * Priority color configuration
 */
const PRIORITY_COLORS: Record<number, { bg: string; text: string; label: string }> = {
    1: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Low' },
    2: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Normal' },
    3: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Medium' },
    4: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'High' },
    5: { bg: 'bg-red-100', text: 'text-red-700', label: 'Urgent' },
};

/**
 * Triage bucket color configuration
 */
const BUCKET_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    ACTION_REQUIRED: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    AWAITING_REPLY: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    APPROVAL_NEEDED: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    MEETING_SCHEDULE: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    TASK_ASSIGNMENT: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
    INVOICE: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    FYI_ONLY: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
};

/**
 * Phase color configuration
 */
const PHASE_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
    pre_reply: { bg: 'bg-amber-100', text: 'text-amber-800', icon: '→' },
    post_reply: { bg: 'bg-emerald-100', text: 'text-emerald-800', icon: '←' },
};

export interface FieldRendererProps {
    /** The field view model - contains all display state */
    viewModel: FieldViewModel;
    /** Callback when value changes */
    onChange: (value: unknown) => void;
    /** Additional className */
    className?: string;
}

/**
 * FieldRenderer component
 */
export function FieldRenderer({
    viewModel,
    onChange,
    className,
}: FieldRendererProps) {
    const { type, value, editable, options, renderHint, placeholder } = viewModel;
    const readOnly = !editable;

    // ========== RENDER HINT DISPATCH ==========
    // Semantic hints override base type for specialized rendering

    // Priority hint - colored priority selector
    if (renderHint === 'priority') {
        const priorityValue = typeof value === 'number' ? value : 3;
        const config = PRIORITY_COLORS[priorityValue] || PRIORITY_COLORS[3];

        if (readOnly) {
            return (
                <span className={clsx(
                    'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                    config.bg, config.text,
                    className
                )}>
                    <span className="font-bold">{priorityValue}</span>
                    {config.label}
                </span>
            );
        }

        return (
            <div className={clsx('flex gap-1', className)}>
                {[1, 2, 3, 4, 5].map((p) => {
                    const pConfig = PRIORITY_COLORS[p];
                    return (
                        <button
                            key={p}
                            onClick={() => onChange(p)}
                            className={clsx(
                                'w-8 h-8 rounded-full text-xs font-bold transition-all',
                                priorityValue === p
                                    ? `${pConfig.bg} ${pConfig.text} ring-2 ring-offset-1 ring-current`
                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            )}
                        >
                            {p}
                        </button>
                    );
                })}
            </div>
        );
    }

    // Bucket hint - triage bucket display/selector
    if (renderHint === 'bucket') {
        const bucketValue = String(value || 'FYI_ONLY');
        const config = BUCKET_COLORS[bucketValue] || BUCKET_COLORS.FYI_ONLY;

        if (readOnly) {
            return (
                <span className={clsx(
                    'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border',
                    config.bg, config.text, config.border,
                    className
                )}>
                    {bucketValue.replace(/_/g, ' ')}
                </span>
            );
        }

        return (
            <select
                value={bucketValue}
                onChange={(e) => onChange(e.target.value)}
                className={clsx(
                    'text-sm border rounded-md px-3 py-2 transition-colors',
                    config.bg, config.text, config.border,
                    className
                )}
            >
                {Object.keys(BUCKET_COLORS).map((bucket) => (
                    <option key={bucket} value={bucket}>
                        {bucket.replace(/_/g, ' ')}
                    </option>
                ))}
            </select>
        );
    }

    // Phase hint - pre/post reply indicator
    if (renderHint === 'phase') {
        const phaseValue = String(value || 'pre_reply');
        const config = PHASE_COLORS[phaseValue] || PHASE_COLORS.pre_reply;

        return (
            <span className={clsx(
                'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
                config.bg, config.text,
                className
            )}>
                <span>{config.icon}</span>
                {phaseValue === 'pre_reply' ? 'Before Reply' : 'After Reply'}
            </span>
        );
    }

    // Email hint - native email input with validation
    if (renderHint === 'email') {
        return (
            <input
                type="email"
                value={String(value || '')}
                onChange={(e) => onChange(e.target.value)}
                readOnly={readOnly}
                placeholder={placeholder}
                className={clsx(
                    'w-full text-sm border rounded-md shadow-sm px-3 py-2 transition-colors',
                    readOnly
                        ? 'border-slate-300 bg-slate-50 cursor-default'
                        : 'border-slate-300 bg-white hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                    className
                )}
            />
        );
    }

    // Phone hint - tel input for mobile keyboards
    if (renderHint === 'phone') {
        return (
            <input
                type="tel"
                value={String(value || '')}
                onChange={(e) => onChange(e.target.value)}
                readOnly={readOnly}
                placeholder={placeholder}
                className={clsx(
                    'w-full text-sm border rounded-md shadow-sm px-3 py-2 transition-colors',
                    readOnly
                        ? 'border-slate-300 bg-slate-50 cursor-default'
                        : 'border-slate-300 bg-white hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                    className
                )}
            />
        );
    }

    // Date hint - native date picker
    if (renderHint === 'date') {
        return (
            <input
                type="date"
                value={String(value || '')}
                onChange={(e) => onChange(e.target.value)}
                readOnly={readOnly}
                className={clsx(
                    'w-full text-sm border rounded-md shadow-sm px-3 py-2 transition-colors',
                    readOnly
                        ? 'border-slate-300 bg-slate-50 cursor-default'
                        : 'border-slate-300 bg-white hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                    className
                )}
            />
        );
    }

    // URL hint - with link preview
    if (renderHint === 'url') {
        const urlValue = String(value || '');
        return (
            <div className={clsx('flex items-center gap-2', className)}>
                <input
                    type="url"
                    value={urlValue}
                    onChange={(e) => onChange(e.target.value)}
                    readOnly={readOnly}
                    placeholder={placeholder || 'https://...'}
                    className={clsx(
                        'flex-1 text-sm border rounded-md shadow-sm px-3 py-2 transition-colors',
                        readOnly
                            ? 'border-slate-300 bg-slate-50 cursor-default'
                            : 'border-slate-300 bg-white hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    )}
                />
                {urlValue && (
                    <a
                        href={urlValue}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>
                )}
            </div>
        );
    }

    // ========== TYPE-BASED DISPATCH ==========

    // Select dropdown
    if (type === 'select' && options) {
        return (
            <select
                value={String(value || '')}
                onChange={(e) => onChange(e.target.value)}
                disabled={readOnly}
                className={clsx(
                    'w-full text-sm border rounded-md shadow-sm px-3 py-2 transition-colors appearance-none bg-white',
                    readOnly
                        ? 'border-slate-300 cursor-default'
                        : 'border-slate-300 hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                    className
                )}
            >
                <option value="">Select...</option>
                {options.map((opt) => (
                    <option key={String(opt)} value={String(opt)}>
                        {String(opt)}
                    </option>
                ))}
            </select>
        );
    }

    // Checkbox
    if (type === 'checkbox') {
        const isChecked = value === true || String(value) === 'true';
        return (
            <label className={clsx('flex items-center cursor-pointer', className)}>
                <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => onChange(e.target.checked)}
                    disabled={readOnly}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-colors"
                />
                <span className="ml-2 text-sm text-slate-600 select-none">
                    {isChecked ? 'Yes' : 'No'}
                </span>
            </label>
        );
    }

    // Textarea
    if (type === 'textarea') {
        return (
            <textarea
                value={String(value || '')}
                onChange={(e) => onChange(e.target.value)}
                readOnly={readOnly}
                rows={4}
                placeholder={placeholder}
                className={clsx(
                    'w-full text-sm border rounded-md shadow-sm px-3 py-2 transition-colors resize-y',
                    readOnly
                        ? 'border-slate-300 bg-slate-50 cursor-default'
                        : 'border-slate-300 bg-white hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                    className
                )}
            />
        );
    }

    // Number
    if (type === 'number') {
        return (
            <input
                type="number"
                value={value !== null && value !== undefined ? String(value) : ''}
                onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null)}
                readOnly={readOnly}
                placeholder={placeholder}
                className={clsx(
                    'w-full text-sm border rounded-md shadow-sm px-3 py-2 transition-colors',
                    readOnly
                        ? 'border-slate-300 bg-slate-50 cursor-default'
                        : 'border-slate-300 bg-white hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                    className
                )}
            />
        );
    }

    // Date
    if (type === 'date') {
        return (
            <input
                type="date"
                value={String(value || '')}
                onChange={(e) => onChange(e.target.value)}
                readOnly={readOnly}
                className={clsx(
                    'w-full text-sm border rounded-md shadow-sm px-3 py-2 transition-colors',
                    readOnly
                        ? 'border-slate-300 bg-slate-50 cursor-default'
                        : 'border-slate-300 bg-white hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                    className
                )}
            />
        );
    }

    // Default: text input
    return (
        <input
            type="text"
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            readOnly={readOnly}
            placeholder={placeholder}
            className={clsx(
                'w-full text-sm border rounded-md shadow-sm px-3 py-2 transition-colors',
                readOnly
                    ? 'border-slate-300 bg-slate-50 cursor-default'
                    : 'border-slate-300 bg-white hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                className
            )}
        />
    );
}

/**
 * Compact read-only field display
 */
export function FieldDisplay({
    viewModel,
    className,
}: {
    viewModel: FieldViewModel;
    className?: string;
}) {
    const { value, renderHint } = viewModel;

    // Use FieldRenderer in read-only mode for semantic hints
    if (renderHint === 'priority' || renderHint === 'bucket' || renderHint === 'phase') {
        return (
            <FieldRenderer
                viewModel={{ ...viewModel, editable: false }}
                onChange={() => { }}
                className={className}
            />
        );
    }

    // Simple text display for other types
    return (
        <span className={clsx('text-sm text-slate-700', className)}>
            {value !== null && value !== undefined ? String(value) : '-'}
        </span>
    );
}

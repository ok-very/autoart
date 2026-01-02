import { clsx } from 'clsx';
import type { FieldViewModel } from '@autoart/shared/domain';
import { TagsInput } from './TagsInput';

/**
 * Status configuration for rendering status fields
 */
export interface StatusConfig {
    [status: string]: {
        label: string;
        colorClass: string;
    };
}

/**
 * Props for specialized field renderers that need extra context
 */
export interface FieldRendererCallbacks {
    /** Render a link field (composite-provided) */
    renderLinkField?: (vm: FieldViewModel, onChange: (value: unknown) => void) => React.ReactNode;
    /** Render a user field (composite-provided) */
    renderUserField?: (vm: FieldViewModel, onChange: (value: unknown) => void) => React.ReactNode;
    /** Render a rich text field (composite-provided) */
    renderRichText?: (vm: FieldViewModel, onChange: (value: unknown) => void, multiline: boolean) => React.ReactNode;
}

export interface FieldRendererProps {
    /** The field view model - contains all display state */
    viewModel: FieldViewModel;
    /** Callback when value changes */
    onChange: (value: unknown) => void;
    /** Status display configuration */
    statusConfig?: StatusConfig;
    /** Callbacks for rendering complex fields that need API access */
    callbacks?: FieldRendererCallbacks;
    /** Additional className */
    className?: string;
}

/**
 * FieldRenderer - Molecule for rendering editable fields
 * 
 * Accepts a FieldViewModel and renders the appropriate input.
 * Complex field types (link, user, richtext) are delegated to
 * callbacks provided by the composite.
 * 
 * This is a pure molecule - no API calls, no domain logic.
 */
export function FieldRenderer({
    viewModel,
    onChange,
    statusConfig,
    callbacks,
    className,
}: FieldRendererProps) {
    const { type, value, editable, options } = viewModel;
    const readOnly = !editable;

    // Link field - delegate to composite
    if (type === 'link') {
        if (callbacks?.renderLinkField) {
            return <>{callbacks.renderLinkField(viewModel, onChange)}</>;
        }
        // Fallback: show as text
        return (
            <div className={clsx('text-sm text-slate-500 italic', className)}>
                {String(value || 'No link')}
            </div>
        );
    }

    // User field - delegate to composite
    if (type === 'user') {
        if (callbacks?.renderUserField) {
            return <>{callbacks.renderUserField(viewModel, onChange)}</>;
        }
        // Fallback: show as text
        const userName = typeof value === 'object' && value !== null
            ? (value as { name?: string }).name
            : String(value || '');
        return (
            <div className={clsx('text-sm text-slate-600', className)}>
                {userName || '-'}
            </div>
        );
    }

    // Tags field
    if (type === 'tags') {
        return (
            <TagsInput
                value={value}
                onChange={onChange}
                readOnly={readOnly}
            />
        );
    }

    // Textarea - rich text
    if (type === 'textarea') {
        if (callbacks?.renderRichText) {
            return <>{callbacks.renderRichText(viewModel, onChange, true)}</>;
        }
        return (
            <textarea
                value={String(value || '')}
                onChange={(e) => onChange(e.target.value)}
                readOnly={readOnly}
                rows={4}
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

    // Select dropdown
    if (type === 'select' && options) {
        return (
            <div className={clsx('relative', className)}>
                <select
                    value={String(value || '')}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={readOnly}
                    className={clsx(
                        'w-full text-sm border rounded-md shadow-sm px-3 py-2 transition-colors appearance-none bg-white',
                        readOnly
                            ? 'border-slate-300 cursor-default'
                            : 'border-slate-300 hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    )}
                >
                    <option value="">Select...</option>
                    {options.map((opt) => (
                        <option key={opt} value={opt}>
                            {opt}
                        </option>
                    ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-500">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                        <path
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clipRule="evenodd"
                            fillRule="evenodd"
                        />
                    </svg>
                </div>
            </div>
        );
    }

    // Checkbox
    if (type === 'checkbox') {
        const isChecked = value === true || String(value) === 'true';
        return (
            <div className={clsx('flex items-center h-9', className)}>
                <label className="flex items-center cursor-pointer">
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
            </div>
        );
    }

    // Status field - colored pill buttons
    if (type === 'status' && statusConfig && options) {
        const currentStatus = String(value || '');
        return (
            <div className={clsx('flex gap-1 flex-wrap', className)}>
                {options.map((status) => {
                    const cfg = statusConfig[status];
                    const isSelected = status === currentStatus;
                    return (
                        <button
                            key={status}
                            type="button"
                            onClick={() => !readOnly && onChange(status)}
                            disabled={readOnly}
                            className={clsx(
                                'px-2 h-7 rounded text-xs font-semibold transition-all',
                                isSelected && cfg ? cfg.colorClass : 'bg-slate-100 text-slate-400 hover:bg-slate-200',
                                readOnly && 'cursor-default'
                            )}
                        >
                            {cfg?.label || status}
                        </button>
                    );
                })}
            </div>
        );
    }

    // Percent field - slider with visual bar
    if (type === 'percent') {
        const percent = typeof value === 'number' ? value : parseInt(String(value || '0'), 10) || 0;
        const clampedPercent = Math.max(0, Math.min(100, percent));
        return (
            <div className={clsx('space-y-2', className)}>
                <div className="flex items-center gap-3">
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={clampedPercent}
                        onChange={(e) => onChange(parseInt(e.target.value, 10))}
                        disabled={readOnly}
                        className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <span className="w-12 text-right text-sm font-medium text-slate-700 tabular-nums">
                        {clampedPercent}%
                    </span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${clampedPercent}%` }}
                    />
                </div>
            </div>
        );
    }

    // Date picker
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
                        ? 'border-slate-300 bg-white cursor-default'
                        : 'border-slate-300 bg-white hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                    className
                )}
            />
        );
    }

    // Text field - can use rich text if callback provided
    if (type === 'text') {
        if (callbacks?.renderRichText) {
            return <>{callbacks.renderRichText(viewModel, onChange, false)}</>;
        }
        return (
            <input
                type="text"
                value={String(value || '')}
                onChange={(e) => onChange(e.target.value)}
                readOnly={readOnly}
                placeholder={viewModel.placeholder}
                className={clsx(
                    'w-full text-sm border rounded-md shadow-sm px-3 py-2 transition-colors',
                    readOnly
                        ? 'border-slate-300 bg-white cursor-default'
                        : 'border-slate-300 bg-white hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                    className
                )}
            />
        );
    }

    // Standard HTML input for number, email, url types
    const inputType = type === 'number' ? 'number' : type === 'email' ? 'email' : type === 'url' ? 'url' : 'text';

    return (
        <input
            type={inputType}
            value={String(value || '')}
            onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
            readOnly={readOnly}
            placeholder={viewModel.placeholder}
            className={clsx(
                'w-full text-sm border rounded-md shadow-sm px-3 py-2 transition-colors',
                readOnly
                    ? 'border-slate-300 bg-white cursor-default'
                    : 'border-slate-300 bg-white hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                className
            )}
        />
    );
}

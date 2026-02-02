/**
 * StatusFieldEditor - Semantic Component for inline status editing
 *
 * Responsibilities:
 * - Displays current status as a clickable pill
 * - Shows dropdown menu with all status options on click
 * - Single-click selection (immediately fires onChange)
 * - Styled with status colors from config
 *
 * Design Rules:
 * - Pure presentational - no API calls
 * - Receives statusConfig from parent (or uses default)
 * - Used in both table cells and inspector fields
 */

import { clsx } from 'clsx';
import { ChevronDown, Check } from 'lucide-react';
import { useCallback } from 'react';

import { TASK_STATUS_CONFIG } from '@autoart/shared';

import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from '@autoart/ui';


/** Config type for status display */
type StatusConfig = Record<string, { label: string; colorClass: string }>;

/** Default fallback config for unknown statuses */
const DEFAULT_STATUS = { label: 'Unknown', colorClass: 'bg-slate-100 text-ws-text-secondary' };

export interface StatusFieldEditorProps {
    /** Current status value */
    value: string;
    /** Available status options (defaults to TASK_STATUS_CONFIG keys) */
    options?: string[];
    /** Status display configuration (defaults to TASK_STATUS_CONFIG) */
    statusConfig?: StatusConfig;
    /** Called when status is changed */
    onChange: (value: string) => void;
    /** Whether the field is read-only */
    readOnly?: boolean;
    /** Compact mode for table cells */
    compact?: boolean;
    /** Additional className */
    className?: string;
}

/**
 * StatusFieldEditor - Clickable status pill with dropdown selection
 */
export function StatusFieldEditor({
    value,
    options,
    statusConfig,
    onChange,
    readOnly = false,
    compact = false,
    className,
}: StatusFieldEditorProps) {
    // Use provided config or cast TASK_STATUS_CONFIG to generic StatusConfig
    const config: StatusConfig = statusConfig || (TASK_STATUS_CONFIG as StatusConfig);
    const statusOptions = options || Object.keys(config);

    // Get current status display info with fallback
    const getStatusConfig = (status: string) => config[status] || DEFAULT_STATUS;
    const currentConfig = getStatusConfig(value) || { label: value || 'Select...', colorClass: 'bg-slate-100 text-ws-text-secondary' };

    const handleSelect = useCallback((status: string) => {
        onChange(status);
    }, [onChange]);

    if (readOnly) {
        return (
            <div className={clsx('relative', className)}>
                <div
                    className={clsx(
                        'flex items-center justify-center gap-1 rounded font-semibold',
                        compact ? 'h-7 px-2 text-[11px]' : 'h-8 px-3 text-xs',
                        currentConfig.colorClass,
                        'cursor-default'
                    )}
                >
                    <span>{currentConfig.label || value || 'Empty'}</span>
                </div>
            </div>
        );
    }

    return (
        <div className={clsx('relative', className)}>
            <Dropdown>
                <DropdownTrigger asChild>
                    <button
                        type="button"
                        className={clsx(
                            'flex items-center justify-center gap-1 rounded font-semibold transition-all',
                            compact ? 'h-7 px-2 text-[11px]' : 'h-8 px-3 text-xs',
                            currentConfig.colorClass,
                            'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-slate-300'
                        )}
                    >
                        <span>{currentConfig.label || value || 'Empty'}</span>
                        <ChevronDown
                            size={compact ? 12 : 14}
                            className="transition-transform data-[state=open]:rotate-180"
                        />
                    </button>
                </DropdownTrigger>

                <DropdownContent align="start" className="min-w-[140px]">
                    {statusOptions.map((status) => {
                        const statusCfg = getStatusConfig(status);
                        const isSelected = status === value;

                        return (
                            <DropdownItem
                                key={status}
                                onSelect={() => handleSelect(status)}
                                className={isSelected ? 'bg-slate-100' : ''}
                            >
                                {/* Color indicator */}
                                <span
                                    className={clsx(
                                        'w-3 h-3 rounded-sm shrink-0',
                                        statusCfg.colorClass
                                    )}
                                />
                                <span className="flex-1">{statusCfg.label || status}</span>
                                {isSelected && (
                                    <Check size={14} className="text-blue-500" />
                                )}
                            </DropdownItem>
                        );
                    })}
                </DropdownContent>
            </Dropdown>
        </div>
    );
}

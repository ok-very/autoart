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
import { ChevronDown } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';

import { TASK_STATUS_CONFIG } from '@autoart/shared';

import { PortalMenu } from '@autoart/ui';


/** Config type for status display */
type StatusConfig = Record<string, { label: string; colorClass: string }>;

/** Default fallback config for unknown statuses */
const DEFAULT_STATUS = { label: 'Unknown', colorClass: 'bg-slate-100 text-slate-500' };

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
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Use provided config or cast TASK_STATUS_CONFIG to generic StatusConfig
    const config: StatusConfig = statusConfig || (TASK_STATUS_CONFIG as StatusConfig);
    const statusOptions = options || Object.keys(config);

    // Get current status display info with fallback
    const getStatusConfig = (status: string) => config[status] || DEFAULT_STATUS;
    const currentConfig = getStatusConfig(value) || { label: value || 'Select...', colorClass: 'bg-slate-100 text-slate-500' };

    const handleToggle = useCallback(() => {
        if (!readOnly) {
            setIsOpen((prev) => !prev);
        }
    }, [readOnly]);

    const handleSelect = useCallback((status: string) => {
        onChange(status);
        setIsOpen(false);
    }, [onChange]);

    const handleClose = useCallback(() => {
        setIsOpen(false);
    }, []);

    return (
        <div className={clsx('relative', className)}>
            {/* Current status pill button */}
            <button
                ref={buttonRef}
                type="button"
                onClick={handleToggle}
                disabled={readOnly}
                className={clsx(
                    'flex items-center justify-center gap-1 rounded font-semibold transition-all',
                    compact ? 'h-7 px-2 text-[11px]' : 'h-8 px-3 text-xs',
                    currentConfig.colorClass,
                    readOnly
                        ? 'cursor-default'
                        : 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-slate-300'
                )}
            >
                <span>{currentConfig.label || value || 'Empty'}</span>
                {!readOnly && (
                    <ChevronDown
                        size={compact ? 12 : 14}
                        className={clsx('transition-transform', isOpen && 'rotate-180')}
                    />
                )}
            </button>

            {/* Dropdown menu */}
            <PortalMenu
                isOpen={isOpen}
                anchorRef={buttonRef}
                onClose={handleClose}
                placement="bottom-start"
                className="py-1 min-w-[140px]"
            >
                {statusOptions.map((status) => {
                    const statusCfg = getStatusConfig(status);
                    const isSelected = status === value;

                    return (
                        <button
                            key={status}
                            type="button"
                            onClick={() => handleSelect(status)}
                            className={clsx(
                                'w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 transition-colors',
                                isSelected
                                    ? 'bg-slate-100'
                                    : 'hover:bg-slate-50'
                            )}
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
                                <span className="text-blue-500 text-xs">✓</span>
                            )}
                        </button>
                    );
                })}
            </PortalMenu>
        </div>
    );
}

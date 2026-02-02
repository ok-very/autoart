/**
 * PropertySection - Molecule for grouping related properties
 * 
 * A collapsible section container for organizing fields in inspector views.
 * Pure presentational - no domain logic or API calls.
 */

import { clsx } from 'clsx';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState, ReactNode } from 'react';

export interface PropertySectionProps {
    /** Section title */
    title: string;
    /** Child content (typically FieldRenderer or FieldGroup components) */
    children: ReactNode;
    /** Whether section is collapsible */
    collapsible?: boolean;
    /** Initial collapsed state (only applies if collapsible) */
    defaultCollapsed?: boolean;
    /** Icon to display next to title */
    icon?: ReactNode;
    /** Badge content (e.g., field count) */
    badge?: ReactNode;
    /** Additional header content (right side) */
    headerAction?: ReactNode;
    /** Optional className */
    className?: string;
}

/**
 * PropertySection - Collapsible section for organizing properties
 */
export function PropertySection({
    title,
    children,
    collapsible = false,
    defaultCollapsed = false,
    icon,
    badge,
    headerAction,
    className,
}: PropertySectionProps) {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

    const handleToggle = () => {
        if (collapsible) {
            setIsCollapsed(!isCollapsed);
        }
    };

    const showContent = !collapsible || !isCollapsed;

    return (
        <div className={clsx('space-y-3', className)}>
            {/* Header */}
            <div
                className={clsx(
                    'flex items-center justify-between border-b border-ws-panel-border pb-2',
                    collapsible && 'cursor-pointer select-none'
                )}
                onClick={handleToggle}
            >
                <div className="flex items-center gap-2">
                    {/* Collapse indicator */}
                    {collapsible && (
                        <span className="text-ws-muted">
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </span>
                    )}

                    {/* Icon */}
                    {icon && <span className="text-ws-muted">{icon}</span>}

                    {/* Title */}
                    <h4 className="text-xs font-semibold text-ws-muted uppercase">
                        {title}
                    </h4>

                    {/* Badge */}
                    {badge && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-ws-text-secondary rounded">
                            {badge}
                        </span>
                    )}
                </div>

                {/* Header action */}
                {headerAction && (
                    <div onClick={(e) => e.stopPropagation()}>
                        {headerAction}
                    </div>
                )}
            </div>

            {/* Content */}
            {showContent && (
                <div className="space-y-4">
                    {children}
                </div>
            )}

            {/* Collapsed placeholder */}
            {!showContent && (
                <div className="text-xs text-ws-muted italic pl-6">
                    Click to expand
                </div>
            )}
        </div>
    );
}

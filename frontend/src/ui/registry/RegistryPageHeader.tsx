/**
 * RegistryPageHeader
 *
 * Unified header component for Registry pages (Records, Actions, Fields).
 * Provides consistent layout with:
 * - Page title with icon
 * - + Create button (when applicable)
 * - Definitions | Instances tab switch (when applicable)
 */

import { clsx } from 'clsx';
import { LucideIcon, Plus } from 'lucide-react';

import { RegistryTabSwitch, type RegistryTab } from './RegistryTabSwitch';

interface RegistryPageHeaderProps {
    /** Page title displayed in header */
    title: string;
    /** Icon displayed next to title */
    icon: LucideIcon;
    /** Show the + create button */
    showCreateButton?: boolean;
    /** Handler for + button click */
    onCreateClick?: () => void;
    /** Create button tooltip/label */
    createLabel?: string;
    /** Active tab (definitions or instances) */
    activeTab?: RegistryTab;
    /** Tab change handler */
    onTabChange?: (tab: RegistryTab) => void;
    /** Show the tab switch (false for Events page) */
    showTabSwitch?: boolean;
    /** Additional class names */
    className?: string;
}

export function RegistryPageHeader({
    title,
    icon: Icon,
    showCreateButton = false,
    onCreateClick,
    createLabel = 'Create',
    activeTab,
    onTabChange,
    showTabSwitch = true,
    className,
}: RegistryPageHeaderProps) {
    return (
        <div
            className={clsx(
                'h-12 border-b border-slate-200 bg-white flex items-center justify-between px-4',
                className
            )}
        >
            {/* Left: Title with icon and + button */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <Icon size={20} className="text-slate-500" />
                    <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
                </div>

                {showCreateButton && onCreateClick && (
                    <button
                        onClick={onCreateClick}
                        className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        title={createLabel}
                    >
                        <Plus size={16} />
                    </button>
                )}
            </div>

            {/* Right: Tab switch */}
            {showTabSwitch && activeTab && onTabChange && (
                <RegistryTabSwitch
                    activeTab={activeTab}
                    onTabChange={onTabChange}
                />
            )}
        </div>
    );
}

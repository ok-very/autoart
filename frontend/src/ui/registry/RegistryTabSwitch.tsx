/**
 * RegistryTabSwitch
 *
 * Segmented control for switching between Definitions and Instances views
 * in Registry pages (Records, Actions, Fields).
 * 
 * Used consistently across all definition-capable Registry sections.
 */

import { clsx } from 'clsx';

export type RegistryTab = 'definitions' | 'instances';

interface RegistryTabSwitchProps {
    activeTab: RegistryTab;
    onTabChange: (tab: RegistryTab) => void;
    className?: string;
}

export function RegistryTabSwitch({
    activeTab,
    onTabChange,
    className,
}: RegistryTabSwitchProps) {
    return (
        <div className={clsx('flex bg-slate-100 p-0.5 rounded-lg', className)}>
            <button
                onClick={() => onTabChange('definitions')}
                className={clsx(
                    'px-3 py-1.5 text-xs font-medium rounded transition-all',
                    activeTab === 'definitions'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                )}
            >
                Definitions
            </button>
            <button
                onClick={() => onTabChange('instances')}
                className={clsx(
                    'px-3 py-1.5 text-xs font-medium rounded transition-all',
                    activeTab === 'instances'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                )}
            >
                Instances
            </button>
        </div>
    );
}

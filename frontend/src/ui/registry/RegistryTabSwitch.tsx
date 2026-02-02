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
                    'px-3 py-1.5 text-xs font-sans font-medium rounded transition-all',
                    activeTab === 'definitions'
                        ? 'bg-ws-panel-bg text-ws-fg shadow-sm'
                        : 'text-ws-text-secondary hover:text-ws-text-secondary'
                )}
            >
                Definitions
            </button>
            <button
                onClick={() => onTabChange('instances')}
                className={clsx(
                    'px-3 py-1.5 text-xs font-sans font-medium rounded transition-all',
                    activeTab === 'instances'
                        ? 'bg-ws-panel-bg text-ws-fg shadow-sm'
                        : 'text-ws-text-secondary hover:text-ws-text-secondary'
                )}
            >
                Instances
            </button>
        </div>
    );
}

/**
 * SourceIconSidebar
 *
 * VSCode-style vertical icon bar for import source selection.
 * Shows connected status indicators and + button for integrations.
 */

import { File, Calendar, Plug, Plus, Check } from 'lucide-react';
import { useConnections } from '../../api/connections';
import { useUIStore } from '../../stores/uiStore';

// ============================================================================
// TYPES
// ============================================================================

export type SourceType = 'file' | 'monday' | 'api';

interface SourceIconSidebarProps {
    activeSource: SourceType;
    onSourceChange: (source: SourceType) => void;
}

interface SourceIconProps {
    id: SourceType;
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    isConnected: boolean;
    isDisabled: boolean;
    onClick: () => void;
}

// ============================================================================
// SOURCE ICON
// ============================================================================

function SourceIcon({ id, icon, label, isActive, isConnected, isDisabled, onClick }: SourceIconProps) {
    return (
        <button
            onClick={onClick}
            disabled={isDisabled}
            title={label}
            className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-all ${isActive
                    ? 'bg-blue-100 text-blue-600 shadow-sm'
                    : isDisabled
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
            data-aa-component="SourceIconSidebar"
            data-aa-id={`source-${id}`}
        >
            {icon}
            {/* Connected indicator */}
            {isConnected && !isActive && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full" />
            )}
            {/* Active + Connected indicator */}
            {isConnected && isActive && (
                <Check size={10} className="absolute top-1 right-1 text-green-600" />
            )}
        </button>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SourceIconSidebar({ activeSource, onSourceChange }: SourceIconSidebarProps) {
    const { data: connections } = useConnections();
    const { openDrawer } = useUIStore();

    const isMondayConnected = connections?.monday?.connected ?? false;
    // API is "connected" if any API integrations exist (placeholder for future)
    const isApiConnected = false;

    const handleAddIntegration = () => {
        openDrawer('integrations', {});
    };

    return (
        <div className="w-12 bg-slate-50 border-r border-slate-200 flex flex-col items-center py-2">
            {/* Source Icons */}
            <div className="flex flex-col gap-1">
                <SourceIcon
                    id="file"
                    icon={<File size={18} />}
                    label="File Upload"
                    isActive={activeSource === 'file'}
                    isConnected={false}
                    isDisabled={false}
                    onClick={() => onSourceChange('file')}
                />
                <SourceIcon
                    id="monday"
                    icon={<Calendar size={18} />}
                    label="Monday.com"
                    isActive={activeSource === 'monday'}
                    isConnected={isMondayConnected}
                    isDisabled={!isMondayConnected}
                    onClick={() => isMondayConnected && onSourceChange('monday')}
                />
                <SourceIcon
                    id="api"
                    icon={<Plug size={18} />}
                    label="API Connections"
                    isActive={activeSource === 'api'}
                    isConnected={isApiConnected}
                    isDisabled={!isApiConnected}
                    onClick={() => isApiConnected && onSourceChange('api')}
                />
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Divider */}
            <div className="w-6 h-px bg-slate-200 my-2" />

            {/* Add Integration Button */}
            <button
                onClick={handleAddIntegration}
                title="Add Integration"
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
                data-aa-component="SourceIconSidebar"
                data-aa-id="add-integration"
            >
                <Plus size={18} />
            </button>
        </div>
    );
}

export default SourceIconSidebar;

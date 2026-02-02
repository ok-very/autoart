/**
 * ActionTypesPanel
 *
 * Registry panel for managing Action Type Definitions.
 * Displays all action types (TASK, BUG, STORY, custom) with instance counts.
 */

import { clsx } from 'clsx';
import { Plus, Zap, ChevronRight, Hash } from 'lucide-react';
import { useState } from 'react';

import {
    useActionTypeDefinitions,
    useActionTypeStats,
} from '../../api/hooks/actionTypes';

// ==================== TYPES ====================

interface ActionTypesPanelProps {
    selectedType: string | null;
    onSelectType: (type: string | null) => void;
    className?: string;
}

// ==================== MAIN COMPONENT ====================

export function ActionTypesPanel({
    selectedType,
    onSelectType,
    className,
}: ActionTypesPanelProps) {
    const [searchQuery, setSearchQuery] = useState('');

    const { data: definitions = [], isLoading } = useActionTypeDefinitions();
    const { data: stats = [] } = useActionTypeStats();

    // Build stats lookup
    const statsMap = new Map(stats.map((s) => [s.type, s.count]));

    // Filter by search
    const filtered = definitions.filter(
        (def) =>
            def.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            def.type.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Separate system and custom types
    const systemTypes = filtered.filter((def) => def.is_system);
    const customTypes = filtered.filter((def) => !def.is_system);

    const getInstanceCount = (type: string): number => statsMap.get(type) || 0;

    return (
        <div className={clsx('flex flex-col h-full bg-ws-bg', className)}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-ws-panel-border bg-ws-panel-bg">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Zap size={16} className="text-amber-500" />
                        <h3 className="text-sm font-semibold text-ws-fg">Action Types</h3>
                    </div>
                    <button
                        className="p-1.5 rounded-md hover:bg-slate-100 text-ws-text-secondary"
                        title="Create Action Type"
                    >
                        <Plus size={14} />
                    </button>
                </div>

                {/* Search */}
                <input
                    type="text"
                    placeholder="Search types..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-ws-panel-border rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-amber-500 rounded-full" />
                    </div>
                ) : (
                    <>
                        {/* System Types */}
                        {systemTypes.length > 0 && (
                            <div className="p-2">
                                <h4 className="px-2 py-1 text-xs font-medium text-ws-text-secondary uppercase tracking-wide">
                                    Built-in Types
                                </h4>
                                {systemTypes.map((def) => (
                                    <ActionTypeRow
                                        key={def.id}
                                        type={def.type}
                                        label={def.label}
                                        description={def.description}
                                        instanceCount={getInstanceCount(def.type)}
                                        isSelected={selectedType === def.type}
                                        isSystem
                                        onClick={() => onSelectType(def.type)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Custom Types */}
                        {customTypes.length > 0 && (
                            <div className="p-2">
                                <h4 className="px-2 py-1 text-xs font-medium text-ws-text-secondary uppercase tracking-wide">
                                    Custom Types
                                </h4>
                                {customTypes.map((def) => (
                                    <ActionTypeRow
                                        key={def.id}
                                        type={def.type}
                                        label={def.label}
                                        description={def.description}
                                        instanceCount={getInstanceCount(def.type)}
                                        isSelected={selectedType === def.type}
                                        isSystem={false}
                                        onClick={() => onSelectType(def.type)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Empty State */}
                        {filtered.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-32 text-ws-muted">
                                <Zap size={24} className="mb-2" />
                                <p className="text-sm">No action types found</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Footer - Summary */}
            <div className="px-4 py-2 border-t border-ws-panel-border bg-ws-panel-bg">
                <div className="text-xs text-ws-text-secondary">
                    {definitions.length} types · {stats.reduce((acc, s) => acc + s.count, 0)} instances
                </div>
            </div>
        </div>
    );
}

// ==================== SUB-COMPONENTS ====================

interface ActionTypeRowProps {
    type: string;
    label: string;
    description: string | null;
    instanceCount: number;
    isSelected: boolean;
    isSystem: boolean;
    onClick: () => void;
}

function ActionTypeRow({
    type: _type,
    label,
    description,
    instanceCount,
    isSelected,
    isSystem,
    onClick,
}: ActionTypeRowProps) {
    return (
        <button
            onClick={onClick}
            className={clsx(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors',
                isSelected
                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                    : 'hover:bg-slate-100 text-ws-text-secondary'
            )}
        >
            {/* Icon */}
            <div
                className={clsx(
                    'w-8 h-8 rounded-md flex items-center justify-center text-sm font-semibold',
                    isSystem
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-purple-100 text-purple-600'
                )}
            >
                {label.charAt(0).toUpperCase()}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{label}</span>
                    {isSystem && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-200 text-ws-text-secondary rounded">
                            SYSTEM
                        </span>
                    )}
                </div>
                {description && (
                    <p className="text-xs text-ws-text-secondary truncate">{description}</p>
                )}
            </div>

            {/* Instance Count */}
            <div className="flex items-center gap-1 text-xs text-ws-muted">
                <Hash size={12} />
                <span>{instanceCount}</span>
            </div>

            {/* Chevron */}
            <ChevronRight size={14} className="text-ws-muted" />
        </button>
    );
}

// ==================== EXPORTS ====================

export default ActionTypesPanel;

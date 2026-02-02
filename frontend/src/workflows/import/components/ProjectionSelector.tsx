/**
 * Projection Selector
 *
 * Toggle buttons to switch between available projection presets.
 */

import { Eye } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface ProjectionOption {
    id: string;
    label: string;
    description?: string;
}

interface ProjectionSelectorProps {
    activeProjectionId: string;
    availableProjections: readonly ProjectionOption[];
    onChange: (projectionId: string) => void;
    disabled?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ProjectionSelector({
    activeProjectionId,
    availableProjections,
    onChange,
    disabled = false,
}: ProjectionSelectorProps) {
    return (
        <div className="h-10 bg-white border-b border-slate-200 flex items-center px-3 gap-3">
            <Eye className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase">View as:</span>

            <div className="flex gap-1">
                {availableProjections.map((projection) => (
                    <button
                        key={projection.id}
                        onClick={() => onChange(projection.id)}
                        disabled={disabled}
                        title={projection.description}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${projection.id === activeProjectionId
                                ? 'bg-blue-500 text-white shadow-sm'
                                : disabled
                                    ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        {projection.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default ProjectionSelector;

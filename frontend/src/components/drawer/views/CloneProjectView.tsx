import { useState } from 'react';
import { Copy, FileText, Database, Layers } from 'lucide-react';
import { useUIStore } from '../../../stores/uiStore';
import { useHierarchyStore } from '../../../stores/hierarchyStore';
import { useCloneNode, useCloneStats } from '../../../api/hooks';

interface CloneProjectViewProps {
  sourceProjectId: string;
  sourceProjectTitle: string;
}

type CloneDepth = 'all' | 'subprocess' | 'stage' | 'process';

const DEPTH_OPTIONS: { value: CloneDepth; label: string; description: string }[] = [
  { value: 'all', label: 'Complete Clone', description: 'Project → Process → Stage → Subprocess → Task' },
  { value: 'subprocess', label: 'Up to Subprocess', description: 'Project → Process → Stage → Subprocess (no tasks)' },
  { value: 'stage', label: 'Up to Stage', description: 'Project → Process → Stage only' },
  { value: 'process', label: 'Up to Process', description: 'Project → Process only' },
];

export function CloneProjectView({ sourceProjectId, sourceProjectTitle }: CloneProjectViewProps) {
  const [title, setTitle] = useState(`${sourceProjectTitle} (Copy)`);
  const [depth, setDepth] = useState<CloneDepth>('all');
  const [includeDefinitions, setIncludeDefinitions] = useState(true);
  const [includeRecords, setIncludeRecords] = useState(false);

  const { closeDrawer } = useUIStore();
  const { selectProject } = useHierarchyStore();
  const cloneNode = useCloneNode();

  // Fetch clone stats for display
  const { data: cloneStats } = useCloneStats(sourceProjectId);
  const includedCount = (cloneStats?.total ?? 0) - (cloneStats?.excluded ?? 0);
  const excludedCount = cloneStats?.excluded ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const result = await cloneNode.mutateAsync({
        sourceNodeId: sourceProjectId,
        targetParentId: null, // Project has no parent
        overrides: {
          title: title.trim(),
        },
        depth,
        includeTemplates: includeDefinitions, // Still use includeTemplates for API compatibility
        includeRecords,
      });

      // Auto-select the cloned project
      if (result.node) {
        selectProject(result.node.id);
      }

      closeDrawer();
    } catch (err) {
      console.error('Failed to clone project:', err);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
          <Copy className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Clone Project</h2>
          <p className="text-sm text-slate-500">
            "{sourceProjectTitle}"
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project Name */}
        <div>
          <label
            htmlFor="clone-title"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            New Project Name
          </label>
          <input
            id="clone-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter new project name..."
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
          />
        </div>

        {/* Clone Depth */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Layers size={16} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Clone Depth</span>
          </div>
          <div className="space-y-2">
            {DEPTH_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  depth === option.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="depth"
                  value={option.value}
                  checked={depth === option.value}
                  onChange={(e) => setDepth(e.target.value as CloneDepth)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium text-slate-800">{option.label}</div>
                  <div className="text-xs text-slate-500">{option.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Include Options */}
        <div className="space-y-3">
          {/* Include Definitions */}
          <label
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              includeDefinitions
                ? 'border-purple-500 bg-purple-50'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <input
              type="checkbox"
              checked={includeDefinitions}
              onChange={(e) => setIncludeDefinitions(e.target.checked)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-purple-600" />
                <span className="text-sm font-medium text-slate-800">
                  Include Record Definitions
                </span>
                {includedCount > 0 && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                    {includedCount} definition{includedCount !== 1 ? 's' : ''}
                  </span>
                )}
                {excludedCount > 0 && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                    {excludedCount} excluded
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Clone all non-excluded record definitions to the new project
              </div>
            </div>
          </label>

          {/* Include Records */}
          <label
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              includeRecords
                ? 'border-green-500 bg-green-50'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <input
              type="checkbox"
              checked={includeRecords}
              onChange={(e) => setIncludeRecords(e.target.checked)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Database size={16} className="text-green-600" />
                <span className="text-sm font-medium text-slate-800">
                  Include Records
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Copy data records classified under this project's hierarchy
              </div>
            </div>
          </label>
        </div>

        {/* Info Box */}
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
          <p className="text-xs text-amber-800">
            <strong>Note:</strong> Task references will be cloned but will still point to the original records (unless you include records).
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={closeDrawer}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || cloneNode.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {cloneNode.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Cloning...
              </>
            ) : (
              <>
                <Copy size={16} />
                Clone Project
              </>
            )}
          </button>
        </div>

        {cloneNode.isError && (
          <p className="text-sm text-red-600">
            Failed to clone project. Please try again.
          </p>
        )}
      </form>
    </div>
  );
}

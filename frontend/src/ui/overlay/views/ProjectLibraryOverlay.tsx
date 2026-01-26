import { Library, Copy, Trash2, FileText, ExternalLink } from 'lucide-react';
import { useState } from 'react';

import { useProjectTemplates, useRemoveFromLibrary, useCreateDefinition } from '@/api/hooks';
import { useUIStore } from '@/stores';
import type { RecordDefinition } from '@/types';

interface ProjectLibraryOverlayProps {
  projectId?: string;
  projectTitle?: string;
}

export function ProjectLibraryOverlay({ projectId, projectTitle }: ProjectLibraryOverlayProps) {
  const { closeOverlay, openOverlay, activeProjectId } = useUIStore();
  const effectiveProjectId = projectId || activeProjectId;

  const { data: templates, isLoading } = useProjectTemplates(effectiveProjectId || null);
  const removeFromLibrary = useRemoveFromLibrary();
  const createDefinition = useCreateDefinition();

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleUseTemplate = async (template: RecordDefinition) => {
    try {
      await createDefinition.mutateAsync({
        name: `${template.name} (Copy)`,
        schemaConfig: template.schema_config,
        styling: template.styling,
      });
      closeOverlay();
    } catch (err) {
      console.error('Failed to create from template:', err);
    }
  };

  const handleRemoveFromLibrary = async (definitionId: string) => {
    try {
      await removeFromLibrary.mutateAsync(definitionId);
    } catch (err) {
      console.error('Failed to remove from library:', err);
    }
  };

  const handleViewDefinition = (definitionId: string) => {
    openOverlay('view-definition', { definitionId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-blue-500 rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
          <Library className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            Project Template Library
          </h2>
          {projectTitle && (
            <p className="text-sm text-slate-500">{projectTitle}</p>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="mb-6 p-4 bg-slate-50 rounded-lg">
        <p className="text-sm text-slate-600">
          Record definition templates saved to this project's library. These templates are included when cloning this project.
        </p>
      </div>

      {/* Templates List */}
      {!templates || templates.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No templates yet</p>
          <p className="text-sm text-slate-400 mt-1">
            Save record definitions to this library from the Schema tab in the inspector
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
            >
              {/* Icon/Emoji Badge */}
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 ${
                  template.styling?.color
                    ? `bg-${template.styling.color}-100`
                    : 'bg-slate-100'
                }`}
              >
                {template.styling?.icon || template.name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800 truncate">
                  {template.name}
                </div>
                <div className="text-xs text-slate-400">
                  {template.schema_config?.fields?.length || 0} fields
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleViewDefinition(template.id)}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="View definition"
                >
                  <ExternalLink size={16} />
                </button>
                <button
                  onClick={() => {
                    handleUseTemplate(template);
                    setCopiedId(template.id);
                    setTimeout(() => setCopiedId(null), 2000);
                  }}
                  disabled={createDefinition.isPending}
                  className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Create new definition from this template"
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={() => handleRemoveFromLibrary(template.id)}
                  disabled={removeFromLibrary.isPending}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Remove from library"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {copiedId === template.id && (
                <span className="text-xs text-green-600 font-medium">Copied!</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs text-amber-800">
          <strong>Tip:</strong> When you clone this project, you can choose to include these template definitions in the new project.
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-slate-100">
        <button
          onClick={closeOverlay}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

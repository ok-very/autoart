import { ExternalLink, Palette } from 'lucide-react';

import { useRecord, useRecordDefinition } from '@/api/hooks';
import { useUIStore } from '@/stores';
import type { FieldDef } from '@/types';

interface ViewDefinitionDrawerProps {
  recordId?: string;
  definitionId?: string;
}

const FIELD_TYPE_COLORS: Record<string, string> = {
  text: 'bg-blue-100 text-blue-700',
  number: 'bg-green-100 text-green-700',
  email: 'bg-purple-100 text-purple-700',
  url: 'bg-cyan-100 text-cyan-700',
  textarea: 'bg-indigo-100 text-indigo-700',
  select: 'bg-amber-100 text-amber-700',
  date: 'bg-pink-100 text-pink-700',
  checkbox: 'bg-emerald-100 text-emerald-700',
  link: 'bg-orange-100 text-orange-700',
};

export function ViewDefinitionDrawer({ recordId, definitionId }: ViewDefinitionDrawerProps) {
  const { closeDrawer, inspectRecord } = useUIStore();

  // If recordId provided, first fetch record to get definition_id
  const { data: record, isLoading: recordLoading } = useRecord(recordId || null);
  const effectiveDefinitionId = definitionId || record?.definition_id;

  const { data: definition, isLoading: defLoading } = useRecordDefinition(
    effectiveDefinitionId || null
  );

  const isLoading = recordLoading || defLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-blue-500 rounded-full" />
      </div>
    );
  }

  if (!definition) {
    return (
      <div className="p-4 text-center text-slate-400">
        Definition not found
      </div>
    );
  }

  const fields = definition.schema_config?.fields || [];
  const styling = definition.styling || {};

  const handleOpenInInspector = () => {
    if (recordId) {
      closeDrawer();
      inspectRecord(recordId);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-3">
          {/* Emoji/Color Badge */}
          <div
            className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl shrink-0 ${
              styling.color ? `bg-${styling.color}-100` : 'bg-slate-100'
            }`}
            style={{
              backgroundColor: styling.color
                ? `var(--tw-color-${styling.color}-100, #f1f5f9)`
                : undefined,
            }}
          >
            {styling.icon || definition.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
              Record Definition
            </div>
            <h2 className="text-xl font-bold text-slate-800">{definition.name}</h2>
            {definition.derived_from_id && (
              <div className="text-xs text-slate-400 mt-1">
                Derived from another definition
              </div>
            )}
            <div className="text-xs text-slate-400 font-mono mt-1">
              ID: {definition.id.slice(0, 8)}
            </div>
          </div>
        </div>
        {recordId && (
          <button
            onClick={handleOpenInInspector}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Open in inspector"
          >
            <ExternalLink size={18} />
          </button>
        )}
      </div>

      {/* Styling & Clone Settings */}
      <div className="mb-6 p-4 bg-slate-50 rounded-lg">
        <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
          <Palette size={12} />
          <span>Settings</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {styling.icon && (
              <div className="flex items-center gap-2">
                <span className="text-lg">{styling.icon}</span>
                <span className="text-sm text-slate-600">Icon</span>
              </div>
            )}
            {styling.color && (
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-md border border-slate-200 bg-${styling.color}-500`}
                />
                <span className="text-sm text-slate-600 capitalize">{styling.color}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="mb-6">
        <div className="text-xs font-medium text-slate-500 mb-3">
          Fields ({fields.length})
        </div>

        {fields.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No fields defined</p>
        ) : (
          <div className="space-y-2">
            {fields.map((field: FieldDef) => (
              <div
                key={field.key}
                className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg"
              >
                {/* Type badge */}
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    FIELD_TYPE_COLORS[field.type] || 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {field.type}
                </span>

                {/* Field info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700">
                    {field.label}
                    {field.required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    {field.key}
                  </div>
                </div>

                {/* Options preview for select type */}
                {field.type === 'select' && field.options && (
                  <div className="text-[10px] text-slate-400">
                    {field.options.length} options
                  </div>
                )}

                {/* Default value indicator */}
                {field.defaultValue !== undefined && (
                  <div className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    has default
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="text-xs text-slate-400 border-t border-slate-100 pt-4">
        <div>Created: {new Date(definition.created_at).toLocaleDateString()}</div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-slate-100">
        <button
          onClick={closeDrawer}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

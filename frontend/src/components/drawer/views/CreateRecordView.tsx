import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useUIStore } from '../../../stores/uiStore';
import {
  useRecordDefinition,
  useCreateRecord,
} from '../../../api/hooks';
import { RichTextInput } from '../../editor/RichTextInput';
import type { FieldDef } from '../../../types';

interface CreateRecordViewProps {
  definitionId: string;
  classificationNodeId?: string;
}

export function CreateRecordView({ definitionId, classificationNodeId }: CreateRecordViewProps) {
  const { closeDrawer, inspectRecord } = useUIStore();
  const { data: definition, isLoading } = useRecordDefinition(definitionId);
  const createRecord = useCreateRecord();

  const [uniqueName, setUniqueName] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});

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

  const handleFieldChange = (key: string, newValue: unknown) => {
    setFieldValues((prev) => ({ ...prev, [key]: newValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uniqueName.trim()) return;

    try {
      const result = await createRecord.mutateAsync({
        definition_id: definitionId,
        unique_name: uniqueName.trim(),
        data: fieldValues,
        classification_node_id: classificationNodeId || null,
      });

      // Open the newly created record in inspector
      if (result.record) {
        closeDrawer();
        inspectRecord(result.record.id);
      }
    } catch (err) {
      console.error('Failed to create record:', err);
    }
  };

  const icon = definition.styling?.icon;
  const color = definition.styling?.color || 'slate';

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className={`w-12 h-12 rounded-lg bg-${color}-100 flex items-center justify-center text-2xl`}
        >
          {icon || definition.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase">
            Create New
          </div>
          <h2 className="text-xl font-bold text-slate-800">{definition.name}</h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Unique Name */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={uniqueName}
            onChange={(e) => setUniqueName(e.target.value)}
            placeholder={`Enter ${definition.name.toLowerCase()} name...`}
            className="w-full text-sm border border-slate-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
          />
        </div>

        {/* Fields */}
        {fields
          .filter((f: FieldDef) => f.key !== 'name' && f.key !== 'title')
          .map((fieldDef: FieldDef) => (
            <div key={fieldDef.key}>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {fieldDef.label}
                {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <FieldInput
                fieldDef={fieldDef}
                value={fieldValues[fieldDef.key]}
                onChange={(newValue) => handleFieldChange(fieldDef.key, newValue)}
              />
            </div>
          ))}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-6 mt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={closeDrawer}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!uniqueName.trim() || createRecord.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {createRecord.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus size={16} />
                Create {definition.name}
              </>
            )}
          </button>
        </div>

        {createRecord.isError && (
          <p className="text-sm text-red-600">
            Failed to create record. Please try again.
          </p>
        )}
      </form>
    </div>
  );
}

// Simple field input for creation
interface FieldInputProps {
  fieldDef: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}

function FieldInput({ fieldDef, value, onChange }: FieldInputProps) {
  const type = fieldDef.type || 'text';

  if (type === 'textarea') {
    return (
      <RichTextInput
        value={value}
        onChange={onChange}
        multiline={true}
      />
    );
  }

  if (type === 'select' && fieldDef.options) {
    return (
      <select
        value={String(value || '')}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border border-slate-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
      >
        <option value="">Select...</option>
        {fieldDef.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (type === 'checkbox') {
    const isChecked = String(value) === 'true';
    return (
      <label className="flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => onChange(String(e.target.checked))}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <span className="ml-2 text-sm text-slate-600">{isChecked ? 'Yes' : 'No'}</span>
      </label>
    );
  }

  if (type === 'date') {
    return (
      <input
        type="date"
        value={String(value || '')}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border border-slate-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    );
  }

  // For text fields, use RichTextInput
  if (type === 'text') {
    return (
      <RichTextInput
        value={value}
        onChange={onChange}
        multiline={false}
      />
    );
  }

  // Standard input for number, email, url types
  return (
    <input
      type={type === 'number' ? 'number' : type === 'email' ? 'email' : type === 'url' ? 'url' : 'text'}
      value={String(value || '')}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-sm border border-slate-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    />
  );
}

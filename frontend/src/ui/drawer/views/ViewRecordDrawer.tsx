import { ExternalLink, Trash2 } from 'lucide-react';
import { useState, useRef } from 'react';

import {
  useRecord,
  useRecordDefinition,
  useUpdateRecord,
  useDeleteRecord,
} from '@/api/hooks';
import { useUIStore } from '@/stores';
import type { FieldDef } from '@/types';

import { RichTextInput } from '../../editor/RichTextInput';

interface ViewRecordDrawerProps {
  recordId: string;
}

export function ViewRecordDrawer({ recordId }: ViewRecordDrawerProps) {
  const { closeDrawer, inspectRecord } = useUIStore();
  const { data: record, isLoading } = useRecord(recordId);
  const { data: definition } = useRecordDefinition(record?.definition_id || null);
  const updateRecord = useUpdateRecord();
  const deleteRecord = useDeleteRecord();

  const [editedFields, setEditedFields] = useState<Record<string, unknown>>({});
  const fieldTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-blue-500 rounded-full" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="p-4 text-center text-slate-400">
        Record not found
      </div>
    );
  }

  const data = (record.data || {}) as Record<string, unknown>;
  const fields = definition?.schema_config?.fields || [];

  const getFieldValue = (key: string, value: unknown): unknown => {
    if (editedFields[key] !== undefined) {
      return editedFields[key];
    }
    return value;
  };

  const handleFieldChange = (key: string, newValue: unknown) => {
    setEditedFields((prev) => ({ ...prev, [key]: newValue }));

    // Clear existing timer for this field
    if (fieldTimerRef.current[key]) {
      clearTimeout(fieldTimerRef.current[key]);
    }

    // Debounce the save
    fieldTimerRef.current[key] = setTimeout(() => {
      // Direct assignment as value can now be object (TipTap JSON)
      const parsedValue = newValue;

      updateRecord.mutate({
        id: record.id,
        data: { ...data, [key]: parsedValue },
      });
    }, 1000);
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this record?')) {
      await deleteRecord.mutateAsync(record.id);
      closeDrawer();
    }
  };

  const handleOpenInInspector = () => {
    closeDrawer();
    inspectRecord(record.id);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
            {definition?.name || 'Record'}
          </div>
          <h2 className="text-xl font-bold text-slate-800">{record.unique_name}</h2>
          <div className="text-xs text-slate-400 font-mono mt-1">
            ID: {record.id.slice(0, 8)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenInInspector}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Open in inspector"
          >
            <ExternalLink size={18} />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete record"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        {fields.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No fields defined for this record type</p>
        ) : (
          fields.map((fieldDef: FieldDef) => {
            const value = data[fieldDef.key];
            return (
              <div key={fieldDef.key}>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  {fieldDef.label}
                  {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <FieldInput
                  fieldDef={fieldDef}
                  value={getFieldValue(fieldDef.key, value)}
                  onChange={(newValue) => handleFieldChange(fieldDef.key, newValue)}
                  currentRecordId={record.id}
                />
              </div>
            );
          })
        )}

        {/* Extra fields not in schema */}
        {Object.entries(data)
          .filter(([key]) => !fields.find((f: FieldDef) => f.key === key))
          .map(([key, value]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-500 mb-1 capitalize">
                {key.replace(/_/g, ' ')}
                <span className="text-slate-300 ml-1">(custom)</span>
              </label>
              <FieldInput
                value={getFieldValue(key, value)}
                onChange={(newValue) => handleFieldChange(key, newValue)}
                currentRecordId={record.id}
              />
            </div>
          ))}
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

// Simple field input for the drawer
interface FieldInputProps {
  fieldDef?: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  /** Current record ID for self-reference prevention */
  currentRecordId?: string;
}

function FieldInput({ fieldDef, value, onChange, currentRecordId }: FieldInputProps) {
  const type = fieldDef?.type || 'text';

  if (type === 'textarea') {
    return (
      <RichTextInput
        value={value}
        onChange={onChange}
        multiline={true}
        currentRecordId={currentRecordId}
      />
    );
  }

  if (type === 'select' && fieldDef?.options) {
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
        currentRecordId={currentRecordId}
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

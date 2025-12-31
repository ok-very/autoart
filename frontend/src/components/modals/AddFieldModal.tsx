import { useState } from 'react';
import { Modal } from './Modal';
import type { FieldDef } from '../../types';

interface AddFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (field: FieldDef) => void;
  isPending?: boolean;
}

const FIELD_TYPES: { value: FieldDef['type']; label: string; description: string }[] = [
  { value: 'text', label: 'Text', description: 'Single line of text' },
  { value: 'textarea', label: 'Text Area', description: 'Multiple lines of text' },
  { value: 'number', label: 'Number', description: 'Numeric value' },
  { value: 'email', label: 'Email', description: 'Email address' },
  { value: 'url', label: 'URL', description: 'Web link' },
  { value: 'date', label: 'Date', description: 'Calendar date' },
  { value: 'select', label: 'Select', description: 'Dropdown with options' },
  { value: 'checkbox', label: 'Checkbox', description: 'True/false toggle' },
  { value: 'link', label: 'Link', description: 'Reference to another record' },
];

export function AddFieldModal({ isOpen, onClose, onSubmit, isPending }: AddFieldModalProps) {
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState<FieldDef['type']>('text');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !label.trim()) return;

    const field: FieldDef = {
      key: key.trim().toLowerCase().replace(/\s+/g, '_'),
      label: label.trim(),
      type,
      required,
    };

    if (type === 'select' && options.trim()) {
      field.options = options.split(',').map((o) => o.trim()).filter(Boolean);
    }

    onSubmit(field);
    handleClose();
  };

  const handleClose = () => {
    setKey('');
    setLabel('');
    setType('text');
    setRequired(false);
    setOptions('');
    onClose();
  };

  // Auto-generate key from label
  const handleLabelChange = (value: string) => {
    setLabel(value);
    if (!key || key === label.toLowerCase().replace(/\s+/g, '_')) {
      setKey(value.toLowerCase().replace(/\s+/g, '_'));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Field Definition">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="label" className="block text-sm font-medium text-slate-700 mb-1">
            Label
          </label>
          <input
            id="label"
            type="text"
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="e.g., Email Address"
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="key" className="block text-sm font-medium text-slate-700 mb-1">
            Field Key
          </label>
          <input
            id="key"
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="e.g., email_address"
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">
            Used in references: #recordname:{key || 'field_key'}
          </p>
        </div>

        <div>
          <label htmlFor="type" className="block text-sm font-medium text-slate-700 mb-1">
            Field Type
          </label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as FieldDef['type'])}
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {FIELD_TYPES.map((ft) => (
              <option key={ft.value} value={ft.value}>
                {ft.label} — {ft.description}
              </option>
            ))}
          </select>
        </div>

        {type === 'select' && (
          <div>
            <label htmlFor="options" className="block text-sm font-medium text-slate-700 mb-1">
              Options (comma-separated)
            </label>
            <input
              id="options"
              type="text"
              value={options}
              onChange={(e) => setOptions(e.target.value)}
              placeholder="Option 1, Option 2, Option 3"
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            id="required"
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="required" className="text-sm text-slate-700">
            Required field
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!key.trim() || !label.trim() || isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? 'Adding...' : 'Add Field'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

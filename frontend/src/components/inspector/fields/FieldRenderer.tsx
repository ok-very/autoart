import { clsx } from 'clsx';
import { RichTextInput } from '../../editor/RichTextInput';
import { LinkFieldInput } from '../LinkFieldInput';
import type { FieldDef } from '../../../types';

/**
 * Field type registry - maps field types to their render components
 */
type FieldType = 'text' | 'textarea' | 'number' | 'email' | 'url' | 'select' | 'checkbox' | 'date' | 'link';

export interface FieldRendererProps {
  fieldKey: string;
  value: unknown;
  fieldDef?: FieldDef;
  onChange: (value: unknown) => void;
  readOnly?: boolean;
  /** Task ID for link fields and mentions */
  taskId?: string;
  /** Current record ID for self-reference prevention */
  currentRecordId?: string;
}

/**
 * Declarative field renderer that maps field types to their appropriate input components.
 * Adding a new field type is as simple as adding an entry to the switch statement.
 */
export function FieldRenderer({
  fieldKey,
  value,
  fieldDef,
  onChange,
  readOnly = false,
  taskId,
  currentRecordId,
}: FieldRendererProps) {
  const type = (fieldDef?.type || 'text') as FieldType;

  // Link field type - uses specialized LinkFieldInput
  if (type === 'link' && taskId) {
    return (
      <LinkFieldInput
        value={String(value || '')}
        fieldKey={fieldKey}
        taskId={taskId}
        onChange={(val) => onChange(val)}
        readOnly={readOnly}
        targetDefinitionId={(fieldDef as FieldDef & { targetDefinitionId?: string })?.targetDefinitionId}
      />
    );
  }

  // Textarea - multiline rich text
  if (type === 'textarea') {
    return (
      <RichTextInput
        value={value}
        onChange={onChange}
        multiline={true}
        taskId={taskId}
        readOnly={readOnly}
        currentRecordId={currentRecordId}
      />
    );
  }

  // Select dropdown
  if (type === 'select' && fieldDef?.options) {
    return (
      <div className="relative">
        <select
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly}
          className={clsx(
            'w-full text-sm border rounded-md shadow-sm px-3 py-2 transition-colors appearance-none bg-white',
            readOnly
              ? 'border-slate-300 cursor-default'
              : 'border-slate-300 hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
          )}
        >
          <option value="">Select...</option>
          {fieldDef.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-500">
          <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
            <path
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
              fillRule="evenodd"
            />
          </svg>
        </div>
      </div>
    );
  }

  // Checkbox
  if (type === 'checkbox') {
    const isChecked = String(value) === 'true';
    return (
      <div className="flex items-center h-9">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => onChange(String(e.target.checked))}
            disabled={readOnly}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-colors"
          />
          <span className="ml-2 text-sm text-slate-600 select-none">
            {isChecked ? 'Yes' : 'No'}
          </span>
        </label>
      </div>
    );
  }

  // Date picker
  if (type === 'date') {
    return (
      <input
        type="date"
        value={String(value || '')}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className={clsx(
          'w-full text-sm border rounded-md shadow-sm px-3 py-2 transition-colors',
          readOnly
            ? 'border-slate-300 bg-white cursor-default'
            : 'border-slate-300 bg-white hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
        )}
      />
    );
  }

  // Text field - uses RichTextInput for inline mentions
  if (type === 'text') {
    return (
      <RichTextInput
        value={value}
        onChange={onChange}
        multiline={false}
        taskId={taskId}
        readOnly={readOnly}
        currentRecordId={currentRecordId}
      />
    );
  }

  // Standard HTML input for number, email, url types
  const inputType = type === 'number' ? 'number' : type === 'email' ? 'email' : type === 'url' ? 'url' : 'text';

  return (
    <input
      type={inputType}
      value={String(value || '')}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      className={clsx(
        'w-full text-sm border rounded-md shadow-sm px-3 py-2 transition-colors',
        readOnly
          ? 'border-slate-300 bg-white cursor-default'
          : 'border-slate-300 bg-white hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
      )}
    />
  );
}

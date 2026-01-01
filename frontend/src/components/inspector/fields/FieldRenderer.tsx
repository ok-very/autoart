import { clsx } from 'clsx';
import { RichTextInput } from '../../editor/RichTextInput';
import { LinkFieldInput } from '../LinkFieldInput';
import { UserMentionInput } from './UserMentionInput';
import { TagsInput } from './TagsInput';
import type { FieldDef } from '../../../types';
import type { TaskStatus } from '../../../utils/nodeMetadata';

/**
 * Field type registry - maps field types to their render components
 */
type FieldType = 'text' | 'textarea' | 'number' | 'email' | 'url' | 'select' | 'checkbox' | 'date' | 'link' | 'status' | 'percent' | 'user' | 'tags';

// Status styling config - import from shared
import { TASK_STATUS_CONFIG, TaskStatusSchema } from '../../../utils/nodeMetadata';

// Get status options from schema
const STATUS_OPTIONS = TaskStatusSchema.options;

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
  if (type === 'link' && (taskId || currentRecordId)) {
    return (
      <LinkFieldInput
        value={String(value || '')}
        fieldKey={fieldKey}
        taskId={taskId}
        currentRecordId={currentRecordId}
        onChange={(val) => onChange(val)}
        readOnly={readOnly}
        targetDefinitionId={(fieldDef as FieldDef & { targetDefinitionId?: string })?.targetDefinitionId}
      />
    );
  }

  // User field type - uses UserMentionInput with @mention support
  if (type === 'user') {
    return (
      <UserMentionInput
        value={value}
        onChange={onChange}
        readOnly={readOnly}
      />
    );
  }

  // Tags field type - uses TagsInput for array of strings
  if (type === 'tags') {
    return (
      <TagsInput
        value={value}
        onChange={onChange}
        readOnly={readOnly}
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

  // Status field - colored pill buttons matching workflow table
  if (type === 'status') {
    const currentStatus = (value as TaskStatus) || 'empty';
    return (
      <div className="flex gap-1 flex-wrap">
        {STATUS_OPTIONS.map((status) => {
          const cfg = TASK_STATUS_CONFIG[status];
          const isSelected = status === currentStatus;
          return (
            <button
              key={status}
              type="button"
              onClick={() => !readOnly && onChange(status)}
              disabled={readOnly}
              className={clsx(
                'px-2 h-7 rounded text-xs font-semibold transition-all',
                isSelected ? cfg.colorClass : 'bg-slate-100 text-slate-400 hover:bg-slate-200',
                readOnly && 'cursor-default'
              )}
            >
              {cfg.label || 'Empty'}
            </button>
          );
        })}
      </div>
    );
  }

  // Percent field - slider with visual bar
  if (type === 'percent') {
    const percent = typeof value === 'number' ? value : parseInt(String(value || '0'), 10) || 0;
    const clampedPercent = Math.max(0, Math.min(100, percent));
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="100"
            value={clampedPercent}
            onChange={(e) => onChange(parseInt(e.target.value, 10))}
            disabled={readOnly}
            className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <span className="w-12 text-right text-sm font-medium text-slate-700 tabular-nums">
            {clampedPercent}%
          </span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${clampedPercent}%` }}
          />
        </div>
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

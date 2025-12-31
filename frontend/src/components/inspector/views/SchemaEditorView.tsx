import { useState } from 'react';
import { Copy, AlertCircle, Trash2, Pin } from 'lucide-react';
import { clsx } from 'clsx';
import { useUIStore } from '../../../stores/uiStore';
import { EmojiPicker } from '../../common/EmojiPicker';
import { CloneExcludedToggle } from '../../common/CloneExcludedToggle';
import {
  useNode,
  useRecord,
  useRecordDefinitions,
  useUpdateDefinition,
  useCreateDefinition,
  useDeleteDefinition,
} from '../../../api/hooks';
import type { NodeType, FieldDef, RecordDefinition } from '../../../types';

const STYLE_COLORS = [
  { name: 'orange', class: 'bg-orange-500' },
  { name: 'blue', class: 'bg-blue-500' },
  { name: 'purple', class: 'bg-purple-500' },
  { name: 'green', class: 'bg-green-500' },
  { name: 'red', class: 'bg-red-500' },
  { name: 'slate', class: 'bg-slate-500' },
];

interface SchemaEditorViewProps {
  itemId: string;
  isNode: boolean;
}

/**
 * SchemaEditorView - Edit record/node definition schema
 *
 * Shows:
 * - Definition header with clone/delete actions
 * - Field list with add/remove
 * - Styling options (icon, color)
 * - Pinned toggle for quick create
 */
export function SchemaEditorView({ itemId, isNode }: SchemaEditorViewProps) {
  const { openDrawer, setInspectorMode } = useUIStore();
  const [isCreatingDefinition, setIsCreatingDefinition] = useState(false);

  const { data: node } = useNode(isNode ? itemId : null);
  const { data: record } = useRecord(isNode ? null : itemId);
  const { data: definitions, refetch: refetchDefinitions } = useRecordDefinitions();
  const updateDefinition = useUpdateDefinition();
  const createDefinition = useCreateDefinition();
  const deleteDefinition = useDeleteDefinition();

  const item = node || record;
  if (!item) return null;

  const nodeType = isNode ? (item as { type: NodeType }).type : 'record';
  const definitionId = !isNode ? (item as { definition_id: string }).definition_id : null;

  // Find definition for this item
  let definition: RecordDefinition | undefined;
  const typeName = nodeType.charAt(0).toUpperCase() + nodeType.slice(1);

  if (definitionId && definitions) {
    definition = definitions.find((d) => d.id === definitionId);
  } else if (isNode && definitions) {
    definition = definitions.find((d) => d.name === typeName);
  }

  const fields = definition?.schema_config?.fields || [];
  const currentColor = definition?.styling?.color || 'orange';

  // Auto-create definition for node types if it doesn't exist
  const handleCreateDefinition = async () => {
    if (definition || !isNode) return;

    setIsCreatingDefinition(true);
    try {
      await createDefinition.mutateAsync({
        name: typeName,
        schemaConfig: { fields: [] },
        styling: { color: 'slate' },
      });
      await refetchDefinitions();
    } catch (err) {
      console.error('Failed to create definition:', err);
    } finally {
      setIsCreatingDefinition(false);
    }
  };

  const confirmDeleteDefinition = () => {
    if (!definition) return;
    openDrawer('confirm-delete', {
      title: 'Delete Definition',
      message: `Are you sure you want to delete the "${definition.name}" definition? This action cannot be undone.`,
      itemName: definition.name,
      onConfirm: async () => {
        await deleteDefinition.mutateAsync(definition.id);
        setInspectorMode('record');
      },
    });
  };

  const handleAddField = async (field: FieldDef) => {
    if (!definition) return;

    const updatedFields = [...fields, field];
    await updateDefinition.mutateAsync({
      id: definition.id,
      schemaConfig: { fields: updatedFields },
    });
  };

  const handleRemoveField = async (fieldKey: string) => {
    if (!definition) return;

    const updatedFields = fields.filter((f) => f.key !== fieldKey);
    await updateDefinition.mutateAsync({
      id: definition.id,
      schemaConfig: { fields: updatedFields },
    });
  };

  const confirmRemoveField = (fieldKey: string) => {
    openDrawer('confirm-delete', {
      title: 'Delete Field',
      message: `Are you sure you want to delete the "${fieldKey}" field? This will remove it from all records of this type.`,
      onConfirm: async () => handleRemoveField(fieldKey),
    });
  };

  const handleColorChange = async (color: string) => {
    if (!definition) return;

    await updateDefinition.mutateAsync({
      id: definition.id,
      styling: { ...definition.styling, color },
    });
  };

  const handleEmojiChange = async (emoji: string) => {
    if (!definition) return;

    await updateDefinition.mutateAsync({
      id: definition.id,
      styling: { ...definition.styling, icon: emoji },
    });
  };

  const handlePinnedChange = async (pinned: boolean) => {
    if (!definition) return;

    await updateDefinition.mutateAsync({
      id: definition.id,
      pinned,
    });
  };

  const openCloneDrawer = () => {
    if (!definition) return;
    openDrawer('clone-definition', {
      definitionName: definition.name,
      onClone: async (name: string) => {
        await createDefinition.mutateAsync({
          name: name,
          schemaConfig: definition.schema_config,
          styling: definition.styling,
        });
      },
    });
  };

  const openAddFieldDrawer = () => {
    openDrawer('add-field', {
      onSubmit: handleAddField,
      isPending: updateDefinition.isPending,
    });
  };

  // System fields that can't be deleted
  const systemFields = ['title', 'name'];

  return (
    <div className="fade-in space-y-6">
      <div className="bg-slate-800 text-slate-100 rounded-lg p-4 shadow-md">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">
              Editing Class Definition
            </div>
            <div className="text-lg font-bold capitalize">
              {definition?.name || nodeType} Record
            </div>
          </div>
          <div className="flex gap-2">
            {definition && <CloneExcludedToggle definition={definition} theme="dark" />}
            <button
              onClick={openCloneDrawer}
              disabled={!definition}
              className="text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-2 py-1 rounded flex items-center gap-1"
            >
              <Copy size={12} />
              Clone
            </button>
            <button
              onClick={confirmDeleteDefinition}
              disabled={!definition}
              className="text-xs bg-slate-700 hover:bg-red-600 disabled:opacity-50 px-2 py-1 rounded flex items-center gap-1"
              title="Delete Type"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          Changes here affect all "{definition?.name || nodeType}" records in this Project
          unless you fork this type.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100 pb-2">
          Defined Fields
        </h4>

        {!definition ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded">
              <AlertCircle size={16} />
              <span>No schema definition found for "{typeName}" type.</span>
            </div>
            {isNode && (
              <button
                onClick={handleCreateDefinition}
                disabled={isCreatingDefinition}
                className="w-full py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isCreatingDefinition ? 'Creating...' : `Create "${typeName}" Definition`}
              </button>
            )}
          </div>
        ) : fields.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No fields defined yet.</p>
        ) : (
          fields.map((field) => {
            const isSystem = systemFields.includes(field.key);
            return (
              <div
                key={field.key}
                className={`flex items-center justify-between p-2 ${
                  isSystem ? 'bg-slate-50' : 'bg-white'
                } border border-slate-200 rounded hover:shadow-sm transition-all group`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-mono ${
                      field.type === 'link' ? 'text-blue-500' : 'text-slate-400'
                    }`}
                  >
                    {field.type}
                  </span>
                  <span className="text-sm font-semibold text-slate-700">{field.label}</span>
                  {field.required && <span className="text-[10px] text-red-500">*</span>}
                </div>
                {isSystem ? (
                  <span className="text-[10px] text-slate-400">System Required</span>
                ) : (
                  <button
                    onClick={() => confirmRemoveField(field.key)}
                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-lg"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })
        )}

        {/* Add Field Button */}
        <button
          onClick={openAddFieldDrawer}
          disabled={!definition}
          className="w-full py-2 border border-dashed border-blue-300 bg-blue-50 text-blue-600 rounded text-xs font-medium hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          + Add New Field Definition
        </button>
      </div>

      {/* Styling Override */}
      {definition && (
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-400 uppercase">Class Styling</h4>
          <div className="flex items-center gap-4">
            {/* Emoji Picker */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-medium">Icon</span>
              <EmojiPicker
                value={definition.styling?.icon}
                onChange={handleEmojiChange}
                size="md"
              />
            </div>

            {/* Color Picker */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-medium">Color</span>
              <div className="flex items-center gap-1.5">
                {STYLE_COLORS.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => handleColorChange(color.name)}
                    className={`w-6 h-6 rounded ${color.class} cursor-pointer transition-all ${
                      currentColor === color.name
                        ? 'ring-2 ring-offset-1 ring-current opacity-100'
                        : 'opacity-30 hover:opacity-100'
                    }`}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Pinned Toggle */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Pin size={14} className={definition.pinned ? 'text-blue-500' : 'text-slate-400'} />
              <span className="text-xs text-slate-600">Pin to Quick Create</span>
            </div>
            <button
              onClick={() => handlePinnedChange(!definition.pinned)}
              className={clsx(
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                definition.pinned ? 'bg-blue-500' : 'bg-slate-300'
              )}
            >
              <span
                className={clsx(
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                  definition.pinned ? 'translate-x-4' : 'translate-x-0.5'
                )}
              />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            When pinned, this record type appears in the quick create menu in the hierarchy
            sidebar.
          </p>
        </div>
      )}
    </div>
  );
}

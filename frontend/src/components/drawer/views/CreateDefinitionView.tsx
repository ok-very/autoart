import { useState } from 'react';
import { Plus, Palette } from 'lucide-react';
import { useUIStore } from '../../../stores/uiStore';
import { useCreateDefinition } from '../../../api/hooks';
import type { DrawerProps, CreateDefinitionContext } from '../../../drawer/types';

const PRESET_COLORS = [
  { name: 'slate', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },
  { name: 'blue', bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-300' },
  { name: 'green', bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-300' },
  { name: 'amber', bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-300' },
  { name: 'red', bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-300' },
  { name: 'purple', bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-300' },
  { name: 'pink', bg: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-300' },
  { name: 'cyan', bg: 'bg-cyan-100', text: 'text-cyan-600', border: 'border-cyan-300' },
];

const PRESET_EMOJIS = ['📋', '📁', '👤', '🏢', '🎨', '📦', '🔧', '📝', '💼', '🏷️', '📊', '🎯'];

// Legacy props interface (deprecated - use DrawerProps)
interface LegacyCreateDefinitionViewProps {
  copyFromId?: string;
}

// New contract props
type CreateDefinitionViewProps = DrawerProps<CreateDefinitionContext, { definitionId: string }>;

// Type guard to detect legacy vs new props
function isDrawerProps(props: unknown): props is CreateDefinitionViewProps {
  return typeof props === 'object' && props !== null && 'context' in props && 'onSubmit' in props;
}

export function CreateDefinitionView(props: CreateDefinitionViewProps | LegacyCreateDefinitionViewProps | Record<string, never> = {}) {
  // Handle both legacy and new contract
  const isNewContract = isDrawerProps(props);
  const onClose = isNewContract ? props.onClose : undefined;
  const onSubmit = isNewContract ? props.onSubmit : undefined;

  const { closeDrawer } = useUIStore();
  const createDefinition = useCreateDefinition();

  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');
  const [selectedEmoji, setSelectedEmoji] = useState('📋');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Close handler that works with both contracts
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      closeDrawer();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const result = await createDefinition.mutateAsync({
        name: name.trim(),
        schemaConfig: {
          fields: [
            { key: 'name', label: 'Name', type: 'text', required: true },
          ],
        },
        styling: {
          color: selectedColor,
          icon: selectedEmoji,
        },
      });

      if (onSubmit) {
        // New contract: emit typed result
        onSubmit({
          success: true,
          data: { definitionId: result.definition?.id || '' },
          sideEffects: [{ type: 'create', entityType: 'definition' }],
        });
      } else {
        // Legacy: close
        closeDrawer();
      }
    } catch (err) {
      console.error('Failed to create definition:', err);
      if (onSubmit) {
        onSubmit({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to create definition',
        });
      }
    }
  };

  const selectedColorConfig = PRESET_COLORS.find((c) => c.name === selectedColor) || PRESET_COLORS[1];

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className={`w-12 h-12 rounded-lg ${selectedColorConfig.bg} flex items-center justify-center text-2xl`}
        >
          {selectedEmoji}
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase">
            Create New
          </div>
          <h2 className="text-xl font-bold text-slate-800">Record Type</h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Contact, Artwork, Invoice..."
            className="w-full text-sm border border-slate-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
          />
          <p className="mt-1 text-xs text-slate-400">
            This will be the display name for this record type
          </p>
        </div>

        {/* Styling Section */}
        <div className="space-y-4">
          <div className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Palette size={16} />
            Appearance
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => setSelectedColor(color.name)}
                  className={`w-8 h-8 rounded-lg ${color.bg} ${selectedColor === color.name
                    ? `ring-2 ring-offset-1 ring-${color.name}-500`
                    : 'hover:ring-1 hover:ring-slate-300'
                    } transition-all`}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Emoji Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">
              Icon
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`w-12 h-12 rounded-lg ${selectedColorConfig.bg} flex items-center justify-center text-2xl hover:ring-2 hover:ring-slate-300 transition-all`}
              >
                {selectedEmoji}
              </button>

              {showEmojiPicker && (
                <div className="absolute top-full left-0 mt-2 p-2 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                  <div className="grid grid-cols-6 gap-1">
                    {PRESET_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setSelectedEmoji(emoji);
                          setShowEmojiPicker(false);
                        }}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl hover:bg-slate-100 transition-colors ${selectedEmoji === emoji ? 'bg-blue-50 ring-1 ring-blue-300' : ''
                          }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <input
                      type="text"
                      placeholder="Or type any emoji..."
                      className="w-full text-sm border border-slate-200 rounded px-2 py-1"
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedEmoji(e.target.value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          setShowEmojiPicker(false);
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="text-xs font-medium text-slate-400 mb-2">Preview</div>
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg ${selectedColorConfig.bg} flex items-center justify-center text-lg`}
            >
              {selectedEmoji}
            </div>
            <div>
              <div className="text-sm font-medium text-slate-700">
                {name.trim() || 'Record Type Name'}
              </div>
              <div className="text-xs text-slate-400">0 records</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || createDefinition.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {createDefinition.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus size={16} />
                Create Type
              </>
            )}
          </button>
        </div>

        {createDefinition.isError && (
          <p className="text-sm text-red-600">
            Failed to create definition. Please try again.
          </p>
        )}
      </form>
    </div>
  );
}

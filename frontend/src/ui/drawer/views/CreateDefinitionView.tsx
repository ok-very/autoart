/**
 * CreateDefinitionView
 *
 * Drawer view for creating new record or action definitions.
 */

import { Plus, Palette } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

import { useCreateDefinition } from '@/api/hooks';
import { useUIStore } from '@/stores';

import type { DrawerProps, CreateDefinitionContext } from '../../../drawer/types';
import { Button } from '@autoart/ui';
import { Inline } from '@autoart/ui';
import { Stack } from '@autoart/ui';
import { Text } from '@autoart/ui';
import { TextInput } from '@autoart/ui';

const PRESET_COLORS = [
  { name: 'slate', hex: '#64748b' },
  { name: 'blue', hex: '#3b82f6' },
  { name: 'green', hex: '#22c55e' },
  { name: 'amber', hex: '#f59e0b' },
  { name: 'red', hex: '#ef4444' },
  { name: 'purple', hex: '#a855f7' },
  { name: 'pink', hex: '#ec4899' },
  { name: 'cyan', hex: '#06b6d4' },
];

const PRESET_EMOJIS = ['📋', '📁', '👤', '🏢', '🎨', '📦', '🔧', '📝', '💼', '🏷️', '📊', '🎯'];

// Legacy props interface (deprecated - use DrawerProps)
interface LegacyCreateDefinitionViewProps {
  copyFromId?: string;
  definitionKind?: 'record' | 'action_arrangement';
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

  // Get definitionKind from props (defaults to 'record')
  const definitionKind = (props as { definitionKind?: string }).definitionKind ?? 'record';
  const isActionArrangement = definitionKind === 'action_arrangement';

  const { closeDrawer } = useUIStore();
  const createDefinition = useCreateDefinition();

  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');
  const [selectedEmoji, setSelectedEmoji] = useState('📋');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Close emoji picker on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setEmojiPickerOpen(false);
      }
    }
    if (emojiPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [emojiPickerOpen]);

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
      <Inline gap="sm" className="mb-6">
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${selectedColorConfig.hex}20` }}
        >
          {selectedEmoji}
        </div>
        <Stack gap="none">
          <Text size="xs" weight="bold" color="muted" className="uppercase">
            Create New
          </Text>
          <Text size="xl" weight="bold">
            {isActionArrangement ? 'Action Definition' : 'Record Definition'}
          </Text>
        </Stack>
      </Inline>

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Name */}
          <TextInput
            label="Name"
            placeholder="e.g., Contact, Artwork, Invoice..."
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
            autoFocus
            description={`This will be the display name for this ${isActionArrangement ? 'action' : 'record'} definition`}
          />

          {/* Styling Section */}
          <Stack gap="xs">
            <Inline gap="xs">
              <Palette size={16} />
              <Text size="sm" weight="medium">Appearance</Text>
            </Inline>

            {/* Color Selection */}
            <div>
              <Text size="xs" color="muted" className="mb-2">Color</Text>
              <Inline gap="xs">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    className="w-8 h-8 rounded-full cursor-pointer"
                    style={{
                      backgroundColor: color.hex,
                      outline: selectedColor === color.name
                        ? `2px solid ${color.hex}`
                        : 'none',
                      outlineOffset: 2,
                    }}
                    onClick={() => setSelectedColor(color.name)}
                    aria-label={`Select ${color.name} color`}
                  />
                ))}
              </Inline>
            </div>

            {/* Emoji Selection */}
            <div>
              <Text size="xs" color="muted" className="mb-2">Icon</Text>
              <div className="relative" ref={emojiPickerRef}>
                <button
                  type="button"
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl cursor-pointer hover:ring-2 hover:ring-slate-300 transition-all"
                  style={{ backgroundColor: `${selectedColorConfig.hex}20` }}
                  onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
                >
                  {selectedEmoji}
                </button>
                {emojiPickerOpen && (
                  <div className="absolute top-full left-0 mt-1 z-10 bg-white border border-slate-200 rounded-lg shadow-md p-2">
                    <div className="grid grid-cols-6 gap-1">
                      {PRESET_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl cursor-pointer hover:bg-slate-100 transition-colors"
                          style={{
                            backgroundColor: selectedEmoji === emoji ? '#dbeafe' : undefined,
                          }}
                          onClick={() => {
                            setSelectedEmoji(emoji);
                            setEmojiPickerOpen(false);
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <TextInput
                      placeholder="Or type any emoji..."
                      size="sm"
                      className="mt-2"
                      onChange={(e) => {
                        if (e.currentTarget.value) {
                          setSelectedEmoji(e.currentTarget.value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          setEmojiPickerOpen(false);
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </Stack>

          {/* Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <Text size="xs" color="muted" className="mb-2">Preview</Text>
            <Inline gap="sm">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                style={{ backgroundColor: `${selectedColorConfig.hex}20` }}
              >
                {selectedEmoji}
              </div>
              <Stack gap="none">
                <Text size="sm" weight="medium">
                  {name.trim() || (isActionArrangement ? 'Action Definition Name' : 'Record Definition Name')}
                </Text>
                <Text size="xs" color="muted">0 records</Text>
              </Stack>
            </Inline>
          </div>

          {/* Actions */}
          <Inline justify="end" gap="sm" className="pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || createDefinition.isPending}
              leftSection={<Plus size={16} />}
            >
              {createDefinition.isPending ? 'Creating...' : 'Create Definition'}
            </Button>
          </Inline>

          {createDefinition.isError && (
            <Text size="sm" color="error">
              Failed to create definition. Please try again.
            </Text>
          )}
        </Stack>
      </form>
    </div>
  );
}

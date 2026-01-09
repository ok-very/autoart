/**
 * CreateDefinitionView
 *
 * Drawer view for creating new record or action definitions using Mantine.
 */

import { useState } from 'react';
import { Plus, Palette } from 'lucide-react';
import {
  TextInput, Button, Stack, Group, Text, Paper, SimpleGrid,
  ColorSwatch, Popover, Box, ThemeIcon
} from '@mantine/core';
import { useUIStore } from '../../../stores/uiStore';
import { useCreateDefinition } from '../../../api/hooks';
import type { DrawerProps, CreateDefinitionContext } from '../../../drawer/types';

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
  definitionKind?: 'record' | 'action_recipe';
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
  const isActionRecipe = definitionKind === 'action_recipe';

  const { closeDrawer } = useUIStore();
  const createDefinition = useCreateDefinition();

  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');
  const [selectedEmoji, setSelectedEmoji] = useState('📋');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

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
    <Box maw={480} mx="auto">
      {/* Header */}
      <Group gap="sm" mb="lg">
        <Box
          w={48}
          h={48}
          className="rounded-lg flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${selectedColorConfig.hex}20` }}
        >
          {selectedEmoji}
        </Box>
        <Stack gap={0}>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">
            Create New
          </Text>
          <Text size="xl" fw={700}>
            {isActionRecipe ? 'Action Definition' : 'Record Definition'}
          </Text>
        </Stack>
      </Group>

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
            description={`This will be the display name for this ${isActionRecipe ? 'action' : 'record'} definition`}
          />

          {/* Styling Section */}
          <Stack gap="xs">
            <Group gap="xs">
              <Palette size={16} />
              <Text size="sm" fw={500}>Appearance</Text>
            </Group>

            {/* Color Selection */}
            <Box>
              <Text size="xs" c="dimmed" mb={8}>Color</Text>
              <Group gap="xs">
                {PRESET_COLORS.map((color) => (
                  <ColorSwatch
                    key={color.name}
                    color={color.hex}
                    size={32}
                    onClick={() => setSelectedColor(color.name)}
                    style={{
                      cursor: 'pointer',
                      outline: selectedColor === color.name
                        ? `2px solid ${color.hex}`
                        : 'none',
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </Group>
            </Box>

            {/* Emoji Selection */}
            <Box>
              <Text size="xs" c="dimmed" mb={8}>Icon</Text>
              <Popover
                opened={emojiPickerOpen}
                onChange={setEmojiPickerOpen}
                position="bottom-start"
                shadow="md"
              >
                <Popover.Target>
                  <Box
                    w={48}
                    h={48}
                    className="rounded-lg flex items-center justify-center text-2xl cursor-pointer hover:ring-2 hover:ring-slate-300 transition-all"
                    style={{ backgroundColor: `${selectedColorConfig.hex}20` }}
                    onClick={() => setEmojiPickerOpen(true)}
                  >
                    {selectedEmoji}
                  </Box>
                </Popover.Target>
                <Popover.Dropdown>
                  <SimpleGrid cols={6} spacing={4}>
                    {PRESET_EMOJIS.map((emoji) => (
                      <Box
                        key={emoji}
                        w={40}
                        h={40}
                        className="rounded-lg flex items-center justify-center text-xl cursor-pointer hover:bg-slate-100 transition-colors"
                        style={{
                          backgroundColor: selectedEmoji === emoji ? 'var(--mantine-color-blue-0)' : undefined,
                        }}
                        onClick={() => {
                          setSelectedEmoji(emoji);
                          setEmojiPickerOpen(false);
                        }}
                      >
                        {emoji}
                      </Box>
                    ))}
                  </SimpleGrid>
                  <TextInput
                    placeholder="Or type any emoji..."
                    size="xs"
                    mt="sm"
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
                </Popover.Dropdown>
              </Popover>
            </Box>
          </Stack>

          {/* Preview */}
          <Paper withBorder p="md" radius="md" className="bg-slate-50">
            <Text size="xs" c="dimmed" mb="xs">Preview</Text>
            <Group gap="sm">
              <Box
                w={40}
                h={40}
                className="rounded-lg flex items-center justify-center text-lg"
                style={{ backgroundColor: `${selectedColorConfig.hex}20` }}
              >
                {selectedEmoji}
              </Box>
              <Stack gap={0}>
                <Text size="sm" fw={500}>
                  {name.trim() || (isActionRecipe ? 'Action Definition Name' : 'Record Definition Name')}
                </Text>
                <Text size="xs" c="dimmed">0 records</Text>
              </Stack>
            </Group>
          </Paper>

          {/* Actions */}
          <Group justify="flex-end" gap="sm" pt="md" className="border-t border-slate-100">
            <Button variant="default" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim()}
              loading={createDefinition.isPending}
              leftSection={<Plus size={16} />}
            >
              Create Definition
            </Button>
          </Group>

          {createDefinition.isError && (
            <Text size="sm" c="red">
              Failed to create definition. Please try again.
            </Text>
          )}
        </Stack>
      </form>
    </Box>
  );
}

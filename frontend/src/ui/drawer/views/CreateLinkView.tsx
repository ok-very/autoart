/**
 * CreateLinkView
 *
 * Drawer view for creating record links using Mantine.
 */

import { useState } from 'react';
import { Link2 } from 'lucide-react';
import {
  TextInput, Button, Stack, Group, Text, Select, Paper, Box, Loader
} from '@mantine/core';
import { useUIStore } from '../../../stores/uiStore';
import { useCreateLink, useLinkTypes, useSearch } from '../../../api/hooks';
import { useDebounce } from '../../../hooks/useDebounce';
import type { DrawerProps, CreateLinkContext } from '../../../drawer/types';

// Legacy props interface (deprecated - use DrawerProps)
interface LegacyCreateLinkViewProps {
  sourceRecordId: string;
}

// New contract props
type CreateLinkViewProps = DrawerProps<CreateLinkContext, { linkId: string }>;

// Type guard to detect legacy vs new props
function isDrawerProps(props: unknown): props is CreateLinkViewProps {
  return typeof props === 'object' && props !== null && 'context' in props && 'onSubmit' in props;
}

export function CreateLinkView(props: CreateLinkViewProps | LegacyCreateLinkViewProps) {
  // Handle both legacy and new contract
  const isNewContract = isDrawerProps(props);
  const sourceRecordId = isNewContract ? props.context.sourceRecordId : props.sourceRecordId;
  const onClose = isNewContract ? props.onClose : undefined;
  const onSubmit = isNewContract ? props.onSubmit : undefined;

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<string | null>('related_to');

  const { closeDrawer } = useUIStore();
  const createLink = useCreateLink();
  const { data: linkTypes } = useLinkTypes();
  const { data: searchResults, isLoading: isSearching } = useSearch(debouncedQuery, undefined, !!debouncedQuery && debouncedQuery.length > 1);

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
    if (!selectedTargetId || !linkType) return;

    try {
      const result = await createLink.mutateAsync({
        sourceRecordId,
        targetRecordId: selectedTargetId,
        linkType,
        metadata: {} // Default empty metadata
      });

      if (onSubmit) {
        // New contract: emit typed result
        onSubmit({
          success: true,
          data: { linkId: result.link?.id || '' },
          sideEffects: [{ type: 'create', entityType: 'link' }],
        });
      } else {
        // Legacy: close
        closeDrawer();
      }
    } catch (err) {
      console.error('Failed to create link:', err);
      if (onSubmit) {
        onSubmit({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to create link',
        });
      }
    }
  };

  const records = searchResults?.filter(r => r.type === 'record' && r.id !== sourceRecordId) || [];

  return (
    <Box maw={560} mx="auto" className="flex flex-col h-full">
      <Stack gap={4} mb="md">
        <Text size="lg" fw={700}>Create Record Link</Text>
        <Text size="sm" c="dimmed">
          Search for a target record and select a relationship type.
        </Text>
      </Stack>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
        <Stack gap="md" className="flex-1 min-h-0">
          <Select
            label="Link Type"
            value={linkType}
            onChange={setLinkType}
            data={linkTypes?.map(t => ({ value: t, label: t })) || [{ value: 'related_to', label: 'related_to' }]}
          />

          <Box className="flex-1 flex flex-col min-h-0">
            <TextInput
              label="Target Record"
              placeholder="Search for a record..."
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              autoFocus
              mb="xs"
            />

            <Paper
              withBorder
              p="xs"
              radius="md"
              className="flex-1 overflow-y-auto bg-slate-50"
              style={{ minHeight: 200 }}
            >
              {isSearching ? (
                <Group justify="center" p="lg">
                  <Loader size="sm" />
                  <Text size="sm" c="dimmed">Searching...</Text>
                </Group>
              ) : records.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" p="lg">
                  {query.length < 2 ? 'Type at least 2 characters to search' : 'No records found'}
                </Text>
              ) : (
                <Stack gap="xs">
                  {records.map(record => (
                    <Paper
                      key={record.id}
                      withBorder
                      p="sm"
                      radius="sm"
                      className={`cursor-pointer transition-colors ${selectedTargetId === record.id
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-white hover:border-blue-300'
                        }`}
                      onClick={() => setSelectedTargetId(record.id)}
                    >
                      <Group gap="xs" wrap="nowrap">
                        <Link2 size={14} className={selectedTargetId === record.id ? 'text-blue-500' : 'text-slate-400'} />
                        <Stack gap={0}>
                          <Text size="sm" fw={500}>{record.name}</Text>
                          {record.definitionName && (
                            <Text size="xs" c="dimmed">{record.definitionName}</Text>
                          )}
                        </Stack>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Paper>
          </Box>

          <Group justify="flex-end" gap="sm" pt="md" className="border-t border-slate-100">
            <Button variant="default" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!selectedTargetId}
              loading={createLink.isPending}
              leftSection={<Link2 size={16} />}
            >
              Create Link
            </Button>
          </Group>
        </Stack>
      </form>
    </Box>
  );
}

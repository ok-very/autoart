/**
 * CreateLinkView
 *
 * Drawer view for creating record links.
 */

import { Link2 } from 'lucide-react';
import { useState } from 'react';

import { useCreateLink, useLinkTypes, useSearch } from '@/api/hooks';
import { useUIStore } from '@/stores';

import type { DrawerProps, CreateLinkContext } from '../../../drawer/types';
import { useDebounce } from '../../../hooks/useDebounce';
import { Button } from '@autoart/ui';
import { Inline } from '@autoart/ui';
import { Select } from '@autoart/ui';
import { Spinner } from '@autoart/ui';
import { Stack } from '@autoart/ui';
import { Text } from '@autoart/ui';
import { TextInput } from '@autoart/ui';

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
    <div className="max-w-xl mx-auto flex flex-col h-full">
      <Stack gap="xs" className="mb-4">
        <Text size="lg" weight="bold">Create Record Link</Text>
        <Text size="sm" color="dimmed">
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

          <div className="flex-1 flex flex-col min-h-0">
            <div className="mb-2">
              <TextInput
                label="Target Record"
                placeholder="Search for a record..."
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
                autoFocus
              />
            </div>

            <div
              className="flex-1 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-2"
              style={{ minHeight: 200 }}
            >
              {isSearching ? (
                <Inline justify="center" className="p-6">
                  <Spinner size="sm" />
                  <Text size="sm" color="dimmed">Searching...</Text>
                </Inline>
              ) : records.length === 0 ? (
                <Text size="sm" color="dimmed" className="text-center block p-6">
                  {query.length < 2 ? 'Type at least 2 characters to search' : 'No records found'}
                </Text>
              ) : (
                <Stack gap="xs">
                  {records.map(record => (
                    <div
                      key={record.id}
                      className={`cursor-pointer transition-colors border rounded p-3 ${selectedTargetId === record.id
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-white border-slate-200 hover:border-blue-300'
                        }`}
                      onClick={() => setSelectedTargetId(record.id)}
                    >
                      <Inline gap="xs" wrap={false}>
                        <Link2 size={14} className={selectedTargetId === record.id ? 'text-blue-500' : 'text-slate-400'} />
                        <Stack gap="none">
                          <Text size="sm" weight="medium">{record.name}</Text>
                          {record.definitionName && (
                            <Text size="xs" color="dimmed">{record.definitionName}</Text>
                          )}
                        </Stack>
                      </Inline>
                    </div>
                  ))}
                </Stack>
              )}
            </div>
          </div>

          <Inline justify="end" gap="sm" className="pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!selectedTargetId || createLink.isPending}
              leftSection={<Link2 size={16} />}
            >
              {createLink.isPending ? 'Creating...' : 'Create Link'}
            </Button>
          </Inline>
        </Stack>
      </form>
    </div>
  );
}

/**
 * StreamingGallery Component
 *
 * Displays a real-time grid of artifacts as they stream in.
 * Supports bulk selection and shows collection progress.
 */

import { Stack, Text, Button, Inline, ProgressBar } from '@autoart/ui';
import { CheckSquare, Square, Loader2 } from 'lucide-react';
import type { ArtifactPreview, StreamProgress } from '../types';
import { ArtifactCard } from './ArtifactCard';

export interface StreamingGalleryProps {
  artifacts: ArtifactPreview[];
  selectedIds: Set<string>;
  isStreaming: boolean;
  progress: StreamProgress;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function StreamingGallery({
  artifacts,
  selectedIds,
  isStreaming,
  progress,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
}: StreamingGalleryProps) {
  const allSelected = artifacts.length > 0 && selectedIds.size === artifacts.length;
  const noneSelected = selectedIds.size === 0;

  const progressText = getProgressText(progress, artifacts.length, selectedIds.size);

  return (
    <Stack className="h-full" gap="md">
      {/* Toolbar */}
      <Inline justify="between" align="center" className="flex-shrink-0">
        <Inline gap="sm" align="center">
          {isStreaming && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
          <Text size="sm" color="muted">
            {progressText}
          </Text>
        </Inline>
        <Inline gap="xs">
          <Button
            variant="secondary"
            size="sm"
            onClick={onSelectAll}
            disabled={allSelected || artifacts.length === 0}
          >
            <CheckSquare className="w-4 h-4 mr-1" />
            Select All
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onDeselectAll}
            disabled={noneSelected}
          >
            <Square className="w-4 h-4 mr-1" />
            Deselect All
          </Button>
        </Inline>
      </Inline>

      {/* Progress bar during streaming */}
      {isStreaming && progress.stage !== 'idle' && (
        <div className="flex-shrink-0">
          <ProgressBar value={progress.percent} size="sm" />
        </div>
      )}

      {/* Gallery grid */}
      <div className="flex-1 overflow-auto">
        {artifacts.length === 0 ? (
          <EmptyState isStreaming={isStreaming} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {artifacts.map((artifact) => (
              <ArtifactCard
                key={artifact.ref_id}
                artifact={artifact}
                isSelected={selectedIds.has(artifact.ref_id)}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </div>
        )}
      </div>
    </Stack>
  );
}

function EmptyState({ isStreaming }: { isStreaming: boolean }) {
  return (
    <div className="h-full flex items-center justify-center">
      <Stack align="center" gap="sm">
        {isStreaming ? (
          <>
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <Text color="muted">Waiting for artifacts...</Text>
          </>
        ) : (
          <>
            <Text color="muted">No artifacts collected yet</Text>
            <Text size="sm" color="muted">
              Click "Start Collection" to begin streaming
            </Text>
          </>
        )}
      </Stack>
    </div>
  );
}

function getProgressText(
  progress: StreamProgress,
  totalArtifacts: number,
  selectedCount: number
): string {
  if (progress.stage === 'idle') {
    return 'Ready to collect';
  }

  if (progress.stage === 'connecting') {
    return 'Connecting...';
  }

  if (progress.stage === 'error') {
    return `Error: ${progress.message || 'Unknown error'}`;
  }

  if (progress.stage === 'complete') {
    return `${totalArtifacts} collected, ${selectedCount} selected`;
  }

  // Streaming
  if (progress.total && progress.current) {
    return `${progress.current} of ~${progress.total} collected, ${selectedCount} selected`;
  }

  return `${totalArtifacts} collected, ${selectedCount} selected`;
}

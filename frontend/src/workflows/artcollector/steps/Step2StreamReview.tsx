/**
 * Step 2: Stream & Review
 *
 * Stream incoming artifacts in real-time from AutoHelper/Playwright.
 * Allows select/discard before proceeding to text & slugs.
 *
 * TODO: Implement SSE streaming, progressive image grid, bulk actions
 */

import { Stack, Text, Button, Inline } from '@autoart/ui';
import { useArtCollectorContext } from '../context/ArtCollectorContext';
import type { ArtCollectorStepProps } from '../types';

export function Step2StreamReview({ onNext, onBack }: ArtCollectorStepProps) {
  const { artifacts, selectedIds, sourceType, sourceUrl, sourcePath, isStreaming, setIsStreaming } =
    useArtCollectorContext();

  const source = sourceType === 'web' ? sourceUrl : sourcePath;

  const handleStartCollection = () => {
    // TODO: Implement SSE streaming via useArtifactStream hook
    setIsStreaming(true);
    console.log('Starting collection from:', source);
    // Placeholder: In a real implementation, this would trigger the SSE stream
  };

  return (
    <Stack className="h-full" gap="lg">
      <div>
        <Text size="lg" weight="bold">
          Stream & Review
        </Text>
        <Text size="sm" color="muted" className="mt-1">
          Streaming from: {source}
        </Text>
      </div>

      {/* Placeholder content */}
      <div className="flex-1 border-2 border-dashed border-slate-200 rounded-lg p-8 flex items-center justify-center">
        <Stack align="center" gap="md">
          <Text color="muted">
            {artifacts.length === 0
              ? 'No artifacts streamed yet. Click "Start Collection" to begin.'
              : `${artifacts.length} artifacts collected, ${selectedIds.size} selected`}
          </Text>
          <Button
            variant="primary"
            onClick={handleStartCollection}
            disabled={isStreaming}
          >
            {isStreaming ? 'Collecting...' : 'Start Collection'}
          </Button>
        </Stack>
      </div>

      {/* Footer */}
      <Inline justify="between" className="pt-4 mt-4 border-t border-slate-200 shrink-0">
        <Button onClick={onBack} variant="secondary">
          Back
        </Button>
        <Button onClick={onNext} disabled={selectedIds.size === 0}>
          Next: Text & Slugs
        </Button>
      </Inline>
    </Stack>
  );
}

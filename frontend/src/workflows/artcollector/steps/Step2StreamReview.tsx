/**
 * Step 2: Stream & Review
 *
 * Stream incoming artifacts in real-time from AutoHelper/Playwright.
 * Allows select/discard before proceeding to text & slugs.
 */

import { useCallback, useEffect } from 'react';
import { Stack, Text, Button, Inline } from '@autoart/ui';
import { Play, StopCircle } from 'lucide-react';
import { useArtCollectorContext } from '../context/ArtCollectorContext';
import { useAutoArtifactStream } from '../hooks/useArtifactStream';
import { StreamingGallery } from '../components/StreamingGallery';
import type { ArtCollectorStepProps, ArtifactPreview, StreamProgress } from '../types';

export function Step2StreamReview({ onNext, onBack }: ArtCollectorStepProps) {
  const {
    artifacts,
    selectedIds,
    sourceType,
    sourceUrl,
    sourcePath,
    namingConfig,
    isStreaming,
    setIsStreaming,
    streamProgress,
    setStreamProgress,
    addArtifact,
    toggleArtifactSelection,
    selectAllArtifacts,
    deselectAllArtifacts,
  } = useArtCollectorContext();

  const source = sourceType === 'web' ? sourceUrl : sourcePath;

  // Handle artifact received from stream
  const handleArtifact = useCallback(
    (artifact: ArtifactPreview) => {
      addArtifact(artifact);
    },
    [addArtifact]
  );

  // Handle progress updates
  const handleProgress = useCallback(
    (progress: StreamProgress) => {
      setStreamProgress(progress);
    },
    [setStreamProgress]
  );

  // Handle stream complete
  const handleComplete = useCallback(() => {
    setIsStreaming(false);
  }, [setIsStreaming]);

  // Handle stream error
  const handleError = useCallback(
    (error: Error) => {
      console.error('Stream error:', error);
      setIsStreaming(false);
    },
    [setIsStreaming]
  );

  // Auto-selects between real and mock stream based on environment
  // Set VITE_USE_MOCK_STREAM=false to use real stream in development
  const { startStream, stopStream } = useAutoArtifactStream({
    onArtifact: handleArtifact,
    onProgress: handleProgress,
    onComplete: handleComplete,
    onError: handleError,
  });

  const handleStartCollection = () => {
    setIsStreaming(true);
    startStream({
      sourceType,
      sourceUrl,
      sourcePath,
      namingConfig,
    });
  };

  const handleStopCollection = () => {
    stopStream();
    setIsStreaming(false);
  };

  // Cleanup stream on unmount to prevent resource leaks
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return (
    <Stack className="h-full" gap="lg">
      {/* Header */}
      <Inline justify="between" align="center" className="flex-shrink-0">
        <div>
          <Text size="lg" weight="bold">
            Stream & Review
          </Text>
          <Text size="sm" color="muted" className="mt-1">
            {sourceType === 'web' ? 'URL' : 'Folder'}: {source}
          </Text>
        </div>
        <div>
          {isStreaming ? (
            <Button variant="secondary" onClick={handleStopCollection}>
              <StopCircle className="w-4 h-4 mr-2" />
              Stop Collection
            </Button>
          ) : (
            <Button variant="primary" onClick={handleStartCollection}>
              <Play className="w-4 h-4 mr-2" />
              Start Collection
            </Button>
          )}
        </div>
      </Inline>

      {/* Gallery */}
      <div className="flex-1 min-h-0 border border-ws-panel-border rounded-lg bg-ws-panel-bg p-4 overflow-hidden">
        <StreamingGallery
          artifacts={artifacts}
          selectedIds={selectedIds}
          isStreaming={isStreaming}
          progress={streamProgress}
          onToggleSelect={toggleArtifactSelection}
          onSelectAll={selectAllArtifacts}
          onDeselectAll={deselectAllArtifacts}
        />
      </div>

      {/* Footer */}
      <Inline justify="between" className="pt-4 mt-4 border-t border-ws-panel-border shrink-0">
        <Button onClick={onBack} variant="secondary">
          Back
        </Button>
        <Inline gap="sm" align="center">
          {selectedIds.size > 0 && (
            <Text size="sm" color="muted">
              {selectedIds.size} of {artifacts.length} selected
            </Text>
          )}
          <Button onClick={onNext} disabled={selectedIds.size === 0}>
            Next: Text & Slugs
          </Button>
        </Inline>
      </Inline>
    </Stack>
  );
}

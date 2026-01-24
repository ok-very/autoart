/**
 * useArtifactStream Hook
 *
 * Handles SSE streaming of artifacts from the AutoHelper backend.
 * Provides real-time artifact collection with progress updates.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import type { ArtifactPreview, StreamProgress } from '../types';

export interface StreamConfig {
  sourceType: 'web' | 'local';
  sourceUrl?: string;
  sourcePath?: string;
}

export interface UseArtifactStreamOptions {
  onArtifact: (artifact: ArtifactPreview) => void;
  onProgress: (progress: StreamProgress) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export interface UseArtifactStreamReturn {
  /** Start streaming artifacts from the configured source */
  startStream: (config: StreamConfig) => void;
  /** Stop the current stream */
  stopStream: () => void;
  /** Whether streaming is currently active */
  isStreaming: boolean;
  /** Current stream progress */
  progress: StreamProgress;
  /** Last error if any */
  error: Error | null;
}

/**
 * Hook for streaming artifacts via SSE from the AutoHelper backend
 */
export function useArtifactStream(
  options: UseArtifactStreamOptions
): UseArtifactStreamReturn {
  const { onArtifact, onProgress, onComplete, onError } = options;

  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState<StreamProgress>({
    stage: 'idle',
    percent: 0,
  });
  const [error, setError] = useState<Error | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setProgress({ stage: 'idle', percent: 0 });
  }, []);

  const startStream = useCallback(
    async (config: StreamConfig) => {
      // Stop any existing stream
      stopStream();
      setError(null);
      setIsStreaming(true);
      setProgress({ stage: 'connecting', percent: 0 });

      try {
        abortControllerRef.current = new AbortController();

        // Build the request payload
        const payload = {
          runner_id: 'autocollector',
          config: {
            source_type: config.sourceType,
            source_url: config.sourceUrl,
            source_path: config.sourcePath,
          },
        };

        // For SSE with POST, we need to use fetch + ReadableStream
        // since EventSource only supports GET
        const response = await fetch('/api/runner/invoke/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify(payload),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`Stream failed: ${response.status} ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        setProgress({ stage: 'streaming', percent: 0 });
        onProgress({ stage: 'streaming', percent: 0 });

        // Process the SSE stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                handleStreamEvent(data, onArtifact, onProgress, setProgress);
              } catch (parseError) {
                console.warn('Failed to parse SSE event:', line);
              }
            }
          }
        }

        // Stream complete
        setProgress({ stage: 'complete', percent: 100 });
        onProgress({ stage: 'complete', percent: 100 });
        onComplete();
        setIsStreaming(false);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          // Stream was intentionally stopped
          return;
        }
        const streamError = err instanceof Error ? err : new Error(String(err));
        setError(streamError);
        setProgress({ stage: 'error', percent: 0, message: streamError.message });
        onError(streamError);
        setIsStreaming(false);
      }
    },
    [stopStream, onArtifact, onProgress, onComplete, onError]
  );

  return {
    startStream,
    stopStream,
    isStreaming,
    progress,
    error,
  };
}

/**
 * Handle individual stream events
 */
function handleStreamEvent(
  data: unknown,
  onArtifact: (artifact: ArtifactPreview) => void,
  onProgress: (progress: StreamProgress) => void,
  setProgress: (progress: StreamProgress) => void
): void {
  if (!data || typeof data !== 'object') return;

  const event = data as Record<string, unknown>;

  if (typeof event.type !== 'string') {
    console.warn('[useArtifactStream] Received event with non-string type:', event.type);
    return;
  }

  switch (event.type) {
    case 'artifact': {
      const artifact = event.artifact as ArtifactPreview;
      if (!artifact?.ref_id) {
        console.warn('[useArtifactStream] Artifact event missing ref_id:', event);
        break;
      }
      // Warn about missing critical fields for debugging
      if (!artifact.path) {
        console.warn('[useArtifactStream] Artifact missing path, using empty string:', artifact.ref_id);
      }
      // Ensure artifact has required fields with defaults
      const normalizedArtifact: ArtifactPreview = {
        ref_id: artifact.ref_id,
        path: artifact.path || '',
        thumbnailUrl: artifact.thumbnailUrl || `/api/runner/thumbnail/${artifact.ref_id}`,
        artifact_type: artifact.artifact_type || 'image',
        selected: artifact.selected ?? true,
        metadata: artifact.metadata,
      };
      onArtifact(normalizedArtifact);
      break;
    }

    case 'progress': {
      const rawPercent = event.percent;
      const percent =
        typeof rawPercent === 'number' && Number.isFinite(rawPercent)
          ? Math.max(0, Math.min(100, rawPercent))
          : 0;
      const progress: StreamProgress = {
        stage: (event.stage as string) || 'streaming',
        percent,
        message: event.message as string | undefined,
        total: event.total as number | undefined,
        current: event.current as number | undefined,
      };
      setProgress(progress);
      onProgress(progress);
      break;
    }

    case 'error': {
      const errorProgress: StreamProgress = {
        stage: 'error',
        percent: 0,
        message: (event.message as string) || 'Unknown error',
      };
      setProgress(errorProgress);
      onProgress(errorProgress);
      break;
    }

    case 'complete': {
      const completeProgress: StreamProgress = {
        stage: 'complete',
        percent: 100,
        total: event.total as number | undefined,
      };
      setProgress(completeProgress);
      onProgress(completeProgress);
      break;
    }

    default:
      // Unknown event type, ignore
      break;
  }
}

/**
 * Create a mock stream for development/testing when backend is unavailable
 */
export function useMockArtifactStream(
  options: UseArtifactStreamOptions
): UseArtifactStreamReturn {
  const { onArtifact, onProgress, onComplete, onError } = options;

  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState<StreamProgress>({
    stage: 'idle',
    percent: 0,
  });
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countRef = useRef(0);

  const stopStream = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsStreaming(false);
    setProgress({ stage: 'idle', percent: 0 });
  }, []);

  const startStream = useCallback(
    (config: StreamConfig) => {
      stopStream();
      setError(null);
      setIsStreaming(true);
      countRef.current = 0;

      const totalItems = 12; // Mock total
      setProgress({ stage: 'streaming', percent: 0, total: totalItems, current: 0 });
      onProgress({ stage: 'streaming', percent: 0, total: totalItems, current: 0 });

      // Simulate streaming artifacts
      intervalRef.current = setInterval(() => {
        countRef.current += 1;
        const current = countRef.current;
        const percent = Math.round((current / totalItems) * 100);

        // Create mock artifact
        const mockArtifact: ArtifactPreview = {
          ref_id: `mock-${current}-${Date.now()}`,
          path: `/mock/images/artwork-${current}.jpg`,
          thumbnailUrl: `https://picsum.photos/seed/${current}/300/200`,
          artifact_type: 'image',
          selected: true,
          metadata: {
            width: 300 + Math.floor(Math.random() * 200),
            height: 200 + Math.floor(Math.random() * 150),
            size: 50000 + Math.floor(Math.random() * 100000),
            title: `Artwork ${current}`,
          },
        };

        onArtifact(mockArtifact);

        const newProgress: StreamProgress = {
          stage: 'streaming',
          percent,
          total: totalItems,
          current,
        };
        setProgress(newProgress);
        onProgress(newProgress);

        if (current >= totalItems) {
          stopStream();
          setProgress({ stage: 'complete', percent: 100, total: totalItems, current: totalItems });
          onProgress({ stage: 'complete', percent: 100, total: totalItems, current: totalItems });
          onComplete();
        }
      }, 500); // Add artifact every 500ms
    },
    [stopStream, onArtifact, onProgress, onComplete]
  );

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return {
    startStream,
    stopStream,
    isStreaming,
    progress,
    error,
  };
}

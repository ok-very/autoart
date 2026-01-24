/**
 * ArtCollector Context Provider
 *
 * Provides shared state for all ArtCollector wizard steps:
 * - Step1Source (URL/folder input)
 * - Step2StreamReview (streaming gallery with select)
 * - Step3TextSlugs (text editing + slug generation)
 * - Step4Tearsheet (print-preview tearsheet builder)
 */

import { createContext, useContext, type ReactNode } from 'react';
import type {
  ArtifactPreview,
  TextElement,
  TearsheetConfig,
  StreamProgress,
} from '../types';

export interface ArtCollectorContextValue {
  // Source config
  sourceType: 'web' | 'local';
  setSourceType: (type: 'web' | 'local') => void;
  sourceUrl: string;
  setSourceUrl: (url: string) => void;
  sourcePath: string;
  setSourcePath: (path: string) => void;

  // Artifacts
  artifacts: ArtifactPreview[];
  addArtifact: (artifact: ArtifactPreview) => void;
  toggleArtifactSelection: (id: string) => void;
  selectAllArtifacts: () => void;
  deselectAllArtifacts: () => void;
  selectedIds: Set<string>;

  // Streaming
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;
  streamProgress: StreamProgress;
  setStreamProgress: (progress: StreamProgress) => void;

  // Text elements
  textElements: TextElement[];
  setTextElements: (elements: TextElement[]) => void;
  pruneText: (id: string) => void;
  restoreText: (id: string) => void;
  prunedTextIds: Set<string>;

  // Slugs
  slugOverrides: Map<string, string>;
  setSlugOverride: (artifactId: string, slug: string) => void;
  clearSlugOverride: (artifactId: string) => void;

  // Tearsheet
  tearsheet: TearsheetConfig;
  updateTearsheet: (config: Partial<TearsheetConfig>) => void;
  addImageToPage: (artifactId: string, pageIndex?: number) => void;
  removeImageFromPage: (artifactId: string, pageIndex: number) => void;
  shufflePage: (pageIndex: number) => void;
  availableImages: string[];
}

const ArtCollectorContext = createContext<ArtCollectorContextValue | null>(null);

/**
 * Hook to access artcollector context. Throws if not within provider.
 */
export function useArtCollectorContext(): ArtCollectorContextValue {
  const ctx = useContext(ArtCollectorContext);
  if (!ctx) {
    throw new Error('useArtCollectorContext must be used within ArtCollectorContextProvider');
  }
  return ctx;
}

/**
 * Optional hook - returns null if not within provider.
 */
export function useArtCollectorContextOptional(): ArtCollectorContextValue | null {
  return useContext(ArtCollectorContext);
}

interface ArtCollectorContextProviderProps {
  children: ReactNode;
  value: ArtCollectorContextValue;
}

export function ArtCollectorContextProvider({
  children,
  value,
}: ArtCollectorContextProviderProps) {
  return (
    <ArtCollectorContext.Provider value={value}>
      {children}
    </ArtCollectorContext.Provider>
  );
}

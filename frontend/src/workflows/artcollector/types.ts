/**
 * ArtCollector Types
 *
 * Type definitions for the ArtCollector wizard module that streams files
 * from Playwright/Puppeteer, allows real-time review, processes text/slugs,
 * and produces layouts using justified-layout.
 */

export interface ArtifactPreview {
  ref_id: string;
  path: string;
  thumbnailUrl: string;
  artifact_type: 'image' | 'text' | 'document';
  selected: boolean;
  metadata?: {
    width?: number;
    height?: number;
    size?: number;
    title?: string;
  };
}

export interface TextElement {
  id: string;
  content: string;
  source: string;
  type: 'bio' | 'caption' | 'alt_text' | 'other';
}

export interface TearsheetPage {
  id: string;
  imageRefs: string[];
  shuffleSeed: number;
}

export interface StreamProgress {
  stage: string;
  percent: number;
}

export interface TearsheetConfig {
  pages: TearsheetPage[];
  currentPageIndex: number;
  pageSize: 'letter' | 'a4' | 'custom';
  orientation: 'portrait' | 'landscape';
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  shuffleSeed: number;
}

export interface ArtCollectorState {
  // Step 1: Source Input
  sourceType: 'web' | 'local';
  sourceUrl: string;
  sourcePath: string;

  // Step 2: Stream & Review
  artifacts: ArtifactPreview[];
  selectedIds: Set<string>;
  isStreaming: boolean;
  streamProgress: StreamProgress;

  // Step 3: Text & Slugs
  textElements: TextElement[];
  prunedTextIds: Set<string>;
  slugOverrides: Map<string, string>;

  // Step 4: Tearsheet
  tearsheet: TearsheetConfig;
  availableImages: string[];
}

export interface ArtCollectorStepProps {
  onNext: () => void;
  onBack: () => void;
}

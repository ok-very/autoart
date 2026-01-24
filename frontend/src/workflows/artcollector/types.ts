/**
 * ArtCollector Types
 *
 * Type definitions for the ArtCollector wizard module that streams files
 * from Playwright/Puppeteer, allows real-time review, processes text/slugs,
 * and produces layouts using justified-layout.
 */

// =============================================================================
// Naming Configuration
// =============================================================================

export type NumberingMode = 'sequential' | 'by_source';

/** How to handle filename collisions when names match (case-insensitive) */
export type CollisionMode = 'suffix' | 'replace';

export interface NamingConfig {
  /** Filename template using {var} placeholders */
  template: string;
  /** Starting index for numbering (default: 1) */
  indexStart: number;
  /** Zero-padding width for index (default: 3) */
  indexPadding: number;
  /** Prefix prepended to all filenames */
  prefix: string;
  /** Suffix appended before extension */
  suffix: string;
  /** strftime format for {date} variable */
  dateFormat: string;
  /** How to count artifacts: sequential or per-source */
  numberingMode: NumberingMode;
  /** How to handle filename collisions: add suffix (_1, _2) or replace existing */
  collisionMode: CollisionMode;
}

export const DEFAULT_NAMING_CONFIG: NamingConfig = {
  template: '{index}_{hash}',
  indexStart: 1,
  indexPadding: 3,
  prefix: '',
  suffix: '',
  dateFormat: '%Y%m%d',
  numberingMode: 'sequential',
  collisionMode: 'suffix',
};

// =============================================================================
// Artifact Types
// =============================================================================

export interface ArtifactPreview {
  ref_id: string;
  /** Persistent artifact ID (content-based, stable across moves) */
  artifact_id?: string;
  path: string;
  thumbnailUrl: string;
  artifact_type: 'image' | 'text' | 'document';
  selected: boolean;
  metadata?: {
    width?: number;
    height?: number;
    size?: number;
    title?: string;
    content_hash?: string;
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
  message?: string;
  total?: number;
  current?: number;
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
  namingConfig: NamingConfig;

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

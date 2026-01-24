/**
 * Tearsheet Export Utilities
 *
 * Functions to export artifacts from tearsheet to records database.
 */

import type { ArtifactPreview, TextElement, TearsheetPage } from '../types';
import { generateArtifactSlug } from './slugify';

export interface ExportableArtwork {
  refId: string;
  slug: string;
  title: string;
  path: string;
  thumbnailUrl: string;
  pageNumber: number;
  positionOnPage: number;
  metadata: {
    width?: number;
    height?: number;
    year?: string;
    medium?: string;
  };
}

export interface ExportPayload {
  artworks: ExportableArtwork[];
  artistBio: string;
  totalPages: number;
}

/**
 * Build the export payload from tearsheet state
 */
export function buildExportPayload(
  artifacts: ArtifactPreview[],
  pages: TearsheetPage[],
  slugOverrides: Map<string, string>,
  textElements: TextElement[],
  prunedTextIds: Set<string>
): ExportPayload {
  const artifactMap = new Map(artifacts.map((a) => [a.ref_id, a]));
  // Build stable index map from original artifacts array for deterministic slug generation
  const artifactIndexMap = new Map(artifacts.map((a, i) => [a.ref_id, i]));

  // Build artworks array from all pages
  const artworks: ExportableArtwork[] = [];

  pages.forEach((page, pageIndex) => {
    page.imageRefs.forEach((refId, positionIndex) => {
      const artifact = artifactMap.get(refId);
      if (!artifact) return;

      // Use stable index from original artifacts array for deterministic slug generation
      const stableIndex = artifactIndexMap.get(refId) ?? 0;
      // Get slug (override or auto-generated)
      const slug =
        slugOverrides.get(refId) || generateArtifactSlug(artifact, stableIndex);

      artworks.push({
        refId,
        slug,
        title: artifact.metadata?.title || slug,
        path: artifact.path,
        thumbnailUrl: artifact.thumbnailUrl,
        pageNumber: pageIndex + 1,
        positionOnPage: positionIndex + 1,
        metadata: {
          width: artifact.metadata?.width,
          height: artifact.metadata?.height,
        },
      });
    });
  });

  // Build artist bio from non-pruned text elements
  const artistBio = textElements
    .filter((t) => !prunedTextIds.has(t.id) && t.type === 'bio')
    .map((t) => t.content)
    .join('\n\n');

  return {
    artworks,
    artistBio,
    totalPages: pages.length,
  };
}

/**
 * Convert export payload to bulk import format for records API
 */
export function toBulkImportFormat(
  payload: ExportPayload,
  definitionId: string
): {
  definitionId: string;
  records: Array<{
    uniqueName: string;
    data: Record<string, unknown>;
  }>;
} {
  // Capture timestamp once for consistent exportedAt across all records in this batch
  const exportedAt = new Date().toISOString();

  return {
    definitionId,
    records: (payload.artworks ?? []).map((artwork) => ({
      uniqueName: artwork.slug,
      data: {
        title: artwork.title,
        slug: artwork.slug,
        path: artwork.path,
        thumbnailUrl: artwork.thumbnailUrl,
        pageNumber: artwork.pageNumber,
        positionOnPage: artwork.positionOnPage,
        width: artwork.metadata?.width,
        height: artwork.metadata?.height,
        artistBio: payload.artistBio,
        exportedAt,
      },
    })),
  };
}

/**
 * Generate a summary of what will be exported
 */
export function getExportSummary(payload: ExportPayload): string {
  const artworks = payload.artworks ?? [];
  const { totalPages } = payload;
  const uniqueSlugs = new Set(artworks.map((a) => a.slug));
  const hasDuplicates = uniqueSlugs.size < artworks.length;

  let summary = `${artworks.length} artwork${artworks.length !== 1 ? 's' : ''} across ${totalPages} page${totalPages !== 1 ? 's' : ''}`;

  if (hasDuplicates) {
    summary += ` (${artworks.length - uniqueSlugs.size} duplicate slug${artworks.length - uniqueSlugs.size !== 1 ? 's' : ''} will be updated)`;
  }

  return summary;
}

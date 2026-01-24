/**
 * SlugEditorSection Component
 *
 * Table-based editor for managing image slugs with duplicate detection.
 */

import { useState, useMemo } from 'react';
import { Stack, Text, Button, Inline, Badge } from '@autoart/ui';
import { ChevronDown, ChevronRight, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import clsx from 'clsx';
import type { ArtifactPreview } from '../types';
import { generateArtifactSlug } from '../utils/slugify';

export interface SlugEditorSectionProps {
  artifacts: ArtifactPreview[];
  slugOverrides: Map<string, string>;
  onSetOverride: (artifactId: string, slug: string) => void;
  onClearOverride: (artifactId: string) => void;
  onRegenerateAll: () => void;
}

export function SlugEditorSection({
  artifacts,
  slugOverrides,
  onSetOverride,
  onClearOverride,
  onRegenerateAll,
}: SlugEditorSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Calculate slugs and detect duplicates
  const { slugData, duplicateSlugs } = useMemo(() => {
    const data = artifacts.map((artifact, index) => {
      const autoSlug = generateArtifactSlug(artifact, index);
      const finalSlug = slugOverrides.get(artifact.ref_id) || autoSlug;
      return {
        artifact,
        autoSlug,
        finalSlug,
        hasOverride: slugOverrides.has(artifact.ref_id),
      };
    });

    // Find duplicates
    const slugCounts = new Map<string, number>();
    data.forEach(({ finalSlug }) => {
      slugCounts.set(finalSlug, (slugCounts.get(finalSlug) || 0) + 1);
    });
    const duplicates = new Set(
      Array.from(slugCounts.entries())
        .filter(([_, count]) => count > 1)
        .map(([slug]) => slug)
    );

    return { slugData: data, duplicateSlugs: duplicates };
  }, [artifacts, slugOverrides]);

  const overrideCount = slugOverrides.size;
  const duplicateCount = slugData.filter((d) => duplicateSlugs.has(d.finalSlug)).length;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-slate-50 px-4 py-3 flex items-center justify-between hover:bg-slate-100 transition-colors"
      >
        <Inline gap="sm" align="center">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
          <Text weight="medium">Image Slugs</Text>
          {duplicateCount > 0 && (
            <Badge variant="warning" size="sm">
              {duplicateCount} duplicate{duplicateCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </Inline>
        <Text size="sm" color="muted">
          {artifacts.length} images, {overrideCount} overrides
        </Text>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-slate-200">
          {/* Toolbar */}
          {artifacts.length > 0 && (
            <div className="px-4 py-2 bg-slate-25 border-b border-slate-100">
              <Inline justify="between" align="center">
                <Button variant="secondary" size="sm" onClick={onRegenerateAll}>
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Regenerate All
                </Button>
                {duplicateCount > 0 && (
                  <Inline gap="xs" align="center" className="text-amber-600">
                    <AlertTriangle className="w-4 h-4" />
                    <Text size="sm">{duplicateCount} duplicate slugs detected</Text>
                  </Inline>
                )}
              </Inline>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            {artifacts.length === 0 ? (
              <div className="p-4">
                <Text size="sm" color="muted">
                  No images selected. Select images in Step 2 to edit slugs.
                </Text>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium text-slate-600 w-16">Preview</th>
                    <th className="px-4 py-2 font-medium text-slate-600">Auto-Generated</th>
                    <th className="px-4 py-2 font-medium text-slate-600">Override</th>
                    <th className="px-4 py-2 font-medium text-slate-600 w-20">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {slugData.map(({ artifact, autoSlug, finalSlug, hasOverride }) => {
                    const isDuplicate = duplicateSlugs.has(finalSlug);

                    return (
                      <SlugRow
                        key={artifact.ref_id}
                        artifact={artifact}
                        autoSlug={autoSlug}
                        hasOverride={hasOverride}
                        overrideValue={slugOverrides.get(artifact.ref_id) || ''}
                        isDuplicate={isDuplicate}
                        onSetOverride={(slug) => onSetOverride(artifact.ref_id, slug)}
                        onClearOverride={() => onClearOverride(artifact.ref_id)}
                      />
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface SlugRowProps {
  artifact: ArtifactPreview;
  autoSlug: string;
  hasOverride: boolean;
  overrideValue: string;
  isDuplicate: boolean;
  onSetOverride: (slug: string) => void;
  onClearOverride: () => void;
}

function SlugRow({
  artifact,
  autoSlug,
  hasOverride,
  overrideValue,
  isDuplicate,
  onSetOverride,
  onClearOverride,
}: SlugRowProps) {
  const [inputValue, setInputValue] = useState(overrideValue);

  const handleBlur = () => {
    const trimmed = inputValue.trim();
    if (trimmed && trimmed !== autoSlug) {
      onSetOverride(trimmed);
    } else if (!trimmed && hasOverride) {
      onClearOverride();
      setInputValue('');
    }
  };

  return (
    <tr className="hover:bg-slate-50">
      {/* Thumbnail */}
      <td className="px-4 py-2">
        <div className="w-12 h-12 bg-slate-100 rounded overflow-hidden">
          {artifact.thumbnailUrl ? (
            <img
              src={artifact.thumbnailUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">
              img
            </div>
          )}
        </div>
      </td>

      {/* Auto-generated slug */}
      <td className="px-4 py-2">
        <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">
          {autoSlug}
        </code>
      </td>

      {/* Override input */}
      <td className="px-4 py-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleBlur}
          placeholder="(use auto)"
          className={clsx(
            'w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
            hasOverride ? 'border-blue-300 bg-blue-50' : 'border-slate-200'
          )}
        />
      </td>

      {/* Status */}
      <td className="px-4 py-2">
        {isDuplicate ? (
          <span className="inline-flex items-center gap-1 text-amber-600">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs">dup</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-green-600">
            <Check className="w-4 h-4" />
          </span>
        )}
      </td>
    </tr>
  );
}

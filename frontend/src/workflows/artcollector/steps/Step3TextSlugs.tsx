/**
 * Step 3: Text & Slugs
 *
 * Edit extracted text (bio, captions, alt text) and generate/override slugs.
 * Combines text pruning and slug editing in a single step.
 */

import { useCallback } from 'react';
import { Stack, Text, Button, Inline } from '@autoart/ui';
import { useArtCollectorContext } from '../context/ArtCollectorContext';
import { TextPruningSection } from '../components/TextPruningSection';
import { SlugEditorSection } from '../components/SlugEditorSection';
import type { ArtCollectorStepProps } from '../types';

export function Step3TextSlugs({ onNext, onBack }: ArtCollectorStepProps) {
  const {
    textElements,
    prunedTextIds,
    pruneText,
    restoreText,
    updateTextElement,
    artifacts,
    selectedIds,
    slugOverrides,
    setSlugOverride,
    clearSlugOverride,
  } = useArtCollectorContext();

  // Get only selected artifacts for slug editing
  const selectedArtifacts = artifacts.filter((a) => selectedIds.has(a.ref_id));

  // Regenerate all slugs (clear all overrides)
  // Derive from artifacts/selectedIds at call time to avoid stale closure
  const handleRegenerateAll = useCallback(() => {
    artifacts.forEach((a) => {
      if (selectedIds.has(a.ref_id)) {
        clearSlugOverride(a.ref_id);
      }
    });
  }, [artifacts, selectedIds, clearSlugOverride]);

  return (
    <Stack className="h-full" gap="lg">
      {/* Header */}
      <div className="flex-shrink-0">
        <Text size="lg" weight="bold">
          Text & Slugs
        </Text>
        <Text size="sm" color="muted" className="mt-1">
          Edit extracted text and configure image slugs for export
        </Text>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-auto">
        <Stack gap="lg">
          {/* Text Elements Section */}
          <TextPruningSection
            textElements={textElements}
            prunedTextIds={prunedTextIds}
            onPrune={pruneText}
            onRestore={restoreText}
            onUpdateText={updateTextElement}
          />

          {/* Slugs Section */}
          <SlugEditorSection
            artifacts={selectedArtifacts}
            slugOverrides={slugOverrides}
            onSetOverride={setSlugOverride}
            onClearOverride={clearSlugOverride}
            onRegenerateAll={handleRegenerateAll}
          />
        </Stack>
      </div>

      {/* Footer */}
      <Inline justify="between" className="pt-4 mt-4 border-t border-ws-panel-border shrink-0">
        <Button onClick={onBack} variant="secondary">
          Back
        </Button>
        <Inline gap="sm" align="center">
          <Text size="sm" color="muted">
            {selectedArtifacts.length} images ready
          </Text>
          <Button onClick={onNext} disabled={selectedArtifacts.length === 0}>
            Next: Tearsheet
          </Button>
        </Inline>
      </Inline>
    </Stack>
  );
}

/**
 * Step 3: Text & Slugs
 *
 * Edit extracted text (bio, captions, alt text) and generate/override slugs.
 * Combines text pruning and slug editing in a single step.
 *
 * TODO: Implement collapsible text sections, slug table with duplicate detection
 */

import { Stack, Text, Button, Inline } from '@autoart/ui';
import { useArtCollectorContext } from '../context/ArtCollectorContext';
import type { ArtCollectorStepProps } from '../types';

export function Step3TextSlugs({ onNext, onBack }: ArtCollectorStepProps) {
  const { textElements, prunedTextIds, artifacts, selectedIds, slugOverrides } =
    useArtCollectorContext();

  const activeTextCount = textElements.length - prunedTextIds.size;
  const selectedArtifacts = artifacts.filter((a) => selectedIds.has(a.ref_id));

  return (
    <Stack className="h-full" gap="lg">
      <div>
        <Text size="lg" weight="bold">
          Text & Slugs
        </Text>
        <Text size="sm" color="muted" className="mt-1">
          Edit extracted text and configure image slugs
        </Text>
      </div>

      {/* Text Elements Section */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 flex items-center justify-between">
          <Text weight="medium">Text Elements</Text>
          <Text size="sm" color="muted">
            {activeTextCount} of {textElements.length} items
          </Text>
        </div>
        <div className="p-4 border-t border-slate-200">
          {textElements.length === 0 ? (
            <Text size="sm" color="muted">
              No text elements extracted
            </Text>
          ) : (
            <Text size="sm" color="muted">
              Text editing interface will be implemented here
            </Text>
          )}
        </div>
      </div>

      {/* Slugs Section */}
      <div className="border border-slate-200 rounded-lg overflow-hidden flex-1">
        <div className="bg-slate-50 px-4 py-3 flex items-center justify-between">
          <Text weight="medium">Image Slugs</Text>
          <Text size="sm" color="muted">
            {selectedArtifacts.length} images, {slugOverrides.size} overrides
          </Text>
        </div>
        <div className="p-4 border-t border-slate-200">
          {selectedArtifacts.length === 0 ? (
            <Text size="sm" color="muted">
              No images selected
            </Text>
          ) : (
            <Text size="sm" color="muted">
              Slug editor table will be implemented here
            </Text>
          )}
        </div>
      </div>

      {/* Footer */}
      <Inline justify="between" className="pt-4 mt-4 border-t border-slate-200 shrink-0">
        <Button onClick={onBack} variant="secondary">
          Back
        </Button>
        <Button onClick={onNext}>Next: Tearsheet</Button>
      </Inline>
    </Stack>
  );
}

/**
 * Step 4: Tearsheet Builder
 *
 * Create print-ready tearsheets using justified-layout.
 * Features page navigation, shuffle/shake, and export options.
 *
 * TODO: Implement TearsheetPreview, AvailableGallery, export functionality
 */

import { Stack, Text, Button, Inline } from '@autoart/ui';
import { Shuffle, Download, FileText } from 'lucide-react';
import { useArtCollectorContext } from '../context/ArtCollectorContext';
import type { ArtCollectorStepProps } from '../types';

export function Step4Tearsheet({ onBack }: ArtCollectorStepProps) {
  const { tearsheet, availableImages, shufflePage, artifacts, selectedIds } =
    useArtCollectorContext();

  const { pages, currentPageIndex } = tearsheet;
  // Guard against out-of-range index
  const safePageIndex = pages.length > 0 ? Math.min(currentPageIndex, pages.length - 1) : 0;
  const currentPage = pages.length > 0 ? pages[safePageIndex] : null;
  const totalPages = Math.max(pages.length, 1);
  const displayPageNumber = pages.length > 0 ? safePageIndex + 1 : 0;
  const selectedArtifacts = artifacts.filter((a) => selectedIds.has(a.ref_id));

  const handleShuffle = () => {
    if (pages.length > 0) {
      shufflePage(safePageIndex);
    }
  };

  const handleExportPDF = () => {
    // TODO: Implement PDF export
    console.log('Export PDF');
  };

  const handleExportRecords = () => {
    // TODO: Implement records export
    console.log('Export Records');
  };

  return (
    <Stack className="h-full" gap="lg">
      {/* Toolbar */}
      <Inline justify="between" align="center">
        <Text size="lg" weight="bold">
          Tearsheet Builder
        </Text>
        <Inline gap="sm">
          <Inline gap="xs" align="center" className="text-sm text-slate-600">
            <span>Page</span>
            <span className="font-medium">{displayPageNumber}</span>
            <span>of</span>
            <span className="font-medium">{totalPages}</span>
          </Inline>
          <Button variant="secondary" size="sm" onClick={handleShuffle}>
            <Shuffle className="w-4 h-4 mr-1" />
            Shuffle
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-1" />
            Export PDF
          </Button>
          <Button variant="primary" size="sm" onClick={handleExportRecords}>
            <FileText className="w-4 h-4 mr-1" />
            Export Records
          </Button>
        </Inline>
      </Inline>

      {/* Tearsheet Preview */}
      <div className="flex-1 border border-slate-200 rounded-lg bg-white p-4 overflow-auto">
        <div
          className="mx-auto bg-white shadow-lg"
          style={{
            width: '100%',
            maxWidth: '1056px', // Letter landscape width at 96 DPI
            aspectRatio: '11 / 8.5',
            border: '1px solid #e2e8f0',
          }}
        >
          <div className="h-full p-10 grid grid-cols-[320px_1fr] gap-10">
            {/* Sidebar */}
            <div className="flex flex-col">
              <div>
                <Text size="xl" weight="bold" className="uppercase tracking-wide">
                  Artist Name
                </Text>
                <Text size="sm" color="muted" className="mt-1">
                  (Region)
                </Text>
                <Text size="sm" className="mt-4 text-justify leading-relaxed">
                  Artist biography text will appear here. This section displays
                  the collected bio paragraphs from the source page.
                </Text>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-200">
                <Text size="xs" color="muted">
                  Contact information
                </Text>
              </div>
            </div>

            {/* Gallery Grid */}
            <div className="grid grid-cols-3 grid-rows-2 gap-5">
              {currentPage?.imageRefs.slice(0, 6).map((refId, i) => {
                const artifact = artifacts.find((a) => a.ref_id === refId);
                return (
                  <div
                    key={refId}
                    className="bg-slate-100 rounded flex items-center justify-center"
                  >
                    {artifact ? (
                      <img
                        src={artifact.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <Text size="xs" color="muted">
                        Image {i + 1}
                      </Text>
                    )}
                  </div>
                );
              })}
              {/* Fill empty slots */}
              {Array.from({
                length: Math.max(0, 6 - (currentPage?.imageRefs?.length ?? 0)),
              }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="bg-slate-50 border-2 border-dashed border-slate-200 rounded flex items-center justify-center"
                >
                  <Text size="xs" color="muted">
                    Drop image
                  </Text>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Available Images */}
      <div className="border border-slate-200 rounded-lg bg-slate-50 p-4">
        <Text size="sm" weight="medium" className="mb-2">
          Available Images ({availableImages.length})
        </Text>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {availableImages.length === 0 ? (
            <Text size="sm" color="muted">
              All images placed on pages
            </Text>
          ) : (
            availableImages.slice(0, 10).map((refId) => {
              const artifact = artifacts.find((a) => a.ref_id === refId);
              return (
                <div
                  key={refId}
                  className="w-16 h-16 bg-white border border-slate-200 rounded flex-shrink-0 flex items-center justify-center cursor-pointer hover:border-blue-400"
                >
                  {artifact?.thumbnailUrl ? (
                    <img
                      src={artifact.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <Text size="xs" color="muted">
                      img
                    </Text>
                  )}
                </div>
              );
            })
          )}
          {availableImages.length > 10 && (
            <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded flex-shrink-0 flex items-center justify-center">
              <Text size="xs" color="muted">
                +{availableImages.length - 10}
              </Text>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <Inline justify="between" className="pt-4 mt-4 border-t border-slate-200 shrink-0">
        <Button onClick={onBack} variant="secondary">
          Back
        </Button>
        <Text size="sm" color="muted">
          {selectedArtifacts.length} images selected for tearsheet
        </Text>
      </Inline>
    </Stack>
  );
}

/**
 * Step 4: Tearsheet Builder
 *
 * Create print-ready tearsheets using justified-layout.
 * Features page navigation, shuffle/shake, and export options.
 */

import { useCallback } from 'react';
import { Stack, Text, Button, Inline } from '@autoart/ui';
import {
  Shuffle,
  Download,
  FileText,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
} from 'lucide-react';
import { useArtCollectorContext } from '../context/ArtCollectorContext';
import type { ArtCollectorStepProps } from '../types';

const MAX_IMAGES_PER_PAGE = 6;

export function Step4Tearsheet({ onBack }: ArtCollectorStepProps) {
  const {
    tearsheet,
    updateTearsheet,
    availableImages,
    addImageToPage,
    removeImageFromPage,
    shufflePage,
    artifacts,
    selectedIds,
    textElements,
    prunedTextIds,
  } = useArtCollectorContext();

  const { pages, currentPageIndex } = tearsheet;

  // Guard against out-of-range index
  const safePageIndex = pages.length > 0 ? Math.min(currentPageIndex, pages.length - 1) : 0;
  const currentPage = pages.length > 0 ? pages[safePageIndex] : null;
  const totalPages = pages.length;
  const displayPageNumber = pages.length > 0 ? safePageIndex + 1 : 0;
  const selectedArtifacts = artifacts.filter((a) => selectedIds.has(a.ref_id));

  // Get active text for bio display
  const activeBioText = textElements
    .filter((t) => !prunedTextIds.has(t.id) && t.type === 'bio')
    .map((t) => t.content)
    .join('\n\n');

  const canAddToCurrentPage = currentPage
    ? currentPage.imageRefs.length < MAX_IMAGES_PER_PAGE
    : true;

  // Navigation
  const handlePrevPage = useCallback(() => {
    if (safePageIndex > 0) {
      updateTearsheet({ currentPageIndex: safePageIndex - 1 });
    }
  }, [safePageIndex, updateTearsheet]);

  const handleNextPage = useCallback(() => {
    if (safePageIndex < pages.length - 1) {
      updateTearsheet({ currentPageIndex: safePageIndex + 1 });
    }
  }, [safePageIndex, pages.length, updateTearsheet]);

  const handleAddPage = useCallback(() => {
    const newPageIndex = pages.length;
    updateTearsheet({
      pages: [
        ...pages,
        {
          id: `page-${newPageIndex}`,
          imageRefs: [],
          shuffleSeed: Date.now(),
        },
      ],
      currentPageIndex: newPageIndex,
    });
  }, [pages, updateTearsheet]);

  const handleShuffle = useCallback(() => {
    if (pages.length > 0) {
      shufflePage(safePageIndex);
    }
  }, [pages.length, safePageIndex, shufflePage]);

  const handleAddImageToPage = useCallback(
    (refId: string) => {
      if (canAddToCurrentPage) {
        addImageToPage(refId, safePageIndex);
      }
    },
    [canAddToCurrentPage, addImageToPage, safePageIndex]
  );

  const handleRemoveImageFromPage = useCallback(
    (refId: string) => {
      removeImageFromPage(refId, safePageIndex);
    },
    [removeImageFromPage, safePageIndex]
  );

  const handleExportPDF = () => {
    // TODO: Implement PDF export via print dialog
    window.print();
  };

  const handleExportRecords = () => {
    // TODO: Implement records export
    console.log('Export Records - will create database entries');
  };

  return (
    <Stack className="h-full" gap="md">
      {/* Toolbar */}
      <Inline justify="between" align="center" className="flex-shrink-0">
        <Text size="lg" weight="bold">
          Tearsheet Builder
        </Text>
        <Inline gap="sm">
          {/* Page Navigation */}
          <Inline gap="xs" align="center" className="border border-slate-200 rounded-lg px-2 py-1">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={safePageIndex === 0 || totalPages === 0}
              className="p-1 text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-slate-600 min-w-[60px] text-center">
              {totalPages > 0 ? `${displayPageNumber} / ${totalPages}` : 'No pages'}
            </span>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={safePageIndex >= totalPages - 1 || totalPages === 0}
              className="p-1 text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </Inline>

          <Button variant="secondary" size="sm" onClick={handleAddPage}>
            <Plus className="w-4 h-4 mr-1" />
            Add Page
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleShuffle}
            disabled={!currentPage || currentPage.imageRefs.length === 0}
          >
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
      <div className="flex-1 min-h-0 border border-slate-200 rounded-lg bg-slate-100 p-4 overflow-auto">
        {totalPages === 0 ? (
          <div className="h-full flex items-center justify-center">
            <Stack align="center" gap="md">
              <Text color="muted">No pages created yet</Text>
              <Button variant="primary" onClick={handleAddPage}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Page
              </Button>
            </Stack>
          </div>
        ) : (
          <div
            className="mx-auto bg-white shadow-lg print:shadow-none"
            style={{
              width: '100%',
              maxWidth: '1056px',
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
                    {activeBioText || 'Artist biography text will appear here.'}
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
                {currentPage?.imageRefs.slice(0, MAX_IMAGES_PER_PAGE).map((refId) => {
                  const artifact = artifacts.find((a) => a.ref_id === refId);
                  return (
                    <div
                      key={refId}
                      className="relative bg-slate-100 rounded overflow-hidden group"
                    >
                      {artifact ? (
                        <>
                          <img
                            src={artifact.thumbnailUrl}
                            alt={artifact.metadata?.title || ''}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveImageFromPage(refId)}
                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove from page"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          {artifact.metadata?.title && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
                              <span className="font-medium italic">{artifact.metadata.title}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Text size="xs" color="muted">
                            Missing
                          </Text>
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Fill empty slots */}
                {Array.from({
                  length: Math.max(0, MAX_IMAGES_PER_PAGE - (currentPage?.imageRefs?.length ?? 0)),
                }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="bg-slate-50 border-2 border-dashed border-slate-200 rounded flex items-center justify-center text-slate-400"
                  >
                    <Text size="xs" color="muted">
                      Empty slot
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Available Images */}
      <div className="flex-shrink-0 border border-slate-200 rounded-lg bg-slate-50 p-3">
        <Inline justify="between" align="center" className="mb-2">
          <Text size="sm" weight="medium">
            Available Images ({availableImages.length})
          </Text>
          {!canAddToCurrentPage && totalPages > 0 && (
            <Text size="xs" color="muted">
              Current page is full (max {MAX_IMAGES_PER_PAGE})
            </Text>
          )}
        </Inline>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {availableImages.length === 0 ? (
            <Text size="sm" color="muted">
              All images placed on pages
            </Text>
          ) : (
            availableImages.map((refId) => {
              const artifact = artifacts.find((a) => a.ref_id === refId);
              return (
                <button
                  key={refId}
                  type="button"
                  onClick={() => handleAddImageToPage(refId)}
                  disabled={!canAddToCurrentPage || totalPages === 0}
                  className="w-14 h-14 bg-white border border-slate-200 rounded flex-shrink-0 overflow-hidden cursor-pointer hover:border-blue-400 hover:ring-2 hover:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  title={canAddToCurrentPage ? 'Click to add to current page' : 'Page is full'}
                >
                  {artifact?.thumbnailUrl ? (
                    <img
                      src={artifact.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-slate-300">img</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <Inline justify="between" className="pt-2 border-t border-slate-200 shrink-0">
        <Button onClick={onBack} variant="secondary">
          Back
        </Button>
        <Text size="sm" color="muted">
          {selectedArtifacts.length} images total, {totalPages} page{totalPages !== 1 ? 's' : ''} created
        </Text>
      </Inline>
    </Stack>
  );
}

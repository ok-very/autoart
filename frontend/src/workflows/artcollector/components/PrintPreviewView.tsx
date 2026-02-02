/**
 * PrintPreviewView Component
 *
 * Full view with sidebar for previewing and printing tearsheet pages.
 * Uses Tailwind print: utilities for print-specific styling.
 */

import { useState } from 'react';
import { Stack, Text, Button, Inline } from '@autoart/ui';
import {
  Printer,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Plus,
  Trash2,
} from 'lucide-react';
import type { ArtifactPreview, TearsheetPage, TextElement } from '../types';

export interface PrintPreviewViewProps {
  pages: TearsheetPage[];
  artifacts: ArtifactPreview[];
  textElements: TextElement[];
  prunedTextIds: Set<string>;
  onShufflePage: (pageIndex: number) => void;
  onBack: () => void;
  onAddPage: () => void;
  onDeletePage?: (pageIndex: number) => void;
}

const MAX_IMAGES_PER_PAGE = 6;

export function PrintPreviewView({
  pages,
  artifacts,
  textElements,
  prunedTextIds,
  onShufflePage,
  onBack,
  onAddPage,
  onDeletePage,
}: PrintPreviewViewProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // Ensure valid page index
  const safePageIndex = pages.length > 0 ? Math.min(currentPageIndex, pages.length - 1) : 0;

  // Get bio text for display
  const activeBioText = textElements
    .filter((t) => !prunedTextIds.has(t.id) && t.type === 'bio')
    .map((t) => t.content)
    .join('\n\n');

  const handlePrint = () => {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  };

  const handlePrevPage = () => {
    setCurrentPageIndex((p) => Math.max(0, p - 1));
  };

  const handleNextPage = () => {
    setCurrentPageIndex((p) => Math.min(pages.length - 1, p + 1));
  };

  const handleDeleteCurrentPage = () => {
    if (onDeletePage && pages.length > 0) {
      onDeletePage(safePageIndex);
      if (safePageIndex >= pages.length - 1) {
        setCurrentPageIndex(Math.max(0, pages.length - 2));
      }
    }
  };

  return (
    <>
      {/* Main View - hidden during print */}
      <div className="h-full flex print:hidden">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-slate-200">
            <Button variant="secondary" size="sm" onClick={onBack} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Editor
            </Button>
          </div>

          {/* Page List */}
          <div className="flex-1 overflow-auto p-4">
            <Inline justify="between" align="center" className="mb-3">
              <Text size="sm" weight="medium">
                Pages ({pages.length})
              </Text>
              <Button variant="secondary" size="sm" onClick={onAddPage}>
                <Plus className="w-3 h-3" />
              </Button>
            </Inline>

            {pages.length === 0 ? (
              <div className="text-center py-8">
                <Text size="sm" color="muted">
                  No pages yet
                </Text>
                <Button variant="primary" size="sm" onClick={onAddPage} className="mt-2">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Page
                </Button>
              </div>
            ) : (
              <Stack gap="sm">
                {pages.map((page, index) => (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => setCurrentPageIndex(index)}
                    className={`w-full text-left p-2 rounded-lg border-2 transition-all ${
                      index === safePageIndex
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="aspect-[11/8.5] bg-slate-100 rounded mb-2 flex items-center justify-center">
                      <Text size="lg" weight="bold" color="muted">
                        {index + 1}
                      </Text>
                    </div>
                    <Text size="xs" color="muted">
                      {page.imageRefs.length} image{page.imageRefs.length !== 1 ? 's' : ''}
                    </Text>
                  </button>
                ))}
              </Stack>
            )}
          </div>

          {/* Sidebar Footer - Actions */}
          <div className="p-4 border-t border-slate-200 space-y-2">
            <Button onClick={handlePrint} className="w-full">
              <Printer className="w-4 h-4 mr-2" />
              Print All Pages
            </Button>
          </div>
        </div>

        {/* Main Preview Area */}
        <div className="flex-1 flex flex-col bg-slate-100 min-w-0">
          {/* Toolbar */}
          <div className="flex-shrink-0 px-6 py-3 bg-white border-b border-slate-200">
            <Inline justify="between" align="center">
              {/* Page Navigation */}
              <Inline gap="sm" align="center">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={safePageIndex === 0 || pages.length === 0}
                  className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-slate-100"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <Text weight="medium" className="min-w-[100px] text-center">
                  {pages.length > 0 ? `Page ${safePageIndex + 1} of ${pages.length}` : 'No pages'}
                </Text>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={safePageIndex >= pages.length - 1 || pages.length === 0}
                  className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-slate-100"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </Inline>

              {/* Page Actions */}
              <Inline gap="sm">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onShufflePage(safePageIndex)}
                  disabled={pages.length === 0 || pages[safePageIndex]?.imageRefs.length === 0}
                >
                  <Shuffle className="w-4 h-4 mr-1" />
                  Shuffle
                </Button>
                {onDeletePage && pages.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDeleteCurrentPage}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete Page
                  </Button>
                )}
              </Inline>
            </Inline>
          </div>

          {/* Preview Canvas */}
          <div className="flex-1 overflow-auto p-8 flex items-start justify-center">
            {pages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <Stack align="center" gap="md">
                  <Text color="muted">No pages to preview</Text>
                  <Button variant="primary" onClick={onAddPage}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Page
                  </Button>
                </Stack>
              </div>
            ) : (
              <TearsheetPagePreview
                page={pages[safePageIndex]}
                pageNumber={safePageIndex + 1}
                totalPages={pages.length}
                artifacts={artifacts}
                bioText={activeBioText}
              />
            )}
          </div>
        </div>
      </div>

      {/* Print-only content - all pages rendered for printing */}
      <div className="hidden print:block">
        {pages.map((page, pageIndex) => (
          <TearsheetPagePrint
            key={page.id}
            page={page}
            pageNumber={pageIndex + 1}
            totalPages={pages.length}
            artifacts={artifacts}
            bioText={activeBioText}
            isLastPage={pageIndex === pages.length - 1}
          />
        ))}
      </div>
    </>
  );
}

interface TearsheetPagePreviewProps {
  page: TearsheetPage;
  pageNumber: number;
  totalPages: number;
  artifacts: ArtifactPreview[];
  bioText: string;
}

function TearsheetPagePreview({
  page,
  pageNumber,
  totalPages,
  artifacts,
  bioText,
}: TearsheetPagePreviewProps) {
  return (
    <div
      className="bg-white shadow-lg border border-slate-200 rounded-lg overflow-hidden"
      style={{
        width: '100%',
        maxWidth: '1000px',
        aspectRatio: '11 / 8.5',
      }}
    >
      <div className="h-full p-10 grid grid-cols-[300px_1fr] gap-10">
        {/* Sidebar */}
        <div className="flex flex-col">
          <div>
            <h1 className="text-xl font-semibold uppercase tracking-wide text-slate-800">
              Artist Name
            </h1>
            <p className="text-sm text-slate-500 mt-1">(Region)</p>
            <p className="text-sm mt-6 text-justify leading-relaxed text-slate-700">
              {bioText || 'Artist biography text will appear here.'}
            </p>
          </div>
          <div className="mt-auto pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-400">Contact information</p>
            <p className="text-xs text-slate-500 mt-1">
              Page {pageNumber} of {totalPages}
            </p>
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-3 grid-rows-2 gap-5">
          {(page?.imageRefs ?? []).slice(0, MAX_IMAGES_PER_PAGE).map((refId) => {
            const artifact = (artifacts ?? []).find((a) => a.ref_id === refId);
            return (
              <div
                key={refId}
                className="relative bg-slate-100 rounded overflow-hidden"
              >
                {artifact ? (
                  <>
                    <img
                      src={artifact.thumbnailUrl}
                      alt={artifact.metadata?.title || ''}
                      className="w-full h-full object-cover"
                    />
                    {artifact.metadata?.title && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2">
                        <span className="font-medium italic">
                          {artifact.metadata.title}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-xs text-slate-400">Missing</span>
                  </div>
                )}
              </div>
            );
          })}
          {/* Empty slots */}
          {Array.from({
            length: Math.max(0, MAX_IMAGES_PER_PAGE - page.imageRefs.length),
          }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="bg-slate-50 border-2 border-dashed border-slate-200 rounded flex items-center justify-center"
            >
              <span className="text-xs text-slate-300">Empty</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface TearsheetPagePrintProps {
  page: TearsheetPage;
  pageNumber: number;
  totalPages: number;
  artifacts: ArtifactPreview[];
  bioText: string;
  isLastPage: boolean;
}

function TearsheetPagePrint({
  page,
  pageNumber,
  totalPages,
  artifacts,
  bioText,
  isLastPage,
}: TearsheetPagePrintProps) {
  return (
    <div
      className={`w-full bg-white ${!isLastPage ? 'break-after-page' : ''}`}
      style={{
        aspectRatio: '11 / 8.5',
        padding: '40px',
      }}
    >
      <div className="h-full grid grid-cols-[280px_1fr] gap-10">
        {/* Sidebar */}
        <div className="flex flex-col">
          <div>
            <h1
              className="uppercase tracking-wide text-slate-800"
              style={{ fontSize: '24pt', fontWeight: 700 }}
            >
              Artist Name
            </h1>
            <p className="text-slate-500" style={{ fontSize: '14pt' }}>
              (Region)
            </p>
            <p
              className="mt-4 text-justify leading-relaxed text-slate-700"
              style={{ fontSize: '11pt', lineHeight: 1.4 }}
            >
              {bioText || 'Artist biography text will appear here.'}
            </p>
          </div>
          <div className="mt-auto pt-4 border-t border-slate-200">
            <p className="text-slate-400" style={{ fontSize: '10pt' }}>
              Contact information
            </p>
            <p className="text-slate-500 mt-1" style={{ fontSize: '9pt' }}>
              Page {pageNumber} of {totalPages}
            </p>
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-3 grid-rows-2 gap-5">
          {(page?.imageRefs ?? []).slice(0, MAX_IMAGES_PER_PAGE).map((refId) => {
            const artifact = (artifacts ?? []).find((a) => a.ref_id === refId);
            return (
              <figure key={refId} className="flex flex-col">
                <div
                  className="bg-slate-100 overflow-hidden flex-1"
                  style={{ maxHeight: '200px' }}
                >
                  {artifact?.thumbnailUrl ? (
                    <img
                      src={artifact.thumbnailUrl}
                      alt={artifact.metadata?.title || ''}
                      className="w-full h-full object-cover print:object-contain"
                      style={{
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact',
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-slate-400" style={{ fontSize: '9pt' }}>
                        Missing
                      </span>
                    </div>
                  )}
                </div>
                {artifact?.metadata?.title && (
                  <figcaption style={{ fontSize: '9pt', marginTop: '8px' }}>
                    <span className="font-semibold italic">{artifact.metadata.title}</span>
                  </figcaption>
                )}
              </figure>
            );
          })}
        </div>
      </div>
    </div>
  );
}

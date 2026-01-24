/**
 * Step 1: Source Input
 *
 * Accept URL or folder path for art collection.
 * Features BaseWeb-style dropzone with mode tabs (Web URL / Local Folder).
 */

import { useState } from 'react';
import { Stack, Text, Button, Inline } from '@autoart/ui';
import { FolderOpen, Globe, Check } from 'lucide-react';
import clsx from 'clsx';

import { useArtCollectorContext } from '../context/ArtCollectorContext';
import type { ArtCollectorStepProps } from '../types';

type SourceMode = 'local' | 'web';

export function Step1Source({ onNext }: ArtCollectorStepProps) {
  const {
    sourceType,
    setSourceType,
    sourceUrl,
    setSourceUrl,
    sourcePath,
    setSourcePath,
  } = useArtCollectorContext();

  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeMode: SourceMode = sourceType;
  const hasValidSource =
    (activeMode === 'local' && sourcePath.trim().length > 0) ||
    (activeMode === 'web' && sourceUrl.trim().length > 0);

  const handleModeChange = (mode: SourceMode) => {
    setSourceType(mode);
    setError(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const item = items[0];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          // For security reasons, browsers don't expose the full path
          // We'll show the folder name and prompt user to use browse
          setError('Drop detected. Please use Browse button for folder selection.');
        }
      }
    }
  };

  const handleBrowseFolder = async () => {
    try {
      // Use the File System Access API if available
      if ('showDirectoryPicker' in window) {
        const dirHandle = await (window as any).showDirectoryPicker();
        setSourcePath(dirHandle.name);
        setError(null);
      } else {
        setError('Folder selection not supported in this browser. Please paste the path manually.');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Failed to select folder');
      }
    }
  };

  const handleNext = () => {
    if (!hasValidSource) {
      setError(
        activeMode === 'local'
          ? 'Please select or enter a folder path'
          : 'Please enter a valid URL'
      );
      return;
    }
    setError(null);
    onNext();
  };

  return (
    <Stack className="h-full" gap="lg">
      {/* Mode Toggle Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => handleModeChange('local')}
          className={clsx(
            'px-4 py-2 rounded-t-lg text-sm font-medium transition-colors',
            activeMode === 'local'
              ? 'bg-white border border-b-white border-slate-200 -mb-[1px] text-slate-900'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <Inline gap="xs" align="center">
            <FolderOpen className="w-4 h-4" />
            <span>Local Folder</span>
          </Inline>
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('web')}
          className={clsx(
            'px-4 py-2 rounded-t-lg text-sm font-medium transition-colors',
            activeMode === 'web'
              ? 'bg-white border border-b-white border-slate-200 -mb-[1px] text-slate-900'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <Inline gap="xs" align="center">
            <Globe className="w-4 h-4" />
            <span>Web URL</span>
          </Inline>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1">
        {activeMode === 'local' ? (
          /* Local Folder Mode */
          <div
            className={clsx(
              'border-2 border-dashed rounded-lg p-8 text-center transition-all',
              isDragOver
                ? 'border-blue-400 bg-blue-50'
                : sourcePath
                  ? 'border-green-300 bg-green-50'
                  : 'border-slate-300 hover:border-slate-400 bg-white/50'
            )}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {sourcePath ? (
              /* Selected state */
              <div className="text-green-700">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="w-6 h-6" />
                </div>
                <Text weight="medium" className="mb-2">
                  Folder selected
                </Text>
                <Text size="sm" className="text-green-600 font-mono bg-green-100 px-3 py-1 rounded inline-block">
                  {sourcePath}
                </Text>
                <div className="mt-4">
                  <Button variant="secondary" size="sm" onClick={handleBrowseFolder}>
                    Change Folder
                  </Button>
                </div>
              </div>
            ) : (
              /* Empty state */
              <>
                <FolderOpen className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <Text weight="medium" className="mb-2">
                  Drop folder here or{' '}
                  <button
                    type="button"
                    onClick={handleBrowseFolder}
                    className="text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    browse
                  </button>
                </Text>

                {/* Divider */}
                <div className="flex items-center gap-3 my-6">
                  <div className="flex-1 border-t border-slate-200" />
                  <Text size="xs" color="muted">
                    or paste path
                  </Text>
                  <div className="flex-1 border-t border-slate-200" />
                </div>

                {/* Path Input */}
                <Inline gap="sm" className="max-w-lg mx-auto">
                  <input
                    type="text"
                    value={sourcePath}
                    onChange={(e) => {
                      setSourcePath(e.target.value);
                      setError(null);
                    }}
                    placeholder="C:\path\to\folder or /home/user/images"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Button variant="secondary" onClick={handleBrowseFolder}>
                    Browse...
                  </Button>
                </Inline>
              </>
            )}
          </div>
        ) : (
          /* Web URL Mode */
          <div className="border-2 border-dashed rounded-lg p-8 text-center border-slate-300 bg-white/50">
            <Globe className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <Text weight="medium" className="mb-4">
              Enter artist page URL
            </Text>
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => {
                setSourceUrl(e.target.value);
                setError(null);
              }}
              placeholder="https://gallery.com/artist/brian-jungen"
              className="w-full max-w-md mx-auto px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Text size="xs" color="muted" className="mt-3">
              AutoHelper will crawl the page and extract artwork images
            </Text>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <Text size="sm" className="text-red-600">
              {error}
            </Text>
          </div>
        )}
      </div>

      {/* Footer */}
      <Inline justify="end" className="pt-4 mt-4 border-t border-slate-200 shrink-0">
        <Button onClick={handleNext} disabled={!hasValidSource}>
          Next: Stream & Review
        </Button>
      </Inline>
    </Stack>
  );
}

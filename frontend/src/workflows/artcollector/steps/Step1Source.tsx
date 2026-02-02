/**
 * Step 1: Source Input
 *
 * Accept URL or folder path for art collection.
 * Features BaseWeb-style dropzone with mode tabs (Web URL / Local Folder).
 */

import { useState } from 'react';
import { Stack, Text, Button, Inline } from '@autoart/ui';
import { FolderOpen, Globe, Check, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';

import { FiletreeSelector } from '../../../components/common/FiletreeSelector';

import { useArtCollectorContext } from '../context/ArtCollectorContext';
import { NamingConfigPanel } from '../components/NamingConfigPanel';
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
    namingConfig,
    updateNamingConfig,
  } = useArtCollectorContext();

  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFiletree, setShowFiletree] = useState(false);

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

    // Guard against null dataTransfer (can happen in some browsers/scenarios)
    const items = e.dataTransfer?.items;
    if (!items || items.length === 0) {
      return;
    }

    const item = items[0];
    if (item.kind !== 'file') {
      return;
    }

    const entry = (item as any).webkitGetAsEntry?.();

    if (entry && entry.isDirectory) {
      // For security reasons, browsers don't expose the full path
      // Prompt user to use the indexed folder browser instead
      setError('Drop detected. Please use "Browse Indexed Folders" to select a folder with full path.');
      setShowFiletree(true);
      return;
    }

    // Fallback / non-directory handling
    setError('File drops are not supported. Please select a folder using "Browse Indexed Folders" or paste a path.');
    setShowFiletree(true);
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
      <div className="flex gap-2 border-b border-ws-panel-border pb-2">
        <button
          type="button"
          onClick={() => handleModeChange('local')}
          className={clsx(
            'px-4 py-2 rounded-t-lg text-sm font-medium transition-colors',
            activeMode === 'local'
              ? 'bg-ws-panel-bg border border-b-white border-ws-panel-border -mb-[1px] text-ws-fg'
              : 'text-ws-text-secondary hover:text-ws-text-secondary'
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
              ? 'bg-ws-panel-bg border border-b-white border-ws-panel-border -mb-[1px] text-ws-fg'
              : 'text-ws-text-secondary hover:text-ws-text-secondary'
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
                  : 'border-slate-300 hover:border-slate-400 bg-ws-panel-bg/50'
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
                <div className="mt-4 space-y-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowFiletree(!showFiletree)}
                  >
                    Change Folder
                  </Button>
                  {showFiletree && (
                    <div className="max-w-lg mx-auto">
                      <FiletreeSelector
                        onSelect={(path, isDir) => {
                          if (isDir) {
                            setSourcePath(path);
                            setShowFiletree(false);
                            setError(null);
                          }
                        }}
                        allowDirSelection={true}
                        height={200}
                        placeholder="No indexed folders. Connect AutoHelper first."
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Empty state */
              <>
                <FolderOpen className="w-12 h-12 mx-auto mb-4 text-ws-muted" />
                <Text weight="medium" className="mb-2">
                  Select from indexed folders or paste a path
                </Text>

                {/* Toggle button for FiletreeSelector */}
                <Button
                  variant="secondary"
                  onClick={() => setShowFiletree(!showFiletree)}
                  className="mb-4"
                >
                  {showFiletree ? (
                    <ChevronUp className="w-4 h-4 mr-2" />
                  ) : (
                    <ChevronDown className="w-4 h-4 mr-2" />
                  )}
                  Browse Indexed Folders
                </Button>

                {/* FiletreeSelector */}
                {showFiletree && (
                  <div className="mb-4 max-w-lg mx-auto">
                    <FiletreeSelector
                      onSelect={(path, isDir) => {
                        if (isDir) {
                          setSourcePath(path);
                          setShowFiletree(false);
                          setError(null);
                        }
                      }}
                      allowDirSelection={true}
                      height={200}
                      placeholder="No indexed folders. Connect AutoHelper first."
                    />
                  </div>
                )}

                {/* Divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 border-t border-ws-panel-border" />
                  <Text size="xs" color="muted">
                    or paste path
                  </Text>
                  <div className="flex-1 border-t border-ws-panel-border" />
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
                </Inline>
              </>
            )}
          </div>
        ) : (
          /* Web URL Mode */
          <div className="border-2 border-dashed rounded-lg p-8 text-center border-slate-300 bg-ws-panel-bg/50">
            <Globe className="w-12 h-12 mx-auto mb-4 text-ws-muted" />
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

        {/* Naming Config Panel */}
        <div className="mt-6">
          <NamingConfigPanel config={namingConfig} onChange={updateNamingConfig} />
        </div>
      </div>

      {/* Footer */}
      <Inline justify="end" className="pt-4 mt-4 border-t border-ws-panel-border shrink-0">
        <Button onClick={handleNext} disabled={!hasValidSource}>
          Next: Stream & Review
        </Button>
      </Inline>
    </Stack>
  );
}

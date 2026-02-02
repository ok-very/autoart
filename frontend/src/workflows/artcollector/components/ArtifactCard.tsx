/**
 * ArtifactCard Component
 *
 * Displays a single artifact in the streaming gallery with selection overlay.
 */

import { useState } from 'react';
import { Check, Image as ImageIcon } from 'lucide-react';
import clsx from 'clsx';
import type { ArtifactPreview } from '../types';

export interface ArtifactCardProps {
  artifact: ArtifactPreview;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}

export function ArtifactCard({ artifact, isSelected, onToggleSelect }: ArtifactCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleClick = () => {
    onToggleSelect(artifact.ref_id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggleSelect(artifact.ref_id);
    }
  };

  return (
    <div
      role="checkbox"
      aria-checked={isSelected}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={clsx(
        'relative group cursor-pointer rounded-lg overflow-hidden transition-all',
        'border-2',
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-200'
          : 'border-transparent hover:border-slate-300'
      )}
    >
      {/* Image container with aspect ratio */}
      <div className="aspect-[4/3] bg-slate-100 relative">
        {!imageError ? (
          <img
            src={artifact.thumbnailUrl}
            alt={artifact.metadata?.title || 'Artifact'}
            className={clsx(
              'w-full h-full object-cover transition-opacity',
              imageLoaded ? 'opacity-100' : 'opacity-0'
            )}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        ) : null}

        {/* Loading/error placeholder */}
        {(!imageLoaded || imageError) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-ws-muted" />
          </div>
        )}

        {/* Selection overlay */}
        <div
          className={clsx(
            'absolute inset-0 transition-colors',
            isSelected ? 'bg-blue-500/20' : 'bg-transparent group-hover:bg-black/10'
          )}
        />

        {/* Checkbox indicator */}
        <div
          className={clsx(
            'absolute top-2 left-2 w-6 h-6 rounded-md flex items-center justify-center transition-all',
            isSelected
              ? 'bg-blue-500 text-white'
              : 'bg-ws-panel-bg/80 border border-slate-300 group-hover:border-slate-400'
          )}
        >
          {isSelected && <Check className="w-4 h-4" />}
        </div>

        {/* Metadata badge */}
        {artifact.metadata?.width && artifact.metadata?.height && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/60 text-white text-xs rounded">
            {artifact.metadata.width}×{artifact.metadata.height}
          </div>
        )}
      </div>

      {/* Title below image (optional) */}
      {artifact.metadata?.title && (
        <div className="px-2 py-1.5 bg-ws-panel-bg text-xs text-ws-text-secondary truncate">
          {artifact.metadata.title}
        </div>
      )}
    </div>
  );
}

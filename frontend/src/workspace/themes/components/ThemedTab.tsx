/**
 * Themed Tab Component
 *
 * A tab component that consumes CSS variables for styling.
 * Can be overridden entirely by theme modules.
 */

import type { IDockviewPanelHeaderProps } from 'dockview';
import { X } from 'lucide-react';
import { PANEL_DEFINITIONS, type PanelId } from '../../panelRegistry';

export function ThemedTab({ api }: IDockviewPanelHeaderProps) {
  const def = PANEL_DEFINITIONS[api.id as PanelId];
  const Icon = def?.icon;
  const isPermanent = def?.permanent ?? false;

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    api.close();
  };

  return (
    <div
      className="ws-tab font-sans"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--ws-tab-icon-gap)',
        height: 'var(--ws-tab-height)',
        padding: 'var(--ws-tab-padding-y) var(--ws-tab-padding-x)',
        color: 'inherit',
        overflow: 'hidden',
        width: '100%',
      }}
    >
      {/* Icon */}
      {Icon && (
        <Icon
          style={{
            width: 'var(--ws-tab-icon-size)',
            height: 'var(--ws-tab-icon-size)',
            flexShrink: 0,
          }}
          strokeWidth={2}
        />
      )}

      {/* Title */}
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {def?.title || api.title}
      </span>

      {/* Close button */}
      {!isPermanent && (
        <button
          onClick={handleClose}
          className="ws-tab-close"
          aria-label="Close panel"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 'var(--ws-tab-close-size)',
            height: 'var(--ws-tab-close-size)',
            padding: 0,
            border: 'none',
            background: 'transparent',
            borderRadius: '2px',
            cursor: 'pointer',
            opacity: 0,
            transition: 'opacity var(--ws-motion-duration-fast) var(--ws-motion-ease)',
          }}
        >
          <X
            style={{
              width: 'calc(var(--ws-tab-close-size) - 4px)',
              height: 'calc(var(--ws-tab-close-size) - 4px)',
            }}
          />
        </button>
      )}

      {/* Hover styles via inline style tag - themes can override */}
      <style>{`
        .ws-tab:hover .ws-tab-close {
          opacity: 1;
        }
        .ws-tab-close:hover {
          background: var(--ws-tab-close-hover-bg);
          color: var(--ws-tab-close-hover-fg);
        }
      `}</style>
    </div>
  );
}

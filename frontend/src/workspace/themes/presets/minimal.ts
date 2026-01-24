/**
 * Minimal Workspace Theme
 *
 * Stripped-down UI with hidden chrome until hover.
 * Maximum content area, minimal distractions.
 */

import type { DockviewApi } from 'dockview';
import type { WorkspaceThemeModule } from '../types';
import { registerWorkspaceTheme } from '../registry';

export const minimalTheme: WorkspaceThemeModule = {
  id: 'minimal',
  label: 'Minimal',
  description: 'Hidden chrome, maximum content area',
  density: 'comfortable',
  variant: 'minimal',

  css: {
    variables: {
      // Seamless bg
      '--ws-bg': '#ffffff',
      '--ws-group-bg': '#ffffff',
      '--ws-group-border': 'transparent',

      // Ultra-thin tabs
      '--ws-tabstrip-height': '24px',
      '--ws-tabstrip-bg': 'transparent',
      '--ws-tabstrip-border': 'transparent',

      '--ws-tab-height': '20px',
      '--ws-tab-padding-x': '8px',
      '--ws-tab-padding-y': '2px',
      '--ws-tab-fg': '#94a3b8',
      '--ws-tab-fg-active': '#475569',
      '--ws-tab-bg': 'transparent',
      '--ws-tab-bg-active': 'transparent',

      // Subtle indicator
      '--ws-tab-indicator-height': '1px',
      '--ws-tab-indicator-color': '#cbd5e1',

      // Nearly invisible sashes
      '--ws-sash-size': '1px',
      '--ws-sash-bg': '#f1f5f9',
      '--ws-sash-bg-hover': '#3b82f6',

      // No panel padding
      '--ws-panel-padding': '0px',
    },

    text: `
      /* Minimal theme - hide chrome until hover */
      [data-workspace-theme="minimal"] .tabs-container {
        opacity: 0;
        transition: opacity var(--ws-motion-duration) var(--ws-motion-ease);
      }

      [data-workspace-theme="minimal"] .groupview:hover .tabs-container,
      [data-workspace-theme="minimal"] .groupview:focus-within .tabs-container {
        opacity: 1;
      }

      /* Single-tab groups hide tabs entirely */
      [data-workspace-theme="minimal"] .groupview[data-tab-count="1"] .tabs-container {
        display: none;
      }

      /* Sashes only visible on hover */
      [data-workspace-theme="minimal"] .sash {
        opacity: 0;
        transition: opacity var(--ws-motion-duration) var(--ws-motion-ease);
      }

      [data-workspace-theme="minimal"] .sash:hover {
        opacity: 1;
      }
    `,
  },

  behavior: {
    attach(api: DockviewApi) {
      // Track tab count on groups for CSS targeting
      const updateTabCounts = () => {
        api.groups.forEach((group) => {
          const groupEl = document.querySelector(`[data-group-id="${group.id}"]`);
          if (groupEl) {
            groupEl.setAttribute('data-tab-count', String(group.panels.length));
          }
        });
      };

      const layoutDisposable = api.onDidLayoutChange(() => {
        updateTabCounts();
      });

      // Initial update
      updateTabCounts();

      return () => {
        layoutDisposable.dispose();
      };
    },
  },

  rootAttributes: {
    'data-variant': 'minimal',
  },
};

// Self-register
registerWorkspaceTheme(minimalTheme);

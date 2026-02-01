/**
 * Parchment Workspace Theme
 *
 * Warm, archival aesthetic emphasizing cognitive comfort.
 * Based on AutoArt Design System palette.
 *
 * @see docs/DESIGN.md
 */

import type { WorkspaceThemeModule } from '../types';
import { registerWorkspaceTheme } from '../registry';

export const parchmentTheme: WorkspaceThemeModule = {
  id: 'parchment',
  label: 'Parchment',
  description: 'Warm, archival aesthetic for focused work',
  density: 'default',
  variant: 'solid',

  css: {
    variables: {
      // Foundation Neutrals
      '--ws-bg': '#F5F2ED', // Parchment
      '--ws-fg': '#2E2E2C', // Charcoal Ink
      '--ws-muted-fg': '#6B6560', // Derived muted

      // Structural Accent (darkened Oxide Blue — deeper, more saturated)
      '--ws-accent': '#2F4F65',
      '--ws-accent-fg': '#FFFFFF',

      // Panel Groups
      '--ws-group-bg': '#FDFCFA', // Lighter parchment
      '--ws-group-border': '#D6D2CB', // Ash Taupe
      '--ws-group-shadow': 'none',

      // Tab Strip
      '--ws-tabstrip-bg': '#EBE8E3', // Darker parchment
      '--ws-tabstrip-border': '#D6D2CB',

      // Tab Colors
      '--ws-tab-fg': '#6B6560',
      '--ws-tab-fg-hover': '#4A4540',
      '--ws-tab-fg-active': '#2E2E2C',
      '--ws-tab-bg': 'transparent',
      '--ws-tab-bg-hover': '#D6D2CB',
      '--ws-tab-bg-active': '#FDFCFA',
      '--ws-tab-border-active': '#2F4F65',
      '--ws-tab-indicator-color': '#2F4F65',

      // Tab Close Button
      '--ws-tab-close-hover-bg': '#C4BFB8',
      '--ws-tab-close-hover-fg': '#2E2E2C',

      // Panel Content
      '--ws-panel-bg': '#FDFCFA',
      '--ws-panel-fg': '#2E2E2C',
      '--ws-panel-border': '#D6D2CB',

      // Scrollbar
      '--ws-scrollbar-track': '#EBE8E3',
      '--ws-scrollbar-thumb': '#C4BFB8',
      '--ws-scrollbar-thumb-hover': '#A39E96',

      // Splitters
      '--ws-sash-bg-hover': '#2F4F65',
      '--ws-sash-bg-active': '#2F4F65',

      // Drop Target
      '--ws-drop-target-bg': 'rgba(47, 79, 101, 0.1)',
      '--ws-drop-target-border': '#2F4F65',
      '--ws-drop-target-shadow': `
        inset 0 0 12px rgba(47, 79, 101, 0.14),
        inset 0 0 4px rgba(47, 79, 101, 0.10),
        0 0 8px rgba(47, 79, 101, 0.07)`,

      // Watermark
      '--ws-watermark-bg': '#F5F2ED',
      '--ws-watermark-fg': '#A39E96',
    },

    text: `
      /* Parchment theme - warm backgrounds */
      [data-workspace-theme="parchment"] {
        --focus-ring-color: #2F4F65;
      }

      /* Softer borders for the archival feel */
      [data-workspace-theme="parchment"] .dv-groupview {
        border: 1px solid #D6D2CB;
      }
    `,
  },

  rootAttributes: {
    'data-color-scheme': 'light',
    'data-palette': 'warm',
  },
};

// Self-register
registerWorkspaceTheme(parchmentTheme);

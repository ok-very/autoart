/**
 * Compact Workspace Theme
 *
 * Reduced padding and smaller tabs for dense layouts.
 * Ideal for power users with multiple panels.
 */

import type { WorkspaceThemeModule } from '../types';
import { registerWorkspaceTheme } from '../registry';

export const compactTheme: WorkspaceThemeModule = {
  id: 'compact',
  label: 'Compact',
  description: 'Dense layout with smaller tabs and reduced spacing',
  density: 'compact',
  variant: 'solid',

  css: {
    variables: {
      // Reduced tab dimensions
      '--ws-tabstrip-height': '28px',
      '--ws-tab-height': '24px',
      '--ws-tab-padding-x': '8px',
      '--ws-tab-padding-y': '4px',
      '--ws-tab-gap': '1px',
      '--ws-tab-icon-size': '12px',
      '--ws-tab-icon-gap': '4px',

      // Smaller close button
      '--ws-tab-close-size': '14px',

      // Thinner indicator
      '--ws-tab-indicator-height': '1px',

      // Tighter sashes
      '--ws-sash-size': '2px',
      '--ws-sash-hit-size': '6px',

      // Faster animations
      '--ws-motion-duration-fast': '50ms',
      '--ws-motion-duration': '100ms',
    },
  },

  rootAttributes: {
    'data-density': 'compact',
  },
};

// Self-register
registerWorkspaceTheme(compactTheme);

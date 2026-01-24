/**
 * Floating Workspace Theme
 *
 * Elevated panels with shadows and rounded corners.
 * Creates a modern, layered appearance.
 */

import type { DockviewApi } from 'dockview';
import type { WorkspaceThemeModule } from '../types';
import { registerWorkspaceTheme } from '../registry';

export const floatingTheme: WorkspaceThemeModule = {
  id: 'floating',
  label: 'Floating',
  description: 'Elevated panels with shadows and rounded corners',
  density: 'default',
  variant: 'floating',

  css: {
    variables: {
      // Elevated workspace bg
      '--ws-bg': '#f1f5f9',

      // Elevated groups
      '--ws-group-bg': '#ffffff',
      '--ws-group-border': 'transparent',
      '--ws-group-radius': '8px',
      '--ws-group-shadow': '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
      '--ws-group-padding': '0px',

      // Active ring
      '--ws-group-active-ring': '2px',
      '--ws-group-active-ring-color': '#3b82f6',

      // Rounded tabs
      '--ws-tabstrip-bg': '#f8fafc',
      '--ws-tab-radius': '6px',
      '--ws-tab-bg-active': '#ffffff',

      // Pill-style indicator
      '--ws-tab-indicator-height': '0px',

      // Visible sashes
      '--ws-sash-bg': '#e2e8f0',
      '--ws-sash-size': '8px',

      // Drop target
      '--ws-drop-target-radius': '8px',

      // Smoother motion
      '--ws-motion-duration': '200ms',
      '--ws-motion-ease': 'cubic-bezier(0.22, 1, 0.36, 1)',
    },

    text: `
      /* Floating theme overrides */
      [data-workspace-theme="floating"] .dockview-react {
        padding: 8px;
        gap: 8px;
      }

      [data-workspace-theme="floating"] .groupview {
        border-radius: var(--ws-group-radius);
        box-shadow: var(--ws-group-shadow);
        overflow: hidden;
      }

      [data-workspace-theme="floating"] .groupview.active-group {
        box-shadow: 
          var(--ws-group-shadow),
          0 0 0 var(--ws-group-active-ring) var(--ws-group-active-ring-color);
      }

      [data-workspace-theme="floating"] .tabs-container {
        padding: 4px 4px 0 4px;
      }

      [data-workspace-theme="floating"] .tab {
        border-radius: var(--ws-tab-radius) var(--ws-tab-radius) 0 0;
      }
    `,
  },

  behavior: {
    attach(api: DockviewApi) {
      // Add active group tracking
      const disposable = api.onDidActiveGroupChange((event) => {
        // Remove active from all groups
        document.querySelectorAll('.groupview').forEach((el) => {
          el.classList.remove('active-group');
        });

        // Add active to current group
        if (event.group) {
          const groupEl = document.querySelector(`[data-group-id="${event.group.id}"]`);
          groupEl?.classList.add('active-group');
        }
      });

      return () => {
        disposable.dispose();
      };
    },

    onActivate() {
      document.body.classList.add('ws-theme-floating');
    },

    onDeactivate() {
      document.body.classList.remove('ws-theme-floating');
    },
  },

  rootAttributes: {
    'data-variant': 'floating',
  },
};

// Self-register
registerWorkspaceTheme(floatingTheme);

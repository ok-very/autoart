/**
 * Default Workspace Theme
 *
 * The baseline theme - clean, professional, no-frills.
 * Uses default CSS variable values.
 */

import type { WorkspaceThemeModule } from '../types';
import { registerWorkspaceTheme } from '../registry';

export const defaultTheme: WorkspaceThemeModule = {
  id: 'default',
  label: 'Default',
  description: 'Clean, professional workspace layout',
  density: 'default',
  variant: 'solid',
};

// Self-register
registerWorkspaceTheme(defaultTheme);

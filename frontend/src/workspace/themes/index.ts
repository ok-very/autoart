/**
 * Workspace Themes - Public API
 *
 * Export everything needed to create and consume themes.
 */

// Types
export type {
  WorkspaceThemeId,
  WorkspaceThemeModule,
  WorkspaceBehaviorHooks,
  ThemeComponentOverrides,
  ThemeCSSConfig,
  ThemeDensity,
  ThemeVariant,
  WorkspaceThemeRegistry,
} from './types';

// Registry
export { workspaceThemeRegistry, registerWorkspaceTheme } from './registry';

// Hooks
export {
  useWorkspaceTheme,
  useWorkspaceThemeId,
  useAvailableThemes,
  useThemeBehavior,
  useThemeCSS,
  useThemeRootAttributes,
  setWorkspaceTheme,
  getWorkspaceThemeId,
} from './useWorkspaceTheme';

// Components
export { ThemedTab } from './components/ThemedTab';
export { ThemePicker, ThemePickerMinimal } from './components/ThemePicker';

// Register built-in presets (side effect)
import './presets';

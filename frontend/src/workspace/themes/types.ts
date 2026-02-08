/**
 * Workspace Theme Types
 *
 * Plug-and-play theming system for Dockview panels.
 * Designers can create new themes by implementing WorkspaceThemeModule.
 */

import type { DockviewApi, IDockviewPanelHeaderProps } from 'dockview';
import type { ComponentType } from 'react';

// ============================================================================
// THEME IDENTITY
// ============================================================================

export type WorkspaceThemeId = string;

export type ThemeDensity = 'compact' | 'default' | 'comfortable';
export type ThemeVariant = 'solid' | 'floating' | 'minimal' | 'glass' | 'neumorphic';

// ============================================================================
// BEHAVIOR HOOKS
// ============================================================================

export interface WorkspaceBehaviorHooks {
  /**
   * Called after DockviewApi becomes available.
   * Return a cleanup function to detach event listeners.
   */
  attach(api: DockviewApi): () => void;

  /** Called when this theme becomes active */
  onActivate?(): void;

  /** Called when switching away from this theme */
  onDeactivate?(): void;

  /** Called before a panel opens - can add classes/set focus */
  onWillOpenPanel?(panelId: string, api: DockviewApi): void;

  /** Called before a panel closes - return Promise for exit animations */
  onWillClosePanel?(panelId: string, reason: 'user' | 'programmatic'): Promise<void>;

  /** Called when active panel changes */
  onActivePanelChange?(activePanelId: string | null): void;
}

// ============================================================================
// COMPONENT OVERRIDES
// ============================================================================

export interface ThemeComponentOverrides {
  /** Custom tab component (replaces IconTab) */
  tabComponent?: ComponentType<IDockviewPanelHeaderProps>;

  /** Custom watermark for empty workspace */
  watermarkComponent?: ComponentType;

  /** Optional wrapper around panel content for animations/frames */
  panelFrame?: ComponentType<{ children: React.ReactNode; panelId: string }>;
}

// ============================================================================
// CSS INJECTION
// ============================================================================

export interface ThemeCSSConfig {
  /** URL to external stylesheet */
  href?: string;

  /** Inline CSS text to inject */
  text?: string;

  /** CSS custom properties to set on theme root */
  variables?: Record<string, string>;
}

// ============================================================================
// MAIN THEME MODULE INTERFACE
// ============================================================================

export interface WorkspaceThemeModule {
  /** Unique theme identifier */
  id: WorkspaceThemeId;

  /** Display name for UI */
  label: string;

  /** Optional description */
  description?: string;

  /** Theme categorization */
  density?: ThemeDensity;
  variant?: ThemeVariant;

  /** CSS configuration */
  css?: ThemeCSSConfig;

  /** Additional attributes applied to workspace root element */
  rootAttributes?: Record<string, string>;

  /** React component overrides */
  components?: ThemeComponentOverrides;

  /** Behavior hooks for animations and interactions */
  behavior?: WorkspaceBehaviorHooks;

  /** Preview thumbnail URL for theme picker */
  previewUrl?: string;
}

// ============================================================================
// REGISTRY INTERFACE
// ============================================================================

export interface WorkspaceThemeRegistry {
  /** Register a new theme */
  register(theme: WorkspaceThemeModule): void;

  /** Unregister a theme by ID */
  unregister(id: WorkspaceThemeId): void;

  /** Get a theme by ID */
  get(id: WorkspaceThemeId): WorkspaceThemeModule | undefined;

  /** List all registered themes */
  list(): readonly WorkspaceThemeModule[];

  /** Get themes by density */
  getByDensity(density: ThemeDensity): WorkspaceThemeModule[];

  /** Get themes by variant */
  getByVariant(variant: ThemeVariant): WorkspaceThemeModule[];
}

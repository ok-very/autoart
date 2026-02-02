/**
 * Workspace Theme Registry
 *
 * Central registry for all workspace themes.
 * Themes self-register by importing and calling register().
 */

import type {
  WorkspaceThemeModule,
  WorkspaceThemeId,
  WorkspaceThemeRegistry,
  ThemeDensity,
  ThemeVariant,
} from './types';

// ============================================================================
// REGISTRY IMPLEMENTATION
// ============================================================================

class ThemeRegistryImpl implements WorkspaceThemeRegistry {
  private themes = new Map<WorkspaceThemeId, WorkspaceThemeModule>();
  private listeners = new Set<() => void>();
  private cachedList: WorkspaceThemeModule[] | null = null;

  register(theme: WorkspaceThemeModule): void {
    if (this.themes.has(theme.id)) {
      console.warn(`Theme "${theme.id}" is already registered. Overwriting.`);
    }
    this.themes.set(theme.id, theme);
    this.cachedList = null;
    this.notifyListeners();
  }

  unregister(id: WorkspaceThemeId): void {
    if (this.themes.delete(id)) {
      this.cachedList = null;
      this.notifyListeners();
    }
  }

  get(id: WorkspaceThemeId): WorkspaceThemeModule | undefined {
    return this.themes.get(id);
  }

  list(): WorkspaceThemeModule[] {
    return (this.cachedList ??= Array.from(this.themes.values()));
  }

  getByDensity(density: ThemeDensity): WorkspaceThemeModule[] {
    return this.list().filter((t) => t.density === density);
  }

  getByVariant(variant: ThemeVariant): WorkspaceThemeModule[] {
    return this.list().filter((t) => t.variant === variant);
  }

  /** Subscribe to registry changes */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((fn) => fn());
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const workspaceThemeRegistry = new ThemeRegistryImpl();

// Convenience function for theme modules
export function registerWorkspaceTheme(theme: WorkspaceThemeModule): void {
  workspaceThemeRegistry.register(theme);
}

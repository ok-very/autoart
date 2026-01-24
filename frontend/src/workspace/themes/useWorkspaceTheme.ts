/**
 * Workspace Theme Hook
 *
 * Manages active theme state and provides theme-aware components.
 */

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { DockviewApi } from 'dockview';

import { workspaceThemeRegistry } from './registry';
import type { WorkspaceThemeModule, WorkspaceThemeId } from './types';
import { useUIStore } from '../../stores/uiStore';

// ============================================================================
// THEME STATE (stored in uiStore)
// ============================================================================

// Extend uiStore with theme state - see integration notes below
// For now, use a simple module-level state with localStorage

const THEME_STORAGE_KEY = 'workspace-theme-id';
const DEFAULT_THEME_ID = 'default';

function getStoredThemeId(): WorkspaceThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME_ID;
  return localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME_ID;
}

let currentThemeId = getStoredThemeId();
const themeListeners = new Set<() => void>();

function notifyThemeChange() {
  themeListeners.forEach((fn) => fn());
}

export function setWorkspaceTheme(id: WorkspaceThemeId): void {
  const theme = workspaceThemeRegistry.get(id);
  if (!theme) {
    console.warn(`Theme "${id}" not found in registry`);
    return;
  }

  const previousTheme = workspaceThemeRegistry.get(currentThemeId);
  previousTheme?.behavior?.onDeactivate?.();

  currentThemeId = id;
  if (typeof window !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  }

  theme.behavior?.onActivate?.();
  notifyThemeChange();
}

export function getWorkspaceThemeId(): WorkspaceThemeId {
  return currentThemeId;
}

// ============================================================================
// REACT HOOKS
// ============================================================================

/**
 * Subscribe to current theme ID
 */
export function useWorkspaceThemeId(): WorkspaceThemeId {
  return useSyncExternalStore(
    (callback) => {
      themeListeners.add(callback);
      return () => themeListeners.delete(callback);
    },
    () => currentThemeId,
    () => DEFAULT_THEME_ID
  );
}

/**
 * Get the current theme module
 */
export function useWorkspaceTheme(): WorkspaceThemeModule | undefined {
  const themeId = useWorkspaceThemeId();

  // Also subscribe to registry changes (in case theme is registered late)
  useSyncExternalStore(
    (cb) => workspaceThemeRegistry.subscribe(cb),
    () => workspaceThemeRegistry.list().length,
    () => 0
  );

  return workspaceThemeRegistry.get(themeId);
}

/**
 * Get all available themes
 */
export function useAvailableThemes(): WorkspaceThemeModule[] {
  return useSyncExternalStore(
    (cb) => workspaceThemeRegistry.subscribe(cb),
    () => workspaceThemeRegistry.list(),
    () => []
  );
}

/**
 * Attach theme behavior hooks to Dockview API
 */
export function useThemeBehavior(api: DockviewApi | null): void {
  const theme = useWorkspaceTheme();
  const detachRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Cleanup previous behavior
    if (detachRef.current) {
      detachRef.current();
      detachRef.current = null;
    }

    // Attach new behavior
    if (api && theme?.behavior?.attach) {
      detachRef.current = theme.behavior.attach(api);
    }

    return () => {
      if (detachRef.current) {
        detachRef.current();
        detachRef.current = null;
      }
    };
  }, [api, theme]);
}

// Track all CSS variables set by themes to ensure complete cleanup
const appliedCssVariables = new Set<string>();

/**
 * Inject theme CSS variables and stylesheets
 */
export function useThemeCSS(): void {
  const theme = useWorkspaceTheme();

  useEffect(() => {
    const styleElements: HTMLStyleElement[] = [];
    const linkElements: HTMLLinkElement[] = [];
    const root = document.documentElement;

    // First, clean up ALL previously applied CSS variables
    appliedCssVariables.forEach((key) => {
      root.style.removeProperty(key);
    });
    appliedCssVariables.clear();

    if (!theme?.css) return;

    // Inject inline CSS
    if (theme.css.text) {
      const style = document.createElement('style');
      style.setAttribute('data-workspace-theme', theme.id);
      style.textContent = theme.css.text;
      document.head.appendChild(style);
      styleElements.push(style);
    }

    // Inject external stylesheet
    if (theme.css.href) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = theme.css.href;
      link.setAttribute('data-workspace-theme', theme.id);
      document.head.appendChild(link);
      linkElements.push(link);
    }

    // Apply CSS variables to root and track them
    if (theme.css.variables) {
      Object.entries(theme.css.variables).forEach(([key, value]) => {
        root.style.setProperty(key, value);
        appliedCssVariables.add(key);
      });
    }

    return () => {
      styleElements.forEach((el) => el.remove());
      linkElements.forEach((el) => el.remove());
    };
  }, [theme]);
}

/**
 * Get root attributes for the workspace container
 */
export function useThemeRootAttributes(): Record<string, string> {
  const theme = useWorkspaceTheme();
  const themeId = useWorkspaceThemeId();

  return useMemo(
    () => ({
      'data-workspace-theme': themeId,
      ...(theme?.rootAttributes || {}),
    }),
    [theme, themeId]
  );
}

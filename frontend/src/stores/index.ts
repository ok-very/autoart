/**
 * Stores Barrel Export
 * 
 * Re-exports all Zustand stores for consistent imports.
 * Import from '@/stores' instead of individual store files.
 */

export { useUIStore } from './uiStore';
export { useAuthStore } from './authStore';
export { useHierarchyStore } from './hierarchyStore';
export { useImportWorkbenchStore } from './importWorkbenchStore';
export { useExportWorkbenchStore } from './exportWorkbenchStore';
export { useProjectionStore } from './projectionStore';
export { useCollectionStore } from './collectionStore';
export type { Collection, SelectionReference, SelectionType, TemplatePreset } from './collectionStore';


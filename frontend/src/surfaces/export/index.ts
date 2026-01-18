/**
 * Export Surface Components
 */

// Workbench components (for WorkbenchPage)
export { ExportWorkbenchSidebar } from './ExportWorkbenchSidebar';
export { ExportWorkbenchContent } from './ExportWorkbenchContent';

// Legacy monolithic workbench (deprecated - use sidebar + content components)
export { ExportWorkbench } from './ExportWorkbench';

// Preview components
export { ExportPreview } from './ExportPreview';
export { ExportProjectList } from './ExportProjectList';

// Collection system
export { CollectionModeProvider, useCollectionMode, useCollectionModeOptional } from './CollectionModeProvider';
export { SelectableWrapper } from './SelectableWrapper';
export { CollectionFlashOverlay } from './CollectionFlashOverlay';
export { CollectionItemCard } from './CollectionItemCard';
export { TemplatePresetSelector } from './TemplatePresetSelector';

// Re-export types
export * from './types';


/**
 * Export Surface Components
 */

// Workbench components (for WorkbenchPage)
export { ExportWorkbenchSidebar } from './panels/ExportWorkbenchSidebar';
export { ExportWorkbenchContent } from './views/ExportWorkbenchContent';

// Legacy monolithic workbench (deprecated - use sidebar + content components)
export { ExportWorkbench } from './views/ExportWorkbench';

// Preview components
export { ExportPreview } from './components/ExportPreview';
export { ExportProjectList } from './components/ExportProjectList';

// Collection system
export { CollectionModeProvider, useCollectionMode, useCollectionModeOptional } from './context/CollectionModeProvider';
export { SelectableWrapper } from './components/SelectableWrapper';
export { CollectionFlashOverlay } from './components/CollectionFlashOverlay';
export { CollectionItemCard } from './components/CollectionItemCard';
export { TemplatePresetSelector } from './components/TemplatePresetSelector';
export { CollectionPanel } from './panels/CollectionPanel';
export { CollectionPreview } from './components/CollectionPreview';

// Re-export types
export * from './types';


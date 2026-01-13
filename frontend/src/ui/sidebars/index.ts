/**
 * ui/sidebars - Reusable sidebar components
 *
 * CONVENTION:
 * - Page-specific sidebars: co-locate with their page in surfaces/{pageName}/
 * - Reusable sidebars: export from this index for discoverability
 *
 * Page-specific (NOT exported here):
 * - surfaces/import/ImportSidebar.tsx
 * - surfaces/import/SourceIconSidebar.tsx
 * - surfaces/export/ExportSidebar.tsx
 * - surfaces/export/ExportWorkbenchSidebar.tsx
 */

// Reusable sidebar components
export { HierarchySidebar } from '../hierarchy/HierarchySidebar';
export { RecordTypeSidebar } from '../records/RecordTypeSidebar';
export { RegistrySidebar } from '../records/RegistrySidebar';
export { DefinitionListSidebar } from '../registry/DefinitionListSidebar';

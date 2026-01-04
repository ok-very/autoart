/**
 * API Hooks - Re-exports all domain-specific hooks
 *
 * This barrel file maintains backwards compatibility with imports from '@/api/hooks'
 * while the hooks are now organized by domain:
 *
 * - auth.ts: useLogin, useRegister, useLogout, useCurrentUser
 * - hierarchy.ts: useProjects, useProjectTree, useNode, CRUD, useMoveNode, useCloneNode
 * - records.ts: useRecords, useRecord, CRUD, useRecordStats, bulk operations
 * - definitions.ts: useRecordDefinitions, CRUD, template library operations
 * - references.ts: useTaskReferences, mode/snapshot updates, resolution
 * - links.ts: useRecordLinks, CRUD, useLinkTypes
 * - ingestion.ts: parsers, preview, import
 * - search.ts: useSearch
 *
 * Factory utilities are available via './factory' for creating custom CRUD hooks.
 */

// Auth
export {
  useLogin,
  useRegister,
  useLogout,
  useCurrentUser,
} from './auth';

// Hierarchy
export {
  useProjects,
  useProjectTree,
  useNode,
  useCreateNode,
  useUpdateNode,
  useDeleteNode,
  useMoveNode,
  useCloneNode,
} from './hierarchy';

// Record Definitions
export {
  useRecordDefinitions,
  useRecordDefinition,
  useCreateDefinition,
  useUpdateDefinition,
  useDeleteDefinition,
  useProjectTemplates,
  useSaveToLibrary,
  useRemoveFromLibrary,
  useToggleCloneExcluded,
  useCloneStats,
} from './definitions';

// Records
export {
  useRecords,
  useRecord,
  useCreateRecord,
  useUpdateRecord,
  useDeleteRecord,
  useRecordStats,
  useBulkClassifyRecords,
  useBulkDeleteRecords,
} from './records';

// References
export {
  useTaskReferences,
  useCreateReference,
  useDeleteReference,
  useUpdateReferenceMode,
  useUpdateReferenceSnapshot,
  useResolveReference,
  useCheckDrift,
  useResolveReferences,
} from './references';

// Links
export {
  useRecordLinks,
  useCreateLink,
  useDeleteLink,
  useLinkTypes,
  type RecordLink,
} from './links';

// Ingestion
export {
  useIngestionParsers,
  useIngestionPreview,
  useRunIngestion,
  type ParserConfigField,
  type ParserSummary,
  type ParsedNode,
  type ParsedData,
  type PreviewResult,
  type IngestionResult,
} from './ingestion';

// Composer (Task Builder on Actions + Events)
export {
  useCompose,
  useQuickTask,
  useQuickBug,
  buildTaskInput,
  buildBugInput,
} from './composer';

// Search
export { useSearch } from './search';

// Factory (for custom CRUD hooks)
export { createCrudHooks, createFilteredListHook } from './factory';
export type { CrudHookConfig, CrudHooks } from './factory';

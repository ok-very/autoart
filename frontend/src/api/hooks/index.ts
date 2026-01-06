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
  useRecordDefinitionsFiltered,
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

// Actions & Events
export {
  useActions,
  useAction,
  useAllActions,
  useAllActionsByType,
  useAllActionsByDefinition,
  useCreateAction,
  useRetractAction,
  useAmendAction,
  useActionEvents,
  useContextEvents,
  useEmitEvent,
  useEmitActionEvents,
  useStartWork,
  useStopWork,
  useFinishWork,
  useBlockWork,
  useUnblockWork,
  useAssignWork,
  useUnassignWork,
  useRecordFieldValue,
  useContainerActions,
  useSubprocesses,
  useChildActions,
} from './actions';

// Action Views
export {
  useActionViews,
  useActionView,
  useActionViewsSummary,
} from './actionViews';

// Workflow Surface (Materialized Projection)
export {
  useWorkflowSurfaceNodes,
  useAddDependency,
  useRemoveDependency,
  useMoveWorkflowRow,
  useRefreshWorkflowSurface,
  buildChildrenMap,
  getRootNodes,
  getChildren,
} from './workflowSurface';

// Action References
export {
  useActionReferences,
  useAddActionReference,
  useRemoveActionReference,
  useSetActionReferences,
  type ActionReference,
  type ReferenceInput,
} from './actionReferences';

// Composer (Task Builder on Actions + Events)
export {
  useCompose,
  useQuickTask,
  useQuickBug,
  buildTaskInput,
  buildBugInput,
} from './composer';

// Project Log (Event Stream)
export {
  useProjectLogEvents,
  useProjectLogEventCount,
  type EventsPageResponse,
  type UseProjectLogEventsOptions,
} from './projectLog';

// Search
export { useSearch } from './search';

// Fact Kinds (Definition Review UI)
export {
  useFactKindDefinitions,
  useFactKindsNeedingReview,
  useFactKindStats,
  useFactKindDefinition,
  useApproveFactKind,
  useDeprecateFactKind,
  useMergeFactKinds,
  type FactKindDefinition,
  type FactKindStats,
} from './factKinds';

// Factory (for custom CRUD hooks)
export { createCrudHooks, createFilteredListHook } from './factory';
export type { CrudHookConfig, CrudHooks } from './factory';

// Admin
export {
  useAdminUsers,
  useSoftDeleteUser,
  type AdminUser,
} from './admin';

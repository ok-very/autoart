/**
 * API Hooks - Re-exports all domain-specific hooks
 *
 * This barrel file maintains backwards compatibility with imports from '@/api/hooks'
 * while hooks are now organized by category:
 *
 * **Entities** (CRUD operations on data entities):
 * - auth.ts: useLogin, useRegister, useLogout, useCurrentUser
 * - hierarchy.ts: useProjects, useProjectTree, useNode, CRUD, useMoveNode, useCloneNode
 * - records.ts: useRecords, useRecord, CRUD, useRecordStats, bulk operations
 * - definitions.ts: useRecordDefinitions, CRUD, template library operations
 * - references.ts: (removed — use actionReferences.ts instead)
 * - links.ts: useRecordLinks, CRUD, useLinkTypes
 *
 * **Actions** (Action/Event architecture):
 * - actions.ts: Action CRUD, workflow operations (start/stop/finish/block/assign)
 * - actionViews.ts: Materialized projections
 * - actionReferences.ts: Action reference management
 * - composer.ts: Task builder
 * - projectLog.ts: Event stream
 * - workflowSurface.ts: Materialized DAG
 *
 * **Operations** (Complex operations):
 * - imports.ts: Data ingestion, classification
 * - exports.ts: Data export, formatting
 * - ingestion.ts: Parsers, preview, import
 * - search.ts: Search functionality
 * - interpretation.ts: AI/ML interpretation
 *
 * **Utilities**:
 * - factory.ts: Factory utilities for creating custom CRUD hooks
 * - queryKeys.ts: Centralized TanStack Query key definitions
 *
 * @see ./queryKeys.ts for centralized query key definitions
 */

// ============================================================================
// CATEGORY EXPORTS (New Structure)
// ============================================================================

// Entities - CRUD operations on data entities
export * from './entities';

// Actions - Action/Event architecture primitives
export * from './actions';

// Operations - Complex operations (imports, exports, search, etc.)
export * from './operations';

// ============================================================================
// DIRECT EXPORTS (Maintained for backwards compatibility)
// ============================================================================

// Auth (Root level - not in a category)
export {
  useLogin,
  useRegister,
  useLogout,
  useLogoutEverywhere,
  useCurrentUser,
  useUpdateProfile,
  useChangePassword,
  useUploadAvatar,
  useDeleteAvatar,
  useSessions,
  useUserSettings,
  useUserSetting,
  useSetUserSetting,
  useSearchUsers,
} from './auth';

// Hierarchy (Also exported via ./entities)
export {
  useProjects,
  useProjectTree,
  useNode,
  useNodePath,
  useCreateNode,
  useUpdateNode,
  useDeleteNode,
  useMoveNode,
  useCloneNode,
  type AncestorPathEntry,
} from './hierarchy';

// Record Definitions (Also exported via ./entities)
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

// Records (Also exported via ./entities)
export {
  useRecords,
  useRecord,
  useCreateRecord,
  useUpdateRecord,
  useDeleteRecord,
  useRecordStats,
  useBulkClassifyRecords,
  useBulkDeleteRecords,
  useRecordHistory,
} from './records';

// Links (Also exported via ./entities)
export {
  useRecordLinks,
  useCreateLink,
  useDeleteLink,
  useLinkTypes,
  type RecordLink,
} from './links';

// Ingestion (Also exported via ./operations)
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

// Actions & Events (Also exported via ./actions)
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
  useRescheduleAction,
  useContainerActions,
  useSubprocesses,
  useChildActions,
} from './actions';


// Action Views (Also exported via ./actions)
export {
  useActionViews,
  useActionView,
  useActionViewsSummary,
} from './actionViews';

// Workflow Surface (Also exported via ./actions)
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

// Action References (Also exported via ./actions)
export {
  useActionReferences,
  useAddActionReference,
  useRemoveActionReference,
  useSetActionReferences,
  type ActionReference,
  type ReferenceInput,
} from './actionReferences';

// Composer (Also exported via ./actions)
export { useCompose } from './composer';

// Project Log (Also exported via ./actions)
export {
  useProjectLogEvents,
  useProjectLogEventCount,
  type EventsPageResponse,
  type UseProjectLogEventsOptions,
} from './projectLog';

// Search (Also exported via ./operations)
export { useSearch } from './search';

// Fact Kinds (Root level - Definition Review UI)
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

// Admin (Root level)
export {
  useAdminUsers,
  useSoftDeleteUser,
  useCreateUser,
  useUpdateUser,
  useResetUserPassword,
  type AdminUser,
} from './admin';

// Project Members
export {
  useProjectMembers,
  useAddProjectMember,
  useRemoveProjectMember,
  useUpdateProjectMemberRole,
  useTransferOwnership,
  type ProjectMember,
} from './projectMembers';

// Intake Forms
export {
  useIntakeForms,
  useIntakeForm,
  useCreateIntakeForm,
  useUpdateIntakeForm,
  useUpsertIntakeFormPage,
  useDeleteIntakeFormPage,
  useIntakeSubmissions,
} from './intake';

// Polls
export {
  usePolls,
  useCreatePoll,
  useClosePoll,
} from './polls';

// Mail (AutoHelper integration)
export {
  useInbox,
  useEnrichedInbox,
  useEmail,
  useMailStatus,
  useUpdateTriage,
  useArchiveEmail,
  useMarkActionRequired,
  useMarkInformational,
  mailQueryKeys,
} from './mail';

// Mail Messages (PostgreSQL persistence - promoted emails + links)
export {
  useMailMessages,
  useMailMessage,
  usePromotedIds,
  usePromoteEmail,
  useLinkEmail,
  useUnlinkEmail,
  useMailLinksForTarget,
  mailMessageQueryKeys,
} from './mailMessages';

// AutoHelper Filetree, Export & Artifact Lookup
export {
  useFiletree,
  useExportIntakeCSV,
  useArtifactLookup,
  type FiletreeNode,
  type FiletreeResponse,
  type IntakeCSVExportRequest,
  type IntakeCSVExportResponse,
  type ArtifactLookupResult,
} from './autohelper';

// Interpretation (Also exported via ./operations)
export {
  useInterpretationAvailable,
  useInterpretationPlan,
  useApproveFactCandidate,
  useRejectFactCandidate,
  type InterpretationOutput,
  type InterpretationPlan,
  type InterpretationAvailability,
} from './interpretation';

// Mappings (Cross-entity relationships)
export {
  useActionMappings,
  useRecordMappings,
  getMappingStatus,
  toMappingEntries,
  type ActionMappings,
  type RecordMappings,
  type MappingStatus,
  type MappingEntry,
} from './mappings';

// Suggestions (Context-aware suggestions)
export {
  useComposerSuggestions,
  useEmailSuggestions,
  useActionSuggestions,
  useContextSuggestions,
  generateMockComposerSuggestions,
  generateMockEmailSuggestions,
  type Suggestion,
  type SuggestionType,
  type SuggestionsResponse,
  type ComposerSuggestionsInput,
  type EmailSuggestionsInput,
} from './suggestions';

// Vocabulary (Action vocabulary autocomplete)
export {
  useVocabularySuggestions,
  type VocabularySuggestion,
} from './vocabulary';

// ============================================================================
// UTILITIES
// ============================================================================

// Query Keys - Centralized TanStack Query key definitions
export { queryKeys, invalidationHelpers } from '../queryKeys';
export type { QueryKey } from '../queryKeys';

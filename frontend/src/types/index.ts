/**
 * Frontend Types
 *
 * All core types are now derived from @autoart/shared Zod schemas.
 * This ensures frontend and backend use identical type definitions.
 */

// Re-export domain types from shared/domain subpath
export type {
  ReferenceStatus,
  FieldViewModel,
  EntityContext,
  ProjectState,
  FieldDefinition,
} from '@autoart/shared/domain';

// Re-export everything from shared package
export {
  // Enums
  type NodeType,
  type RefMode,
  type FieldType,

  // Hierarchy
  type HierarchyNode,
  type CreateNodeInput,
  type UpdateNodeInput,
  type MoveNodeInput,
  type CloneNodeInput,

  // Records & Definitions
  type FieldDef,
  type SchemaConfig,
  type Styling,
  type RecordDefinition,
  type DataRecord,
  type CreateDefinitionInput,
  type UpdateDefinitionInput,
  type CreateRecordInput,
  type UpdateRecordInput,
  type BulkClassifyInput,
  type BulkDeleteInput,
  type SaveToLibraryInput,
  type ToggleCloneExcludedInput,
  type RecordStat,

  // References
  type TaskReference,
  type ResolvedReference,
  type CreateReferenceInput,
  type UpdateReferenceModeInput,
  type UpdateReferenceSnapshotInput,
  type BulkResolveInput,

  // Auth
  type User,
  type LoginInput,
  type RegisterInput,
  type AuthResponse,
  type RefreshResponse,

  // Search
  type SearchResult,
  type SearchQueryInput,

  // Links
  type RecordLink,
  type CreateLinkInput,

  // Helper function
  getFieldAllowReferences,
  getStatusConfig,
  getStatusDisplay,

  // Status config types
  type StatusConfig,
  type StatusOptionConfig,
} from '@autoart/shared';

// Re-export schemas for runtime validation in hooks
export {
  // Hierarchy response schemas
  HierarchyNodeSchema,
  NodeResponseSchema,
  NodesResponseSchema,
  ProjectsResponseSchema,

  // Records response schemas
  RecordDefinitionSchema,
  DataRecordSchema,
  DefinitionResponseSchema,
  DefinitionsResponseSchema,
  RecordResponseSchema,
  RecordsResponseSchema,
  RecordStatsResponseSchema,
  BulkOperationResponseSchema,

  // References response schemas
  TaskReferenceSchema,
  ResolvedReferenceSchema,
  ReferenceResponseSchema,
  ReferencesResponseSchema,
  ResolvedReferenceResponseSchema,
  DriftCheckResponseSchema,

  // Auth response schemas
  UserSchema,
  AuthResponseSchema,

  // Search response schemas
  SearchResultSchema,
  SearchResponseSchema,

  // Links response schemas
  RecordLinkSchema,
  LinksResponseSchema,
} from '@autoart/shared';

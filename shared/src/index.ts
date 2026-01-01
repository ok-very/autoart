/**
 * @autoart/shared
 *
 * Shared Zod schemas and types for AutoArt Process Management System.
 * This package serves as the single source of truth for data contracts
 * between the frontend and backend.
 *
 * Usage:
 * - Backend: Import schemas for request/response validation
 * - Frontend: Import schemas for runtime parsing + inferred types
 */

// Re-export Zod for convenience
export { z } from 'zod';

// Enums
export {
  NodeTypeSchema,
  RefModeSchema,
  FieldTypeSchema,
  type NodeType,
  type RefMode,
  type FieldType,
} from './schemas/enums';

// Hierarchy
export {
  HierarchyNodeSchema,
  CreateNodeInputSchema,
  UpdateNodeInputSchema,
  MoveNodeInputSchema,
  CloneNodeInputSchema,
  NodeResponseSchema,
  NodesResponseSchema,
  ProjectsResponseSchema,
  type HierarchyNode,
  type CreateNodeInput,
  type UpdateNodeInput,
  type MoveNodeInput,
  type CloneNodeInput,
} from './schemas/hierarchy';

// Records & Definitions
export {
  FieldDefSchema,
  SchemaConfigSchema,
  StylingSchema,
  RecordDefinitionSchema,
  DataRecordSchema,
  CreateDefinitionInputSchema,
  UpdateDefinitionInputSchema,
  CreateRecordInputSchema,
  UpdateRecordInputSchema,
  BulkClassifyInputSchema,
  BulkDeleteInputSchema,
  SaveToLibraryInputSchema,
  ToggleCloneExcludedInputSchema,
  RecordStatSchema,
  DefinitionResponseSchema,
  DefinitionsResponseSchema,
  RecordResponseSchema,
  RecordsResponseSchema,
  RecordStatsResponseSchema,
  BulkOperationResponseSchema,
  getFieldAllowReferences,
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
} from './schemas/records';

// References
export {
  TaskReferenceSchema,
  ResolvedReferenceSchema,
  CreateReferenceInputSchema,
  UpdateReferenceModeInputSchema,
  UpdateReferenceSnapshotInputSchema,
  BulkResolveInputSchema,
  ReferenceResponseSchema,
  ReferencesResponseSchema,
  ResolvedReferenceResponseSchema,
  DriftCheckResponseSchema,
  type TaskReference,
  type ResolvedReference,
  type CreateReferenceInput,
  type UpdateReferenceModeInput,
  type UpdateReferenceSnapshotInput,
  type BulkResolveInput,
} from './schemas/references';

// Auth
export {
  UserSchema,
  LoginInputSchema,
  RegisterInputSchema,
  AuthResponseSchema,
  RefreshResponseSchema,
  type User,
  type LoginInput,
  type RegisterInput,
  type AuthResponse,
  type RefreshResponse,
} from './schemas/auth';

// Search
export {
  SearchResultSchema,
  SearchQueryInputSchema,
  SearchResponseSchema,
  type SearchResult,
  type SearchQueryInput,
} from './schemas/search';

// Links
export {
  RecordLinkSchema,
  CreateLinkInputSchema,
  LinkResponseSchema,
  LinksResponseSchema,
  type RecordLink,
  type CreateLinkInput,
} from './schemas/links';

// Tasks
export {
  TaskStatusSchema,
  TaskMetadataSchema,
  TaskFieldDefSchema,
  TASK_STATUS_CONFIG,
  DEFAULT_TASK_FIELDS,
  parseTaskMetadata,
  deriveTaskStatus,
  coercePercentComplete,
  isActiveStatus,
  type TaskStatus,
  type TaskMetadata,
  type TaskFieldDef,
} from './schemas/tasks';

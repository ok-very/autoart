/**
 * @autoart/shared - Types Module
 *
 * Pure TypeScript type definitions (no Zod schemas).
 * These are interface/type definitions only.
 */

// ==================== ERRORS ====================
export type { ApiErrorResponse, ApiErrorDetails, ErrorCode } from './errors.js';
export { ErrorCodes } from './errors.js';

// ==================== PROJECTIONS ====================
export type {
    ProjectionPreset,
    ActionProjectionInput,
    ContainerInput,
    StageProjectionOutput,
    HierarchyProjectionOutput,
    ProcessProjectionOutput,
    TimelineProjectionOutput,
    ProjectionRef,
    ProjectionSelection,
} from '../projections.js';

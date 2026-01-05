/**
 * Projection Presets Index
 *
 * Central registry of available projection presets.
 */

export { StageProjection } from './stage-projection.js';
export { HierarchyProjection } from './hierarchy-projection.js';

// Re-export types for convenience
export type {
    ProjectionPreset,
    ActionProjectionInput,
    ContainerInput,
    StageProjectionOutput,
    HierarchyProjectionOutput,
    ProjectionRef,
} from '@autoart/shared';

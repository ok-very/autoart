/**
 * Projection Presets Index
 *
 * Central registry of available projection presets.
 */

export { StageProjection } from './stage-projection.js';
export { HierarchyProjection } from './hierarchy-projection.js';
export { ProcessProjection } from './process-projection.js';
export { TimelineProjection } from './timeline-projection.js';

// Re-export types for convenience
export type {
    ProjectionPreset,
    ActionProjectionInput,
    ContainerInput,
    StageProjectionOutput,
    HierarchyProjectionOutput,
    TimelineProjectionOutput,
    ProjectionRef,
} from '@autoart/shared';

/**
 * Composer Components
 *
 * Exports the unified composer UI components.
 *
 * Primary components:
 * - UnifiedComposerBar: The new bottom bar composer (Phase 1 Narrative Canvas)
 * - ComposerSurface: Legacy full-page/drawer composer (deprecated)
 * - InlineComposer: Simplified inline variant of ComposerSurface
 */

// Primary exports - new unified composer bar
export { UnifiedComposerBar } from './UnifiedComposerBar';
export type { UnifiedComposerBarProps } from './UnifiedComposerBar';

// Context derivation
export { ContextIndicator, useDerivedContext } from './ContextIndicator';
export type { ContextIndicatorProps, DerivedContext } from './ContextIndicator';

// Event preview
export { EventPreview, buildPendingEvents } from './EventPreview';
export type { EventPreviewProps, PendingEvent } from './EventPreview';

// Legacy exports (deprecated - prefer UnifiedComposerBar for new usage)
export { ComposerSurface, InlineComposer } from './ComposerSurface';
export type { ComposerSurfaceProps, InlineComposerProps } from './ComposerSurface';

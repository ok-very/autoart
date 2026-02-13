/**
 * Composer Components
 *
 * Two surfaces for action composition:
 * - ComposerPopout: Floating overlay for quick action declaration (Ctrl+Shift+N)
 * - ComposerView: Expanded composer panel for deep composition (reference slots, context selection)
 *
 * Shared infrastructure:
 * - useComposerForm: Shared form state hook (used by ComposerPopoutContent)
 * - ContextIndicator: Context breadcrumb display
 * - EventPreview: Pending event preview
 */

// Composer popout (quick declare)
export { ComposerPopout } from './ComposerPopout';
export { ComposerPopoutContent } from './ComposerPopoutContent';
export type { ComposerPopoutContentProps } from './ComposerPopoutContent';

// Composer form hook (shared state management)
export { useComposerForm } from './useComposerForm';
export type { UseComposerFormOptions, ComposerFormState } from './useComposerForm';

// Context derivation
export { ContextIndicator, useDerivedContext } from './ContextIndicator';
export type { ContextIndicatorProps, DerivedContext } from './ContextIndicator';

// Event preview
export { EventPreview, buildPendingEvents } from './EventPreview';
export type { EventPreviewProps, PendingEvent } from './EventPreview';

// Expanded composer panel (deep compose — reference slots, context selection, detailed fields)
export { ComposerView } from './ComposerView';
export type { ComposerViewProps } from './ComposerView';

/**
 * Inspector Components
 *
 * Components for the right-side inspector panel showing detailed
 * information about selected entities.
 *
 * Phase 3 of the Narrative Canvas redesign - cross-entity mappings.
 */

// Action inspection
export { ActionDetailsPanel } from './ActionDetailsPanel';
export { ActionEventsPanel } from './ActionEventsPanel';

// Narrative thread (event timeline)
export { NarrativeThreadPanel } from './NarrativeThreadPanel';
export type { NarrativeThreadPanelProps } from './NarrativeThreadPanel';

// Cross-entity mappings
export { MappingsPanel } from './MappingsPanel';
export type { MappingsPanelProps } from './MappingsPanel';

// Footer composer
export { InspectorFooterComposer } from './InspectorFooterComposer';

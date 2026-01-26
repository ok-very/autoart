/**
 * Narrative Components
 *
 * Phase 2 of the Narrative Canvas redesign - event-aware center content.
 *
 * Components:
 * - NarrativeStream: Main center content with status grouping
 * - NarrativeCard: Single action entry with event timeline
 * - FactFamilyGroup: Groups facts by the 7 canonical families
 * - ChronoTimeline: Wrapper around react-chrono for timeline display
 */

// Main stream component
export { NarrativeStream } from './NarrativeStream';
export type { NarrativeStreamProps } from './NarrativeStream';

// Card component
export { NarrativeCard } from './NarrativeCard';
export type {
    NarrativeCardProps,
    NarrativeEvent,
    LinkedEntity,
} from './NarrativeCard';

// Fact family grouping
export {
    FactFamilyGroup,
    getFactFamily,
    groupFactsByFamily,
} from './FactFamilyGroup';
export type {
    FactFamilyGroupProps,
    FactFamily,
    FactEntry,
} from './FactFamilyGroup';

// Timeline wrapper
export { ChronoTimeline } from './ChronoTimeline';
export type {
    ChronoTimelineProps,
    ChronoTimelineItem,
    TimelineMode,
} from './ChronoTimeline';

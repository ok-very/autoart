/**
 * Cross-Entity Mappings Hooks
 *
 * Provides queries for cross-entity relationships:
 * - Email ↔ Record links
 * - Action ↔ Record references
 * - Action ↔ Email links
 *
 * These enable the unified inspector to show all related entities.
 */

import { useQuery } from '@tanstack/react-query';

import type { Event } from '@autoart/shared';

import { api } from '../client';
import type { ActionReference } from './actionReferences';
import type { RecordLink } from './links';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Entity mapping summary for an action
 */
export interface ActionMappings {
    /** Records referenced by this action */
    references: ActionReference[];
    /** Events associated with this action */
    events: Event[];
    /** Email IDs linked to this action (via events) */
    linkedEmailIds: string[];
}

/**
 * Entity mapping summary for a record
 */
export interface RecordMappings {
    /** Actions that reference this record */
    referencingActions: Array<{
        actionId: string;
        actionTitle: string;
        mode: 'static' | 'dynamic';
        targetFieldKey: string | null;
    }>;
    /** Direct record links */
    links: {
        outgoing: RecordLink[];
        incoming: RecordLink[];
    };
}

/**
 * Mapping status indicator
 */
export type MappingStatus = 'synced' | 'drift' | 'broken';

/**
 * Unified mapping entry for display
 */
export interface MappingEntry {
    id: string;
    type: 'email' | 'record' | 'action' | 'document';
    title: string;
    status: MappingStatus;
    mode?: 'static' | 'dynamic';
    lastSynced?: string;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Fetch all mappings for an action
 * Combines references and events to show complete picture
 */
export function useActionMappings(actionId: string | null) {
    return useQuery({
        queryKey: ['mappings', 'action', actionId],
        queryFn: async (): Promise<ActionMappings> => {
            if (!actionId) {
                return { references: [], events: [], linkedEmailIds: [] };
            }

            // Fetch references and events in parallel with individual error handling
            const [refsResult, eventsResult] = await Promise.allSettled([
                api.get<{ references: ActionReference[] }>(`/actions/${actionId}/references`),
                api.get<{ events: Event[] }>(`/actions/${actionId}/events`),
            ]);

            // Extract successful responses or use empty fallbacks
            const references = refsResult.status === 'fulfilled'
                ? refsResult.value.references
                : [];
            const events = eventsResult.status === 'fulfilled'
                ? eventsResult.value.events
                : [];

            // Extract email IDs from email-related events with safe payload access
            const linkedEmailIds = events
                .filter((e) => e.type === 'EMAIL_RECEIVED' || e.type === 'EMAIL_SENT')
                .map((e) => {
                    const payload = e.payload as Record<string, unknown> | null;
                    return payload && typeof payload.emailId === 'string' ? payload.emailId : null;
                })
                .filter((id): id is string => !!id);

            return {
                references,
                events,
                linkedEmailIds: [...new Set(linkedEmailIds)],
            };
        },
        enabled: !!actionId,
        staleTime: 30000,
    });
}

/**
 * Fetch all mappings for a record
 * Shows which actions reference this record
 */
export function useRecordMappings(recordId: string | null) {
    return useQuery({
        queryKey: ['mappings', 'record', recordId],
        queryFn: async (): Promise<RecordMappings> => {
            if (!recordId) {
                return { referencingActions: [], links: { outgoing: [], incoming: [] } };
            }

            // Fetch referencing actions and links in parallel
            const [actionsResponse, linksResponse] = await Promise.all([
                api.get<{
                    actions: Array<{
                        actionId: string;
                        actionTitle: string;
                        mode: 'static' | 'dynamic';
                        targetFieldKey: string | null;
                    }>;
                }>(`/records/${recordId}/referencing-actions`).catch(() => ({ actions: [] })),
                api.get<{ outgoing: RecordLink[]; incoming: RecordLink[] }>(
                    `/links/record/${recordId}?direction=both`
                ).catch(() => ({ outgoing: [], incoming: [] })),
            ]);

            return {
                referencingActions: actionsResponse.actions,
                links: linksResponse,
            };
        },
        enabled: !!recordId,
        staleTime: 30000,
    });
}

/**
 * Detect mapping status based on reference mode and sync state
 */
export function getMappingStatus(
    mode: 'static' | 'dynamic',
    lastSynced?: Date | null,
    sourceMissing?: boolean
): MappingStatus {
    if (sourceMissing) return 'broken';
    if (mode === 'static') return 'synced';

    // Dynamic refs: check freshness
    if (!lastSynced) return 'drift';

    const hoursSinceSync = (Date.now() - lastSynced.getTime()) / (1000 * 60 * 60);
    return hoursSinceSync > 24 ? 'drift' : 'synced';
}

/**
 * Convert mappings to unified display entries
 */
export function toMappingEntries(mappings: ActionMappings): MappingEntry[] {
    const entries: MappingEntry[] = [];

    // Add referenced records
    for (const ref of mappings.references) {
        if (ref.source_record_id) {
            entries.push({
                id: ref.id,
                type: 'record',
                title: ref.target_field_key || 'Record',
                status: getMappingStatus(ref.mode),
                mode: ref.mode,
            });
        }
    }

    // Add linked emails
    for (const emailId of mappings.linkedEmailIds) {
        entries.push({
            id: emailId,
            type: 'email',
            title: `Email ${emailId.slice(0, 8)}...`,
            status: 'synced',
        });
    }

    return entries;
}

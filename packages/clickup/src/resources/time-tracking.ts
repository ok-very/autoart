/**
 * ClickUp Time Tracking resource
 */

import type { ClickUpClient } from '../client.js';
import type {
    ClickUpTimeEntry,
    CreateTimeEntryData,
    UpdateTimeEntryData,
    GetTimeEntriesParams,
} from '../types.js';

export class TimeTrackingResource {
    constructor(private client: ClickUpClient) {}

    /** Get time entries within a date range */
    async list(teamId: string, params?: GetTimeEntriesParams): Promise<{ data: ClickUpTimeEntry[] }> {
        return this.client.get<{ data: ClickUpTimeEntry[] }>(`/team/${teamId}/time_entries`, params as Record<string, string | number | boolean | undefined>);
    }

    /** Get a single time entry */
    async get(teamId: string, timerId: string): Promise<{ data: ClickUpTimeEntry }> {
        return this.client.get<{ data: ClickUpTimeEntry }>(`/team/${teamId}/time_entries/${timerId}`);
    }

    /** Create a time entry */
    async create(teamId: string, data: CreateTimeEntryData): Promise<{ data: ClickUpTimeEntry }> {
        return this.client.post<{ data: ClickUpTimeEntry }>(`/team/${teamId}/time_entries`, data);
    }

    /** Update a time entry */
    async update(teamId: string, timerId: string, data: UpdateTimeEntryData): Promise<{ data: ClickUpTimeEntry }> {
        return this.client.put<{ data: ClickUpTimeEntry }>(`/team/${teamId}/time_entries/${timerId}`, data);
    }

    /** Delete a time entry */
    async delete(teamId: string, timerId: string): Promise<void> {
        await this.client.delete(`/team/${teamId}/time_entries/${timerId}`);
    }

    /** Get the currently running time entry */
    async getRunning(teamId: string): Promise<{ data: ClickUpTimeEntry | null }> {
        return this.client.get<{ data: ClickUpTimeEntry | null }>(`/team/${teamId}/time_entries/current`);
    }

    /** Start a time entry */
    async start(teamId: string, timerId: string): Promise<{ data: ClickUpTimeEntry }> {
        return this.client.post<{ data: ClickUpTimeEntry }>(`/team/${teamId}/time_entries/start/${timerId}`);
    }

    /** Stop the current time entry */
    async stop(teamId: string): Promise<{ data: ClickUpTimeEntry }> {
        return this.client.post<{ data: ClickUpTimeEntry }>(`/team/${teamId}/time_entries/stop`);
    }
}

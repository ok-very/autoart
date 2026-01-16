/**
 * Migration: System Definitions (Task, Subtask)
 *
 * CONSOLIDATED from migrations 016, 017, 019, 020
 *
 * This migration:
 * - Adds is_system and parent_definition_id columns
 * - Creates Task and Subtask system definitions with complete schema
 * - Includes statusConfig for status field display
 */

import { Kysely, sql } from 'kysely';

// Status configuration for workflow states
const WORKFLOW_STATUS_CONFIG = {
    'empty': { label: '', colorClass: 'bg-slate-100 text-slate-400' },
    'not-started': { label: 'Not Started', colorClass: 'bg-slate-200 text-slate-600' },
    'in-progress': { label: 'In Progress', colorClass: 'bg-amber-100 text-amber-700' },
    'blocked': { label: 'Blocked', colorClass: 'bg-red-100 text-red-700' },
    'review': { label: 'Review', colorClass: 'bg-purple-100 text-purple-700' },
    'done': { label: 'Done', colorClass: 'bg-emerald-100 text-emerald-700' },
};

const WORKFLOW_STATUS_OPTIONS = Object.keys(WORKFLOW_STATUS_CONFIG);

// Complete Task schema with statusConfig
const TASK_SCHEMA = {
    fields: [
        { key: 'title', type: 'text', label: 'Task', required: true },
        {
            key: 'status',
            type: 'status',
            label: 'Status',
            options: WORKFLOW_STATUS_OPTIONS,
            statusConfig: WORKFLOW_STATUS_CONFIG,
        },
        { key: 'owner', type: 'user', label: 'Assignee' },
        { key: 'dueDate', type: 'date', label: 'Due' },
        { key: 'tags', type: 'tags', label: 'Tags' },
        { key: 'description', type: 'textarea', label: 'Description' },
    ],
};

// Complete Subtask schema with statusConfig
const SUBTASK_SCHEMA = {
    fields: [
        { key: 'title', type: 'text', label: 'Subtask', required: true },
        {
            key: 'status',
            type: 'status',
            label: 'Status',
            options: WORKFLOW_STATUS_OPTIONS,
            statusConfig: WORKFLOW_STATUS_CONFIG,
        },
        { key: 'owner', type: 'user', label: 'Assignee' },
        { key: 'dueDate', type: 'date', label: 'Due' },
    ],
};

export async function up(db: Kysely<unknown>): Promise<void> {
    // Add is_system column
    await db.schema
        .alterTable('record_definitions')
        .addColumn('is_system', 'boolean', (col) => col.notNull().defaultTo(false))
        .execute();

    // Add parent_definition_id for hierarchical record types (e.g., Subtask under Task)
    await db.schema
        .alterTable('record_definitions')
        .addColumn('parent_definition_id', 'uuid', (col) =>
            col.references('record_definitions.id').onDelete('set null')
        )
        .execute();

    // Task and Subtask definitions are now deprecated (replaced by Actions)
    // We no longer seed them here.
}

export async function down(db: Kysely<unknown>): Promise<void> {
    // Remove the columns (data is preserved if migrating back up)
    await db.schema
        .alterTable('record_definitions')
        .dropColumn('parent_definition_id')
        .execute();

    await db.schema
        .alterTable('record_definitions')
        .dropColumn('is_system')
        .execute();
}

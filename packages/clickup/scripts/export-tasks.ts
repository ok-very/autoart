#!/usr/bin/env npx tsx
/**
 * Export all tasks from a list as JSON or CSV.
 *
 * Usage: CLICKUP_TOKEN=pk_... npx tsx scripts/export-tasks.ts --list-id ID [--format json|csv]
 */

import { ClickUp } from '../src/index.js';
import type { ClickUpTask } from '../src/types.js';

const token = process.env.CLICKUP_TOKEN;
if (!token) {
    console.error('Error: CLICKUP_TOKEN environment variable required');
    process.exit(1);
}

const listId = process.argv.find((_, i, a) => a[i - 1] === '--list-id');
const format = process.argv.find((_, i, a) => a[i - 1] === '--format') ?? 'json';

if (!listId) {
    console.error('Error: --list-id required');
    process.exit(1);
}

const cu = new ClickUp({ token });

async function fetchAllTasks(): Promise<ClickUpTask[]> {
    const all: ClickUpTask[] = [];
    let page = 0;
    while (true) {
        const { tasks } = await cu.tasks.list(listId!, {
            page,
            include_closed: true,
            subtasks: true,
        });
        if (!tasks.length) break;
        all.push(...tasks);
        page++;
    }
    return all;
}

const tasks = await fetchAllTasks();

if (format === 'csv') {
    console.log('id,name,status,priority,assignees,due_date,parent,url');
    for (const t of tasks) {
        const row = [
            t.id,
            `"${t.name.replace(/"/g, '""')}"`,
            t.status?.status ?? '',
            t.priority?.priority ?? '',
            t.assignees.map(a => a.username).join(';'),
            t.due_date ?? '',
            t.parent ?? '',
            t.url,
        ];
        console.log(row.join(','));
    }
} else {
    console.log(JSON.stringify(tasks, null, 2));
}

console.error(`\nExported ${tasks.length} tasks`);

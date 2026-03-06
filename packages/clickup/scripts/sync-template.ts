#!/usr/bin/env npx tsx
/**
 * BFA template sync — TypeScript implementation.
 * Diffs bfa_templates.json against a live ClickUp list.
 *
 * Usage: CLICKUP_TOKEN=pk_... npx tsx scripts/sync-template.ts [--force] [--list-id ID]
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ClickUp } from '../src/index.js';
import type { ClickUpTask } from '../src/types.js';

const token = process.env.CLICKUP_TOKEN;
if (!token) {
    console.error('Error: CLICKUP_TOKEN environment variable required');
    process.exit(1);
}

const force = process.argv.includes('--force');
const listIdArg = process.argv.find((_, i, a) => a[i - 1] === '--list-id');

// Load template
const templatePath = resolve(
    import.meta.dirname ?? '.',
    '../../..', 'apps/autohelper/autohelper/data/bfa_templates.json'
);

let template: {
    clickup: { list_id: string };
    phase_field_id: string;
    phase_options: Record<string, string>;
    tasks: Array<{ temp_id: string; name: string; stage: number; parent_temp_id: string | null; is_milestone: boolean; depends_on?: string[] }>;
};

try {
    template = JSON.parse(readFileSync(templatePath, 'utf-8'));
} catch {
    console.error(`Failed to load template from ${templatePath}`);
    process.exit(1);
}

const listId = listIdArg ?? template.clickup.list_id;
const cu = new ClickUp({ token });

const TEMPLATE_TAG = 'template_type:bfa_project';

// Fetch all tasks
async function fetchAll(): Promise<ClickUpTask[]> {
    const all: ClickUpTask[] = [];
    let page = 0;
    while (true) {
        const { tasks } = await cu.tasks.list(listId, { page, include_closed: true });
        if (!tasks.length) break;
        all.push(...tasks);
        page++;
    }
    return all;
}

const existing = await fetchAll();
const byName = new Map<string, ClickUpTask>();
for (const t of existing) {
    byName.set(t.name.trim().toLowerCase(), t);
}

const matchedIds = new Set<string>();
const creates: Array<{ temp_id: string; name: string; stage: number }> = [];
const updates: Array<{ temp_id: string; name: string; field: string; current: unknown; expected: string }> = [];

for (const tmpl of template.tasks) {
    const match = byName.get(tmpl.name.trim().toLowerCase());
    if (!match) {
        creates.push({ temp_id: tmpl.temp_id, name: tmpl.name, stage: tmpl.stage });
    } else {
        matchedIds.add(match.id);
        // Check phase field
        const expectedOption = template.phase_options[String(tmpl.stage)];
        if (expectedOption) {
            const current = match.custom_fields?.find(cf => cf.id === template.phase_field_id)?.value;
            if (current !== expectedOption) {
                updates.push({
                    temp_id: tmpl.temp_id,
                    name: tmpl.name,
                    field: 'phase',
                    current,
                    expected: expectedOption,
                });
            }
        }
    }
}

const orphans = existing.filter(t =>
    !matchedIds.has(t.id) && t.tags?.some(tag => tag.name === TEMPLATE_TAG)
);

// Report
console.log(`Template: ${template.tasks.length} tasks`);
console.log(`ClickUp:  ${existing.length} tasks\n`);

if (creates.length) {
    console.log(`CREATES (${creates.length}):`);
    for (const c of creates) console.log(`  + [Stage ${c.stage}] ${c.name}`);
    console.log();
}

if (updates.length) {
    console.log(`UPDATES (${updates.length}):`);
    for (const u of updates) console.log(`  ~ ${u.name} (${u.field}: ${u.current} → ${u.expected})`);
    console.log();
}

if (orphans.length) {
    console.log(`ORPHANS (${orphans.length}):`);
    for (const o of orphans) console.log(`  ? ${o.name} (${o.id})`);
    console.log();
}

if (!creates.length && !updates.length && !orphans.length) {
    console.log('Everything in sync!');
}

if (force && (creates.length || updates.length)) {
    console.log('Applying changes...\n');

    const idMap = new Map<string, string>();
    for (const tmpl of template.tasks) {
        const match = byName.get(tmpl.name.trim().toLowerCase());
        if (match) idMap.set(tmpl.temp_id, match.id);
    }

    // Create: roots first, then children
    const roots = creates.filter(c => {
        const tmpl = template.tasks.find(t => t.temp_id === c.temp_id);
        return !tmpl?.parent_temp_id;
    });
    const children = creates.filter(c => {
        const tmpl = template.tasks.find(t => t.temp_id === c.temp_id);
        return !!tmpl?.parent_temp_id;
    });

    for (const action of [...roots, ...children]) {
        try {
            const tmpl = template.tasks.find(t => t.temp_id === action.temp_id)!;
            const parentId = tmpl.parent_temp_id ? idMap.get(tmpl.parent_temp_id) : undefined;
            const phaseOption = template.phase_options[String(tmpl.stage)];

            const created = await cu.tasks.create(listId, {
                name: action.name,
                parent: parentId ?? undefined,
                tags: [TEMPLATE_TAG],
                custom_fields: phaseOption
                    ? [{ id: template.phase_field_id, value: phaseOption }]
                    : undefined,
            });
            idMap.set(action.temp_id, created.id);
            console.log(`  Created: ${action.name} → ${created.id}`);
        } catch (err) {
            console.error(`  Failed: ${action.name} — ${err}`);
        }
    }

    // Apply phase updates
    for (const action of updates) {
        try {
            const match = byName.get(action.name.trim().toLowerCase());
            if (match) {
                await cu.customFields.set(match.id, template.phase_field_id, action.expected);
                console.log(`  Updated: ${action.name} phase → ${action.expected}`);
            }
        } catch (err) {
            console.error(`  Failed update: ${action.name} — ${err}`);
        }
    }

    // Wire dependencies from template depends_on arrays
    let depCount = 0;
    let depErrors = 0;
    console.log('\nWiring dependencies...');
    for (const tmpl of template.tasks) {
        const deps = tmpl.depends_on ?? [];
        if (!deps.length) continue;
        const taskId = idMap.get(tmpl.temp_id);
        if (!taskId) continue;
        for (const depTempId of deps) {
            const depId = idMap.get(depTempId);
            if (!depId) continue;
            try {
                await cu.dependencies.add(taskId, { depends_on: depId });
                depCount++;
            } catch {
                depErrors++;
            }
        }
    }
    console.log(`  Wired ${depCount} dependencies${depErrors ? ` (${depErrors} errors)` : ''}`);

    console.log('\nDone!');
} else if (!force && (creates.length || updates.length)) {
    console.log('Dry-run only. Use --force to apply.');
}

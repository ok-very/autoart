/**
 * BFA Vancouver Project Template → ClickUp Migration
 *
 * Usage:
 *   CLICKUP_TOKEN=pk_... pnpm --filter bfa-migration migrate
 *   CLICKUP_TOKEN=pk_... pnpm --filter bfa-migration migrate:dry
 */

import { config } from 'dotenv';
import { ClickUp } from '@autoart/clickup';
import { parseSpreadsheet, type ParsedStage, type ParsedTask } from './parse-spreadsheet.js';
import { CLICKUP, PHASE_FIELD_ID, PHASE_OPTIONS, FAB_100_OPTION } from './config.js';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env from monorepo root
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

// ── Config ────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');
const SPREADSHEET_PATH = resolve(__dirname, '../../../../BFA-migration/Vancouver_Project_Template.xlsx');

const token = process.env.CLICKUP_TOKEN;
if (!token && !DRY_RUN) {
    console.error('Error: CLICKUP_TOKEN environment variable required');
    process.exit(1);
}

const clickup = token ? new ClickUp({ token }) : null;

// ── Helpers ───────────────────────────────────────────────────────────────

function getPhaseOptionId(task: ParsedTask): string {
    const stageNum = task.stageNumber;

    // Stage 9: tasks mentioning "100%" get the 100% Fabrication phase
    if (stageNum === 9 && task.name.includes('100%')) {
        return FAB_100_OPTION;
    }

    return PHASE_OPTIONS[stageNum] ?? PHASE_OPTIONS[1];
}

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

interface TaskManifestEntry {
    clickupId: string;
    name: string;
    stage: number;
    stageName: string;
    emailTemplate: string;
    isMilestone: boolean;
    isSubtask: boolean;
    parentClickupId: string | null;
}

// ── Clean existing tasks ──────────────────────────────────────────────────

async function cleanExistingTasks(): Promise<void> {
    if (!clickup) return;

    console.log('Fetching existing tasks in template list...');
    let page = 0;
    let allTasks: string[] = [];

    // Paginate through all tasks (including subtasks)
    while (true) {
        const { tasks } = await clickup.tasks.list(CLICKUP.listId, {
            page,
            subtasks: true,
            include_closed: true,
        });
        if (!tasks || tasks.length === 0) break;
        allTasks.push(...tasks.map(t => t.id));
        page++;
    }

    if (allTasks.length === 0) {
        console.log('  No existing tasks to clean.');
        return;
    }

    console.log(`  Deleting ${allTasks.length} existing tasks...`);
    for (const taskId of allTasks) {
        await clickup.tasks.delete(taskId);
        await sleep(200); // Rate limit courtesy
    }
    console.log('  Done.');
}

// ── Create tasks ──────────────────────────────────────────────────────────

async function createTasks(stages: ParsedStage[]): Promise<TaskManifestEntry[]> {
    const manifest: TaskManifestEntry[] = [];

    for (const stage of stages) {
        console.log(`\nStage ${stage.number}: ${stage.name} (${stage.tasks.length} tasks)`);

        // Map stage-local index → ClickUp task ID (for parent references)
        const indexToId: Map<number, string> = new Map();

        for (const task of stage.tasks) {
            const customFields: Array<{ id: string; value: unknown }> = [];

            // Set BFA Project Phases
            customFields.push({
                id: PHASE_FIELD_ID,
                value: getPhaseOptionId(task),
            });

            const createData = {
                name: task.name,
                description: task.notes || undefined,
                parent: undefined as string | undefined,
                custom_fields: customFields,
            };

            // Link subtask to parent
            if (task.isSubtask && task.parentIndex !== null) {
                const parentId = indexToId.get(task.parentIndex);
                if (parentId) {
                    createData.parent = parentId;
                }
            }

            if (DRY_RUN) {
                const prefix = task.isMilestone ? '★ ' : task.isSubtask ? '  → ' : '  ';
                const tmpl = task.emailTemplate ? ` [${task.emailTemplate}]` : '';
                console.log(`${prefix}${task.name}${tmpl}`);
                indexToId.set(task.orderInStage, `dry-${stage.number}-${task.orderInStage}`);
                manifest.push({
                    clickupId: `dry-${stage.number}-${task.orderInStage}`,
                    name: task.name,
                    stage: stage.number,
                    stageName: stage.name,
                    emailTemplate: task.emailTemplate,
                    isMilestone: task.isMilestone,
                    isSubtask: task.isSubtask,
                    parentClickupId: task.isSubtask && task.parentIndex !== null
                        ? indexToId.get(task.parentIndex) ?? null
                        : null,
                });
                continue;
            }

            if (!clickup) throw new Error('No ClickUp client');

            const created = await clickup.tasks.create(CLICKUP.listId, createData);
            indexToId.set(task.orderInStage, created.id);

            const prefix = task.isMilestone ? '★ ' : task.isSubtask ? '  → ' : '  ';
            console.log(`${prefix}${task.name} → ${created.id}`);

            manifest.push({
                clickupId: created.id,
                name: task.name,
                stage: stage.number,
                stageName: stage.name,
                emailTemplate: task.emailTemplate,
                isMilestone: task.isMilestone,
                isSubtask: task.isSubtask,
                parentClickupId: task.isSubtask && task.parentIndex !== null
                    ? indexToId.get(task.parentIndex) ?? null
                    : null,
            });

            // Rate limit: ~200ms between creates
            await sleep(200);
        }
    }

    return manifest;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
    console.log(`BFA Migration ${DRY_RUN ? '(DRY RUN)' : ''}`);
    console.log(`Spreadsheet: ${SPREADSHEET_PATH}`);
    console.log(`Target list: ${CLICKUP.listId}\n`);

    // 1. Parse spreadsheet
    console.log('Parsing spreadsheet...');
    const stages = await parseSpreadsheet(SPREADSHEET_PATH);
    const totalTasks = stages.reduce((sum, s) => sum + s.tasks.length, 0);
    console.log(`  Found ${stages.length} stages, ${totalTasks} tasks\n`);

    // 2. Clean existing tasks
    if (!DRY_RUN) {
        await cleanExistingTasks();
    }

    // 3. Create all tasks
    const manifest = await createTasks(stages);

    // 4. Write manifest
    const manifestPath = resolve(__dirname, '../manifest.json');
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`\nManifest written to ${manifestPath}`);
    console.log(`Total tasks created: ${manifest.length}`);
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});

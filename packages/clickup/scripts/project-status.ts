#!/usr/bin/env npx tsx
/**
 * BFA Project Status — CLI
 *
 * Fetches tasks from a ClickUp list, runs the dependency-graph analyzer,
 * and prints stage progress, actionable tasks, and blocked tasks.
 *
 * Usage:
 *   CLICKUP_TOKEN=pk_... npx tsx scripts/project-status.ts --list-id 901414366813
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ClickUp, analyzeProject } from '../src/index.js';
import type { TaskSummary, StageProgress } from '../src/index.js';

// ── Args ────────────────────────────────────────────────────────────────

const token = process.env.CLICKUP_TOKEN;
if (!token) {
    console.error('Error: CLICKUP_TOKEN environment variable required');
    process.exit(1);
}

const listIdArg = process.argv.find((_, i, a) => a[i - 1] === '--list-id');

// ── Load template ───────────────────────────────────────────────────────

const templatePath = resolve(
    import.meta.dirname ?? '.',
    '../../..', 'apps/autohelper/autohelper/data/bfa_templates.json',
);

let template: {
    clickup: { list_id: string };
    stages: Array<{ number: number; name: string }>;
    tasks: Array<{
        temp_id: string;
        name: string;
        stage: number;
        email_template_key: string | null;
        is_milestone: boolean;
        parent_temp_id: string | null;
        depends_on: string[];
    }>;
};

try {
    template = JSON.parse(readFileSync(templatePath, 'utf-8'));
} catch {
    console.error(`Failed to load template from ${templatePath}`);
    process.exit(1);
}

const listId = listIdArg ?? template.clickup.list_id;

// ── Analyze ─────────────────────────────────────────────────────────────

const cu = new ClickUp({ token });

console.log(`Analyzing list ${listId}...\n`);

const state = await analyzeProject(cu, listId, template);

// ── Render ──────────────────────────────────────────────────────────────

function progressBar(pct: number, width = 20): string {
    const filled = Math.round((pct / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${pct}%`;
}

function taskLine(t: TaskSummary, prefix: string): string {
    const flags: string[] = [];
    if (t.isMilestone) flags.push('milestone');
    if (t.hasEmailTemplate) flags.push('email');
    if (t.blocks.length) flags.push(`unblocks ${t.blocks.length}`);
    const suffix = flags.length ? ` (${flags.join(', ')})` : '';
    return `  ${prefix} [Stage ${t.stage}] ${t.name} — ${t.status}${suffix}`;
}

// Header
console.log(`Current Stage: ${state.currentStage} — ${state.stageName}`);
console.log(`Overall: ${state.completedCount}/${state.totalCount} tasks complete\n`);

// Stage progress
console.log('Stage Progress:');
for (const s of template.stages) {
    const sp: StageProgress = state.stageProgress[s.number] ?? { total: 0, done: 0, pct: 0 };
    console.log(`  ${String(s.number).padStart(2)}. ${s.name}`);
    console.log(`      ${progressBar(sp.pct)} (${sp.done}/${sp.total})`);
}
console.log();

// Next milestone
if (state.nextMilestone) {
    console.log(`Next Milestone: [Stage ${state.nextMilestone.stage}] ${state.nextMilestone.name}`);
    if (state.nextMilestone.blockedBy.length) {
        console.log(`  Blocked by ${state.nextMilestone.blockedBy.length} task(s)`);
    }
    console.log();
}

// Actionable tasks
if (state.actionableTasks.length) {
    console.log(`Actionable Tasks (${state.actionableTasks.length}):`);
    for (const t of state.actionableTasks.slice(0, 15)) {
        console.log(taskLine(t, '▶'));
    }
    if (state.actionableTasks.length > 15) {
        console.log(`  ... and ${state.actionableTasks.length - 15} more`);
    }
    console.log();
}

// Blocked tasks
if (state.blockedTasks.length) {
    console.log(`Blocked Tasks (${state.blockedTasks.length}):`);
    for (const t of state.blockedTasks.slice(0, 10)) {
        console.log(taskLine(t, '⏳'));
        for (const bid of t.blockedBy.slice(0, 3)) {
            console.log(`      ↳ waiting on ${bid}`);
        }
        if (t.blockedBy.length > 3) {
            console.log(`      ↳ +${t.blockedBy.length - 3} more`);
        }
    }
    if (state.blockedTasks.length > 10) {
        console.log(`  ... and ${state.blockedTasks.length - 10} more`);
    }
}

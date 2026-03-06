/**
 * BFA Project State Analyzer
 *
 * Fetches all tasks from a ClickUp list, builds the dependency graph,
 * and classifies tasks as completed / blocked / actionable.
 */

import type { ClickUp } from './clickup.js';
import type { ClickUpTask } from './types.js';

// ── Public types ────────────────────────────────────────────────────────

export interface TaskSummary {
    id: string;
    name: string;
    stage: number;
    status: string;
    blockedBy: string[];
    blocks: string[];
    hasEmailTemplate: boolean;
    isMilestone: boolean;
}

export interface StageProgress {
    total: number;
    done: number;
    pct: number;
}

export interface ProjectState {
    currentStage: number;
    stageName: string;
    stageProgress: Record<number, StageProgress>;
    actionableTasks: TaskSummary[];
    blockedTasks: TaskSummary[];
    nextMilestone: TaskSummary | null;
    completedCount: number;
    totalCount: number;
}

// ── BFA template types ──────────────────────────────────────────────────

interface BfaTemplateTask {
    temp_id: string;
    name: string;
    stage: number;
    email_template_key: string | null;
    is_milestone: boolean;
    parent_temp_id: string | null;
    depends_on: string[];
}

interface BfaTemplate {
    stages: Array<{ number: number; name: string }>;
    tasks: BfaTemplateTask[];
}

// ── Helpers ─────────────────────────────────────────────────────────────

const DONE_TYPES = new Set(['closed', 'done', 'complete', 'completed']);

function isDone(task: ClickUpTask): boolean {
    return DONE_TYPES.has(task.status?.type?.toLowerCase() ?? '');
}

/**
 * Match a ClickUp task to a BFA template task by normalized name.
 */
function matchTemplate(
    task: ClickUpTask,
    byName: Map<string, BfaTemplateTask>,
): BfaTemplateTask | undefined {
    return byName.get(task.name.trim().toLowerCase());
}

/**
 * Fetch all tasks from a list (handles pagination).
 */
async function fetchAllTasks(cu: ClickUp, listId: string): Promise<ClickUpTask[]> {
    const all: ClickUpTask[] = [];
    let page = 0;
    while (true) {
        const { tasks } = await cu.tasks.list(listId, {
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

// ── Main analyzer ───────────────────────────────────────────────────────

/**
 * Analyze a BFA project list against the template dependency graph.
 *
 * @param cu - Authenticated ClickUp client
 * @param listId - ClickUp list ID to analyze
 * @param template - Parsed bfa_templates.json (pass in to avoid fs dependency)
 */
export async function analyzeProject(
    cu: ClickUp,
    listId: string,
    template: BfaTemplate,
): Promise<ProjectState> {
    const tasks = await fetchAllTasks(cu, listId);

    // Build template lookup by normalized name
    const tmplByName = new Map<string, BfaTemplateTask>();
    const tmplById = new Map<string, BfaTemplateTask>();
    for (const t of template.tasks) {
        tmplByName.set(t.name.trim().toLowerCase(), t);
        tmplById.set(t.temp_id, t);
    }

    // Map ClickUp tasks to template tasks, build id → temp_id mapping
    const clickupToTempId = new Map<string, string>(); // clickup id → temp_id
    const tempIdToClickup = new Map<string, ClickUpTask>(); // temp_id → ClickUp task
    const completedTempIds = new Set<string>();

    for (const task of tasks) {
        const tmpl = matchTemplate(task, tmplByName);
        if (!tmpl) continue;
        clickupToTempId.set(task.id, tmpl.temp_id);
        tempIdToClickup.set(tmpl.temp_id, task);
        if (isDone(task)) {
            completedTempIds.add(tmpl.temp_id);
        }
    }

    // Build reverse dependency map: temp_id → temp_ids it blocks
    const blocksMap = new Map<string, string[]>();
    for (const tmpl of template.tasks) {
        for (const depId of tmpl.depends_on) {
            const arr = blocksMap.get(depId) ?? [];
            arr.push(tmpl.temp_id);
            blocksMap.set(depId, arr);
        }
    }

    // Classify each template task
    const actionable: TaskSummary[] = [];
    const blocked: TaskSummary[] = [];
    let completedCount = 0;

    // Stage progress accumulators
    const stageProgress: Record<number, StageProgress> = {};
    for (const s of template.stages) {
        stageProgress[s.number] = { total: 0, done: 0, pct: 0 };
    }

    let nextMilestone: TaskSummary | null = null;

    for (const tmpl of template.tasks) {
        const cuTask = tempIdToClickup.get(tmpl.temp_id);
        const stage = tmpl.stage;

        // Count for stage progress
        if (stageProgress[stage]) {
            stageProgress[stage].total++;
        }

        const done = completedTempIds.has(tmpl.temp_id);
        if (done) {
            completedCount++;
            if (stageProgress[stage]) {
                stageProgress[stage].done++;
            }
            continue;
        }

        // Compute unresolved blockers
        const unresolvedBlockers = tmpl.depends_on.filter(
            depId => !completedTempIds.has(depId),
        );

        // Resolve blocker temp_ids to ClickUp task IDs for the summary
        const blockerClickupIds = unresolvedBlockers
            .map(tid => tempIdToClickup.get(tid)?.id)
            .filter((id): id is string => !!id);

        // What does this task unblock?
        const blocksClickupIds = (blocksMap.get(tmpl.temp_id) ?? [])
            .map(tid => tempIdToClickup.get(tid)?.id)
            .filter((id): id is string => !!id);

        const summary: TaskSummary = {
            id: cuTask?.id ?? tmpl.temp_id,
            name: tmpl.name,
            stage,
            status: cuTask?.status?.status ?? 'not created',
            blockedBy: blockerClickupIds,
            blocks: blocksClickupIds,
            hasEmailTemplate: !!tmpl.email_template_key,
            isMilestone: tmpl.is_milestone,
        };

        if (unresolvedBlockers.length > 0) {
            blocked.push(summary);
        } else {
            actionable.push(summary);
        }

        // Track next milestone (first incomplete milestone in stage order)
        if (tmpl.is_milestone && !nextMilestone) {
            nextMilestone = summary;
        }
    }

    // Compute percentages
    for (const sp of Object.values(stageProgress)) {
        sp.pct = sp.total > 0 ? Math.round((sp.done / sp.total) * 100) : 0;
    }

    // Current stage = first stage with incomplete tasks
    let currentStage = template.stages[template.stages.length - 1].number;
    for (const s of template.stages) {
        const sp = stageProgress[s.number];
        if (sp && sp.done < sp.total) {
            currentStage = s.number;
            break;
        }
    }

    const stageName =
        template.stages.find(s => s.number === currentStage)?.name ?? `Stage ${currentStage}`;

    // Rank actionable tasks: stage order → milestone proximity → has email
    actionable.sort((a, b) => {
        if (a.stage !== b.stage) return a.stage - b.stage;
        // Milestones or tasks that unblock others rank higher
        const aWeight = (a.isMilestone ? 10 : 0) + a.blocks.length;
        const bWeight = (b.isMilestone ? 10 : 0) + b.blocks.length;
        if (aWeight !== bWeight) return bWeight - aWeight;
        // Tasks with email templates (need outbound action) rank higher
        if (a.hasEmailTemplate !== b.hasEmailTemplate) return a.hasEmailTemplate ? -1 : 1;
        return 0;
    });

    return {
        currentStage,
        stageName,
        stageProgress,
        actionableTasks: actionable,
        blockedTasks: blocked,
        nextMilestone,
        completedCount,
        totalCount: template.tasks.length,
    };
}

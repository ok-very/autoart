/**
 * BFA Project Projector
 *
 * Transforms database state into BfaProjectExportModel for export.
 * Queries hierarchy nodes, records, and events to build the complete
 * export projection for each selected project.
 */

import { db } from '@db/client.js';

import type {
    BfaProjectExportModel,
    BfaMilestone,
    BfaNextStepBullet,
    ExportOptions,
} from '../types.js';

// ============================================================================
// MAIN PROJECTION FUNCTION
// ============================================================================

/**
 * Project multiple projects into BFA export models.
 */
export async function projectBfaExportModels(
    projectIds: string[],
    options: ExportOptions
): Promise<BfaProjectExportModel[]> {
    // Process projects in parallel for better performance
    const modelPromises = projectIds.map((projectId, index) =>
        projectSingleProject(projectId, index, options)
    );

    const results = await Promise.allSettled(modelPromises);

    const models: BfaProjectExportModel[] = [];
    for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
            models.push(result.value);
        } else if (result.status === 'rejected') {
            console.warn('Failed to project BFA model:', result.reason);
        }
    }

    return models;
}

/**
 * Project a single project into a BFA export model.
 */
async function projectSingleProject(
    projectId: string,
    orderingIndex: number,
    options: ExportOptions
): Promise<BfaProjectExportModel | null> {
    // 1. Get project node (using 'type' column, not 'node_type')
    const project = await db
        .selectFrom('hierarchy_nodes')
        .selectAll()
        .where('id', '=', projectId)
        .where('type', '=', 'project')
        .executeTakeFirst();

    if (!project) {
        console.warn(`Project not found: ${projectId}`);
        return null;
    }

    // 2. Get all related data in parallel
    const [contacts, budgetEvents, milestones, selectionPanels, tasks, stageEvents] =
        await Promise.all([
            options.includeContacts ? getProjectContacts(projectId) : Promise.resolve([]),
            options.includeBudgets ? getBudgetEvents(projectId) : Promise.resolve([]),
            options.includeMilestones ? getProjectMilestones(projectId) : Promise.resolve([]),
            options.includeSelectionPanel ? getSelectionPanels(projectId) : Promise.resolve([]),
            getProjectTasks(projectId, options.includeOnlyOpenNextSteps),
            getStageEvents(projectId),
        ]);

    // 3. Derive project status from events
    const currentStage = deriveCurrentStage(stageEvents);

    // 4. Build the export model
    // hierarchy_nodes uses 'metadata' field (JSONB), not 'fields_data'
    const projectMetadata = project.metadata as Record<string, unknown> | null;

    const model: BfaProjectExportModel = {
        projectId,
        orderingIndex,
        category: deriveCategory(projectMetadata),
        header: {
            staffInitials: extractStaffInitials(projectMetadata),
            clientName: extractClientName(contacts),
            projectName: project.title,
            location: extractLocation(projectMetadata),
            budgets: buildBudgets(budgetEvents, projectMetadata),
            install: extractInstallInfo(projectMetadata, milestones),
        },
        contactsBlock: {
            lines: formatContactLines(contacts),
        },
        timelineBlock: {
            milestones: formatMilestones(milestones),
        },
        selectionPanelBlock: buildSelectionPanelBlock(selectionPanels),
        statusBlock: {
            stage: currentStage,
            projectStatusText: extractProjectStatus(projectMetadata),
            bfaProjectStatusText: extractBfaProjectStatus(projectMetadata),
        },
        nextStepsBullets: formatNextSteps(tasks),
        rawBlockText: '', // Will be generated from formatted content
        hasChanges: false, // Determined by comparing with original import
    };

    // Generate raw block text for export
    model.rawBlockText = generateRawBlockText(model);

    return model;
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function getProjectContacts(projectId: string) {
    // Get Contact records associated with this project
    // records uses 'data' field (JSONB), not 'fields_data'
    const records = await db
        .selectFrom('records')
        .innerJoin('record_definitions', 'records.definition_id', 'record_definitions.id')
        .selectAll('records')
        .select('record_definitions.name as definition_name')
        .where('records.classification_node_id', '=', projectId)
        .where('record_definitions.name', '=', 'Contact')
        .execute();

    return records.map((r) => ({
        id: r.id,
        data: r.data as Record<string, unknown> | null,
    }));
}

async function getBudgetEvents(projectId: string) {
    // Get BUDGET_ALLOCATED events for this project with direct filtering
    const events = await db
        .selectFrom('events')
        .selectAll()
        .where('context_id', '=', projectId)
        .where('type', '=', 'FACT_RECORDED')
        .where(db.fn('json_extract', ['payload', '$.factKind']), '=', 'BUDGET_ALLOCATED')
        .execute();

    return events.map((e) => ({
        id: e.id,
        payload: e.payload as Record<string, unknown>,
        occurredAt: e.occurred_at,
    }));
}

async function getProjectMilestones(projectId: string) {
    // Get Milestone records for this project
    const records = await db
        .selectFrom('records')
        .innerJoin('record_definitions', 'records.definition_id', 'record_definitions.id')
        .selectAll('records')
        .where('records.classification_node_id', '=', projectId)
        .where('record_definitions.name', '=', 'Milestone')
        .execute();

    return records.map((r) => ({
        id: r.id,
        data: r.data as Record<string, unknown> | null,
    }));
}

async function getSelectionPanels(projectId: string) {
    // Get Selection Panel records for this project
    const records = await db
        .selectFrom('records')
        .innerJoin('record_definitions', 'records.definition_id', 'record_definitions.id')
        .selectAll('records')
        .where('records.classification_node_id', '=', projectId)
        .where('record_definitions.name', '=', 'Selection Panel')
        .execute();

    return records.map((r) => ({
        id: r.id,
        data: r.data as Record<string, unknown> | null,
    }));
}

async function getProjectTasks(projectId: string, openOnly: boolean) {
    // Get all task nodes under this project using recursive CTE
    // This finds tasks at any level in the hierarchy, not just direct children
    const tasksQuery = db
        .withRecursive('task_hierarchy', (qb) =>
            qb
                // Base case: start with the project itself
                .selectFrom('hierarchy_nodes')
                .select(['id', 'parent_id', 'type', 'title', 'metadata'])
                .where('id', '=', projectId)
                .unionAll(
                    // Recursive case: find children of nodes in the hierarchy
                    qb
                        .selectFrom('hierarchy_nodes')
                        .innerJoin('task_hierarchy', 'hierarchy_nodes.parent_id', 'task_hierarchy.id')
                        .select(['hierarchy_nodes.id', 'hierarchy_nodes.parent_id', 'hierarchy_nodes.type', 'hierarchy_nodes.title', 'hierarchy_nodes.metadata'])
                )
        )
        .selectFrom('task_hierarchy')
        .selectAll()
        .where('type', 'in', ['task', 'subprocess'])
        .where('id', '!=', projectId); // Exclude the project itself

    const allTasks = await tasksQuery.execute();

    // Filter for open tasks if requested
    const filteredTasks = openOnly ? allTasks.filter(task => {
        const status = (task.metadata as Record<string, unknown> | null)?.status as string | undefined;
        const isDone = status && ['done', 'complete', 'finished', 'cancelled'].some(s =>
            status.toLowerCase().includes(s)
        );
        return !isDone;
    }) : allTasks;

    return filteredTasks.map((t) => ({
        id: t.id,
        title: t.title,
        metadata: t.metadata as Record<string, unknown> | null,
    }));
}

async function getStageEvents(projectId: string) {
    // Get STAGE_ENTERED events for this project with direct filtering
    const events = await db
        .selectFrom('events')
        .selectAll()
        .where('context_id', '=', projectId)
        .where('type', '=', 'FACT_RECORDED')
        .where(db.fn('json_extract', ['payload', '$.factKind']), '=', 'STAGE_ENTERED')
        .orderBy('occurred_at', 'desc')
        .execute();

    return events.map((e) => ({
        id: e.id,
        payload: e.payload as Record<string, unknown>,
        occurredAt: e.occurred_at,
    }));
}

// ============================================================================
// DATA EXTRACTION HELPERS
// ============================================================================

function deriveCategory(
    metadata: Record<string, unknown> | null
): 'public' | 'corporate' | 'private_corporate' {
    const category = ((metadata?.category as string) || '').toLowerCase();

    if (category.includes('corporate')) {
        return category.includes('private') ? 'private_corporate' : 'corporate';
    }
    return 'public';
}

function extractStaffInitials(metadata: Record<string, unknown> | null): string[] {
    const staff = metadata?.staff_initials || metadata?.staffInitials || '';

    if (Array.isArray(staff)) return staff as string[];
    if (typeof staff === 'string') {
        return staff.split(/[,\/]/).map((s: string) => s.trim()).filter(Boolean);
    }
    return [];
}

function extractClientName(contacts: Array<{ data: Record<string, unknown> | null }>): string {
    // Try multiple contact group labels to find client
    const clientGroups = ['Developer/Client', 'Developer', 'Client', 'Assignee'];

    for (const groupName of clientGroups) {
        const client = contacts.find((c) =>
            c.data?.contactGroup === groupName
        );

        if (client?.data) {
            const name = (client.data.name as string) || (client.data.company as string);
            if (name) return name;
        }
    }

    // Fallback: return first contact with a name
    const firstContact = contacts.find(c =>
        c.data?.name || c.data?.company
    );

    if (firstContact?.data) {
        return (firstContact.data.name as string) || (firstContact.data.company as string) || '';
    }

    return '';
}

function extractLocation(metadata: Record<string, unknown> | null): string {
    return (metadata?.location as string) || (metadata?.address as string) || '';
}

function buildBudgets(
    budgetEvents: Array<{ payload: Record<string, unknown> }>,
    metadata: Record<string, unknown> | null
) {
    const budgets: BfaProjectExportModel['header']['budgets'] = {};

    // Check project metadata first
    if (metadata?.artwork_budget) {
        budgets.artwork = { numeric: Number(metadata.artwork_budget), text: formatCurrency(metadata.artwork_budget) };
    }
    if (metadata?.total_budget) {
        budgets.total = { numeric: Number(metadata.total_budget), text: formatCurrency(metadata.total_budget) };
    }

    // Override with budget events (most recent wins)
    for (const event of budgetEvents) {
        const { allocationType, amount, currency } = event.payload;
        const budgetValue = {
            numeric: amount as number,
            text: formatCurrency(amount as number, currency as string),
        };

        if (allocationType === 'artwork') {
            budgets.artwork = budgetValue;
        } else if (allocationType === 'total') {
            budgets.total = budgetValue;
        }
    }

    return budgets;
}

function extractInstallInfo(
    metadata: Record<string, unknown> | null,
    milestones: Array<{ data: Record<string, unknown> | null }>
) {
    const install: BfaProjectExportModel['header']['install'] = {};

    // Check project metadata
    if (metadata?.install_date) {
        install.dateText = formatDate(metadata.install_date as string);
    }

    // Check for Install milestone
    const installMilestone = milestones.find((m) =>
        m.data?.milestone_type === 'Install' || (m.data?.name as string)?.toLowerCase().includes('install')
    );

    if (installMilestone?.data) {
        const actualDate = installMilestone.data.actual_date as string | undefined;
        const targetDate = installMilestone.data.target_date as string | undefined;

        if (actualDate) {
            install.dateText = formatDate(actualDate);
            install.statusText = 'Complete';
        } else if (targetDate) {
            install.dateText = formatDate(targetDate);
            install.statusText = 'Scheduled';
        }
    }

    return install;
}

function formatContactLines(contacts: Array<{ data: Record<string, unknown> | null }>): string[] {
    const lines: string[] = [];

    // Group by contact group
    const byGroup: Record<string, Array<{ data: Record<string, unknown> | null }>> = {};
    for (const contact of contacts) {
        const group = (contact.data?.contactGroup as string) || 'Other';
        if (!byGroup[group]) byGroup[group] = [];
        byGroup[group].push(contact);
    }

    for (const [group, groupContacts] of Object.entries(byGroup)) {
        const names = groupContacts
            .map((c) => c.data?.name || c.data?.company)
            .filter(Boolean)
            .join(', ');
        if (names) {
            lines.push(`${group}: ${names}`);
        }
    }

    return lines;
}

function formatMilestones(milestones: Array<{ data: Record<string, unknown> | null }>): BfaMilestone[] {
    return milestones.map((m) => {
        const data = m.data || {};
        const kind = (data.milestone_type as string) || (data.name as string) || 'Unknown';
        const targetDate = data.target_date as string | undefined;
        const actualDate = data.actual_date as string | undefined;
        const status = data.status as string | undefined;

        let milestoneStatus: BfaMilestone['status'];
        if (actualDate || status === 'Completed') {
            milestoneStatus = 'completed';
        } else if (targetDate && new Date(targetDate) < new Date()) {
            milestoneStatus = 'overdue';
        } else {
            milestoneStatus = 'scheduled';
        }

        return {
            kind,
            dateText: formatDate(actualDate || targetDate),
            normalizedDate: actualDate || targetDate,
            status: milestoneStatus,
        };
    });
}

function buildSelectionPanelBlock(
    panels: Array<{ data: Record<string, unknown> | null }>
): BfaProjectExportModel['selectionPanelBlock'] {
    const block: BfaProjectExportModel['selectionPanelBlock'] = {
        members: [],
        shortlist: [],
        alternates: [],
    };

    // Find the most relevant panel (SP#2 > SP#1 > others)
    const sortedPanels = [...panels].sort((a, b) => {
        const typeA = (a.data?.meeting_type as string) || '';
        const typeB = (b.data?.meeting_type as string) || '';
        const order = ['SP#2', 'SP#1', 'AO', 'CA'];
        return order.indexOf(typeA) - order.indexOf(typeB);
    });

    for (const panel of sortedPanels) {
        const data = panel.data || {};

        // Extract members
        const members = data.members as string || '';
        if (members && block.members.length === 0) {
            block.members = members.split(/[\n,]/).map((m) => m.trim()).filter(Boolean);
        }

        // Extract shortlist
        const shortlist = data.shortlisted_artists as string || '';
        if (shortlist && block.shortlist.length === 0) {
            block.shortlist = shortlist.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
        }

        // Extract alternates
        const alternates = data.alternates as string || '';
        if (alternates && block.alternates.length === 0) {
            block.alternates = alternates.split(/[\n,]/).map((a) => a.trim()).filter(Boolean);
        }

        // Extract selected artist
        const selectedArtist = data.selected_artist as string || '';
        if (selectedArtist && !block.selectedArtist) {
            block.selectedArtist = selectedArtist;
        }

        // Extract artwork title
        const artworkTitle = data.artwork_title as string || '';
        if (artworkTitle && !block.artworkTitle) {
            block.artworkTitle = artworkTitle;
        }
    }

    return block;
}

function deriveCurrentStage(
    stageEvents: Array<{ payload: Record<string, unknown> }>
): 'planning' | 'selection' | 'design' | 'installation' | undefined {
    if (stageEvents.length === 0) return undefined;

    // Most recent stage event
    const latestStage = stageEvents[0].payload.stageName as string | undefined;
    if (!latestStage) return undefined;

    const stageLower = latestStage.toLowerCase();
    if (stageLower.includes('install')) return 'installation';
    if (stageLower.includes('design') || stageLower.includes('fabricat')) return 'design';
    if (stageLower.includes('select')) return 'selection';
    return 'planning';
}

function extractProjectStatus(metadata: Record<string, unknown> | null): string | undefined {
    return (metadata?.status as string) || (metadata?.project_status as string);
}

function extractBfaProjectStatus(metadata: Record<string, unknown> | null): string | undefined {
    return (metadata?.bfa_status as string) || (metadata?.bfa_project_status as string);
}

function formatNextSteps(
    tasks: Array<{ title: string; metadata: Record<string, unknown> | null }>
): BfaNextStepBullet[] {
    return tasks.map((t) => {
        const status = (t.metadata?.status as string) || '';
        const completed = ['done', 'complete', 'finished'].some((s) =>
            status.toLowerCase().includes(s)
        );

        return {
            text: t.title,
            completed,
            assigneeHint: t.metadata?.assignee as string | undefined,
            dueHint: t.metadata?.due_date as string | undefined,
        };
    });
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

function formatCurrency(amount: number | string | unknown, currency = 'CAD'): string {
    if (amount === undefined || amount === null) return '';
    const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    if (isNaN(num)) return '';

    return num.toLocaleString('en-CA', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
}

function formatDate(date: string | Date | undefined): string | undefined {
    if (!date) return undefined;
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return undefined;

    return d.toLocaleDateString('en-CA', {
        year: 'numeric',
        month: 'short',
    });
}

function generateRawBlockText(model: BfaProjectExportModel): string {
    const lines: string[] = [];

    // Header line: (JH/XX) Client: Project, Location (Budget: $X, Install: Date)
    const initials = model.header.staffInitials.join('/') || 'XX';
    const budgetParts: string[] = [];
    if (model.header.budgets.artwork?.text) {
        budgetParts.push(`Art: ${model.header.budgets.artwork.text}`);
    }
    if (model.header.budgets.total?.text) {
        budgetParts.push(`Total: ${model.header.budgets.total.text}`);
    }
    const budgetStr = budgetParts.length > 0 ? ` (${budgetParts.join(', ')})` : '';
    const installStr = model.header.install.dateText
        ? `, Install: ${model.header.install.dateText}`
        : '';

    lines.push(
        `(${initials}) ${model.header.clientName}: ${model.header.projectName}, ${model.header.location}${budgetStr}${installStr}`
    );

    // Contacts
    if (model.contactsBlock.lines.length > 0) {
        lines.push('');
        lines.push(...model.contactsBlock.lines);
    }

    // Milestones
    if (model.timelineBlock.milestones.length > 0) {
        lines.push('');
        for (const m of model.timelineBlock.milestones) {
            const statusIcon = m.status === 'completed' ? '[x]' : '[ ]';
            lines.push(`${statusIcon} ${m.kind}: ${m.dateText || 'TBD'}`);
        }
    }

    // Selection Panel
    if (model.selectionPanelBlock.selectedArtist) {
        lines.push('');
        lines.push(`Selected Artist: ${model.selectionPanelBlock.selectedArtist}`);
        if (model.selectionPanelBlock.artworkTitle) {
            lines.push(`Artwork: ${model.selectionPanelBlock.artworkTitle}`);
        }
    }

    // Next Steps
    if (model.nextStepsBullets.length > 0) {
        lines.push('');
        lines.push('Next Steps:');
        for (const step of model.nextStepsBullets) {
            const bullet = step.completed ? '  [x]' : '  [ ]';
            lines.push(`${bullet} ${step.text}`);
        }
    }

    return lines.join('\n');
}

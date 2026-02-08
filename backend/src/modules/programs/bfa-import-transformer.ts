/**
 * BFA Import Transformer
 *
 * Pure functions that convert BfaProjectExportModel fields into
 * AutoArt entity creation inputs. No database access — just shape conversion.
 */

import type { BfaProjectExportModel, BfaMilestone, BfaNextStepBullet } from '@autoart/shared';

import type { CreateNodeInput } from '@autoart/shared';

import type { BulkCreateRecordInput } from '../records/records.service.js';

// ============================================================================
// PROJECT NODE
// ============================================================================

/**
 * Transform a BFA project export model into a CreateNodeInput for a hierarchy project node.
 */
export function transformToProjectNode(project: BfaProjectExportModel): CreateNodeInput {
    return {
        parentId: null,
        type: 'project',
        title: `${project.header.clientName} – ${project.header.projectName}`,
        metadata: buildProjectMetadata(project),
    };
}

/**
 * Build metadata JSONB for a project node.
 * This structure is what the BFA projector reads back — round-trip compatibility.
 */
function buildProjectMetadata(project: BfaProjectExportModel): Record<string, unknown> {
    return {
        bfa_program: true,
        staff_initials: project.header.staffInitials,
        location: project.header.location,
        category: project.category,
        artwork_budget: project.header.budgets.artwork?.numeric ?? null,
        total_budget: project.header.budgets.total?.numeric ?? null,
        install_date: project.header.install.dateText ?? null,
        project_status: project.statusBlock.projectStatusText ?? null,
        bfa_project_status: project.statusBlock.bfaProjectStatusText ?? null,
        bfa_phase: project.statusBlock.stage ?? null,
    };
}

// ============================================================================
// CONTACT RECORDS
// ============================================================================

/**
 * Transform contacts block into BulkCreateRecordInput[] for the Contact definition.
 * Each contact line becomes a record. Lines are expected to be "Name – Role" or similar.
 */
export function transformContacts(
    project: BfaProjectExportModel,
    classificationNodeId: string,
): BulkCreateRecordInput[] {
    return project.contactsBlock.lines
        .filter(line => line.trim().length > 0)
        .map(line => {
            const parts = line.split(/\s*[–—-]\s*/);
            const name = parts[0]?.trim() || line.trim();
            const role = parts[1]?.trim() || '';

            return {
                uniqueName: `${project.projectId}:contact:${name}`,
                data: {
                    name,
                    role,
                    notes: line,
                },
                classificationNodeId,
            };
        });
}

// ============================================================================
// MILESTONE PHASE NODES
// ============================================================================

/**
 * Transform timeline milestones into CreateNodeInput[] for phase nodes.
 * Each milestone becomes a phase node (phase_kind='Milestone') under a "Timeline" process.
 * The caller must provide the parent process ID.
 */
export function transformMilestonePhases(
    project: BfaProjectExportModel,
): Array<CreateNodeInput & { _milestoneKind: string }> {
    return project.timelineBlock.milestones
        .filter(m => m.kind.trim().length > 0)
        .map((milestone, idx) => ({
            parentId: undefined, // Caller sets this to the Timeline process node
            type: 'phase' as const,
            title: milestone.kind,
            position: idx,
            metadata: buildMilestoneMetadata(milestone),
            _milestoneKind: milestone.kind,
        }));
}

function buildMilestoneMetadata(milestone: BfaMilestone): Record<string, unknown> {
    return {
        phase_kind: 'Milestone',
        milestone_type: normalizeMilestoneType(milestone.kind),
        target_date: milestone.normalizedDate ?? milestone.dateText ?? null,
        status: milestone.status
            ? milestone.status.charAt(0).toUpperCase() + milestone.status.slice(1)
            : 'Scheduled',
    };
}

function normalizeMilestoneType(kind: string): string {
    const upper = kind.toUpperCase().trim();
    if (upper === 'DPAP') return 'DPAP';
    if (upper === 'PPAP') return 'PPAP';
    if (upper.includes('INSTALL')) return 'Install';
    if (upper.includes('FABRICATION') || upper.includes('FAB')) return 'Fabrication Start';
    if (upper.includes('CONTRACT')) return 'Contract';
    if (upper.includes('DESIGN') || upper.includes('APPROVAL')) return 'Design Approval';
    return 'Other';
}

// ============================================================================
// SELECTION PANEL RECORDS
// ============================================================================

/**
 * Transform selection panel block into BulkCreateRecordInput[] for the Selection Panel definition.
 */
export function transformSelectionPanel(
    project: BfaProjectExportModel,
    classificationNodeId: string,
): BulkCreateRecordInput[] {
    const sp = project.selectionPanelBlock;

    // If there's no meaningful data, skip
    if (sp.members.length === 0 && sp.shortlist.length === 0 && !sp.selectedArtist) {
        return [];
    }

    // Create a single Selection Panel record for the project
    return [{
        uniqueName: `${project.projectId}:selection-panel`,
        data: {
            meeting_type: 'SP#1', // Default; real data may have multiple
            members: sp.members.join('\n'),
            shortlisted_artists: sp.shortlist.join('\n'),
            alternates: sp.alternates.join('\n'),
            selected_artist: sp.selectedArtist ?? '',
            artwork_title: sp.artworkTitle ?? '',
        },
        classificationNodeId,
    }];
}

// ============================================================================
// NEXT STEPS → SUBPROCESS NODES
// ============================================================================

/**
 * Transform next steps bullets into subprocess creation inputs.
 * These become subprocess nodes under an "Active" phase within a "Tasks" process.
 */
export function transformNextSteps(
    bullets: BfaNextStepBullet[],
): Array<{ title: string; metadata: Record<string, unknown> }> {
    return bullets
        .filter(b => b.text.trim().length > 0)
        .map(bullet => ({
            title: bullet.text,
            metadata: {
                completed: bullet.completed,
                assignee_hint: bullet.assigneeHint ?? null,
                due_hint: bullet.dueHint ?? null,
            },
        }));
}

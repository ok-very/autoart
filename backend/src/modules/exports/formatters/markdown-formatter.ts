/**
 * Markdown Formatter
 *
 * Formats BFA export models into clean Markdown for documentation.
 */

import type { BfaProjectExportModel, ExportOptions } from '../types.js';

/**
 * Format projects as Markdown document.
 */
export function formatAsMarkdown(
    projects: BfaProjectExportModel[],
    options: ExportOptions
): string {
    const lines: string[] = [];

    // Document header
    lines.push('# BFA To-Do List');
    lines.push('');
    lines.push(`*Generated: ${new Date().toLocaleDateString('en-CA')}*`);
    lines.push('');

    // Group projects by category
    const publicProjects = projects.filter((p) => p.category === 'public');
    const corporateProjects = projects.filter((p) => p.category === 'corporate');
    const privateProjects = projects.filter((p) => p.category === 'private_corporate');

    if (publicProjects.length > 0) {
        lines.push('## PUBLIC ART');
        lines.push('');
        for (const project of publicProjects) {
            lines.push(formatProjectMarkdown(project, options));
            lines.push('');
        }
    }

    if (corporateProjects.length > 0) {
        lines.push('---');
        lines.push('');
        lines.push('## CORPORATE');
        lines.push('');
        for (const project of corporateProjects) {
            lines.push(formatProjectMarkdown(project, options));
            lines.push('');
        }
    }

    if (privateProjects.length > 0) {
        lines.push('---');
        lines.push('');
        lines.push('## PRIVATE / CORPORATE');
        lines.push('');
        for (const project of privateProjects) {
            lines.push(formatProjectMarkdown(project, options));
            lines.push('');
        }
    }

    return lines.join('\n');
}

/**
 * Format a single project as Markdown.
 */
function formatProjectMarkdown(
    project: BfaProjectExportModel,
    options: ExportOptions
): string {
    const lines: string[] = [];

    // Header line
    const headerLine = formatHeaderLine(project);
    lines.push(`### ${headerLine}`);
    lines.push('');

    // Contacts block
    if (options.includeContacts && project.contactsBlock.lines.length > 0) {
        for (const line of project.contactsBlock.lines) {
            lines.push(line);
        }
        lines.push('');
    }

    // Milestones/Timeline
    if (options.includeMilestones && project.timelineBlock.milestones.length > 0) {
        lines.push('**Timeline:**');
        for (const milestone of project.timelineBlock.milestones) {
            const statusMark = milestone.status === 'completed' ? '[x]' : '[ ]';
            const dateStr = milestone.dateText || 'TBD';
            const highlight = isCurrentMonth(milestone.normalizedDate) ? ' ⚡' : '';
            lines.push(`- ${statusMark} **${milestone.kind}:** ${dateStr}${highlight}`);
        }
        lines.push('');
    }

    // Selection Panel
    if (options.includeSelectionPanel && project.selectionPanelBlock.selectedArtist) {
        lines.push('**Selection Panel:**');
        lines.push(`- Selected: ${project.selectionPanelBlock.selectedArtist}`);
        if (project.selectionPanelBlock.artworkTitle) {
            lines.push(`- Artwork: ${project.selectionPanelBlock.artworkTitle}`);
        }
        if (project.selectionPanelBlock.shortlist.length > 0) {
            lines.push(`- Shortlist: ${project.selectionPanelBlock.shortlist.join(', ')}`);
        }
        lines.push('');
    }

    // Status
    if (options.includeStatusNotes && project.statusBlock.projectStatusText) {
        lines.push(`**Status:** ${project.statusBlock.projectStatusText}`);
        lines.push('');
    }

    // Next Steps
    if (project.nextStepsBullets.length > 0) {
        const stepsToShow = options.includeOnlyOpenNextSteps
            ? project.nextStepsBullets.filter((s) => !s.completed)
            : project.nextStepsBullets;

        if (stepsToShow.length > 0) {
            lines.push('**Next Steps:**');
            for (const step of stepsToShow) {
                const bullet = step.completed ? '[x]' : '[ ]';
                const ownerSuffix = step.ownerHint ? ` *(${step.ownerHint})*` : '';
                lines.push(`- ${bullet} ${step.text}${ownerSuffix}`);
            }
            lines.push('');
        }
    }

    return lines.join('\n');
}

/**
 * Format the project header line in BFA style.
 */
function formatHeaderLine(project: BfaProjectExportModel): string {
    const initials = project.header.staffInitials.join('/') || 'XX';
    const budgetParts: string[] = [];

    if (project.header.budgets.artwork?.text) {
        budgetParts.push(`Art: ${project.header.budgets.artwork.text}`);
    }
    if (project.header.budgets.total?.text) {
        budgetParts.push(`Total: ${project.header.budgets.total.text}`);
    }

    let line = `(${initials}) ${project.header.clientName}: ${project.header.projectName}`;

    if (project.header.location) {
        line += `, ${project.header.location}`;
    }

    if (budgetParts.length > 0) {
        line += ` (${budgetParts.join(', ')})`;
    }

    if (project.header.install.dateText) {
        line += `, Install: ${project.header.install.dateText}`;
    }

    return line;
}

/**
 * Check if a date is in the current month.
 */
function isCurrentMonth(dateStr: string | undefined): boolean {
    if (!dateStr) return false;

    const date = new Date(dateStr);
    const now = new Date();

    return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
    );
}

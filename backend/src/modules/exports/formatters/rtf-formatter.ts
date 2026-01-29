/**
 * RTF Formatter
 *
 * Formats BFA export models into Rich Text Format (.rtf)
 * Matches the original BFA To-Do document structure and styling.
 */

import type { BfaProjectExportModel, ExportOptions } from '../types.js';

// RTF escape helper
function escapeRtf(text: string): string {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/\n/g, '\\line ');
}

// RTF bold wrapper
function bold(text: string): string {
    return `{\\b ${escapeRtf(text)}}`;
}


// RTF highlight (yellow background for current month items)
function highlight(text: string): string {
    return `{\\highlight3 ${escapeRtf(text)}}`;
}

/**
 * Format projects as RTF document.
 */
export function formatAsRtf(
    projects: BfaProjectExportModel[],
    options: ExportOptions
): string {
    const rtfParts: string[] = [];

    // RTF header with font table and color table
    rtfParts.push('{\\rtf1\\ansi\\deff0');
    rtfParts.push('{\\fonttbl{\\f0 Calibri;}{\\f1 Calibri;}}');
    // Expanded color table to match original document: 0=auto, 1=black, 2=blue, 3=yellow (highlight), 4=red, 5=gray, 6=cyan
    rtfParts.push('{\\colortbl;\\red0\\green0\\blue0;\\red0\\green0\\blue255;\\red255\\green255\\blue0;\\red255\\green0\\blue0;\\red128\\green128\\blue128;\\red0\\green255\\blue255;}');
    rtfParts.push('');

    // Document title
    rtfParts.push(`{\\fs28\\b BFA To-Do List}\\par`);
    rtfParts.push(`{\\fs20 Generated: ${new Date().toLocaleDateString('en-CA')}}\\par`);
    rtfParts.push('\\par');

    // Group projects by category
    const publicProjects = projects.filter((p) => p.category === 'public');
    const corporateProjects = projects.filter((p) => p.category === 'corporate');
    const privateProjects = projects.filter((p) => p.category === 'private_corporate');

    if (publicProjects.length > 0) {
        rtfParts.push(`{\\fs24\\b PUBLIC ART}\\par`);
        rtfParts.push('\\par');
        for (const project of publicProjects) {
            rtfParts.push(formatProjectRtf(project, options));
            rtfParts.push('\\par');
        }
    }

    if (corporateProjects.length > 0) {
        rtfParts.push('\\page');
        rtfParts.push(`{\\fs24\\b CORPORATE}\\par`);
        rtfParts.push('\\par');
        for (const project of corporateProjects) {
            rtfParts.push(formatProjectRtf(project, options));
            rtfParts.push('\\par');
        }
    }

    if (privateProjects.length > 0) {
        rtfParts.push('\\page');
        rtfParts.push(`{\\fs24\\b PRIVATE / CORPORATE}\\par`);
        rtfParts.push('\\par');
        for (const project of privateProjects) {
            rtfParts.push(formatProjectRtf(project, options));
            rtfParts.push('\\par');
        }
    }

    // Close RTF
    rtfParts.push('}');

    return rtfParts.join('\n');
}

/**
 * Format a single project as RTF.
 */
function formatProjectRtf(
    project: BfaProjectExportModel,
    options: ExportOptions
): string {
    const parts: string[] = [];

    // Header line
    const headerLine = formatHeaderLine(project);
    parts.push(`{\\fs22${bold(headerLine)}}\\par`);

    // Contacts block
    if (options.includeContacts && project.contactsBlock.lines.length > 0) {
        for (const line of project.contactsBlock.lines) {
            parts.push(`{\\fs20 ${escapeRtf(line)}}\\par`);
        }
    }

    // Milestones/Timeline
    if (options.includeMilestones && project.timelineBlock.milestones.length > 0) {
        parts.push(`{\\fs20\\b Timeline:}\\par`);
        for (const milestone of project.timelineBlock.milestones) {
            const statusMark = milestone.status === 'completed' ? '✓' : '●';
            const dateStr = milestone.dateText || 'TBD';
            const line = `  ${statusMark} ${milestone.kind}: ${dateStr}`;

            // Highlight if date is in current month
            if (isCurrentMonth(milestone.normalizedDate)) {
                parts.push(`{\\fs20 ${highlight(line)}}\\par`);
            } else {
                parts.push(`{\\fs20 ${escapeRtf(line)}}\\par`);
            }
        }
    }

    // Selection Panel
    if (options.includeSelectionPanel && project.selectionPanelBlock.selectedArtist) {
        parts.push(`{\\fs20\\b Selection Panel:}\\par`);
        parts.push(`{\\fs20   Selected: ${escapeRtf(project.selectionPanelBlock.selectedArtist)}}\\par`);
        if (project.selectionPanelBlock.artworkTitle) {
            parts.push(`{\\fs20   Artwork: ${escapeRtf(project.selectionPanelBlock.artworkTitle)}}\\par`);
        }
        if (project.selectionPanelBlock.shortlist.length > 0) {
            parts.push(`{\\fs20   Shortlist: ${escapeRtf(project.selectionPanelBlock.shortlist.join(', '))}}\\par`);
        }
    }

    // Status
    if (options.includeStatusNotes && project.statusBlock.projectStatusText) {
        parts.push(`{\\fs20\\b Status:} {\\fs20 ${escapeRtf(project.statusBlock.projectStatusText)}}\\par`);
    }

    // Next Steps
    if (project.nextStepsBullets.length > 0) {
        const stepsToShow = options.includeOnlyOpenNextSteps
            ? project.nextStepsBullets.filter((s) => !s.completed)
            : project.nextStepsBullets;

        if (stepsToShow.length > 0) {
            parts.push(`{\\fs20\\b Next Steps:}\\par`);
            for (const step of stepsToShow) {
                const bullet = step.completed ? '✓' : '●';
                const assigneeSuffix = step.assigneeHint ? ` (${step.assigneeHint})` : '';
                parts.push(`{\\fs20   ${bullet} ${escapeRtf(step.text)}${escapeRtf(assigneeSuffix)}}\\par`);
            }
        }
    }

    return parts.join('\n');
}

/**
 * Format the project header line in BFA style.
 * Format: (JH/XX) Client: Project, Location (Art: $X, Total: $Y), Install: Date
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
        line += ` (${budgetParts.join(' | ')})`;
    }

    if (project.header.install.dateText) {
        line += `, Install: ${project.header.install.dateText}`;
    }

    return line;
}

/**
 * Check if a date is in the current month (for highlighting).
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

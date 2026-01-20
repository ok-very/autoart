/**
 * PDF Formatter
 *
 * Generates HTML for PDF export using AutoHelper's /render/pdf endpoint.
 * Uses Carlito font and matches page size contract.
 */

import {
    PDF_PAGE_PRESETS,
    PDF_DEFAULT_MARGINS,
    type PdfPagePreset,
    type BfaProjectExportModel,
    type ExportOptions,
} from '../schemas/exports.js';

// HTML escape helper
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Check if date is in current month (for highlighting)
function isCurrentMonth(dateStr: string | undefined): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

/**
 * Generate HTML for PDF export.
 */
export function generatePdfHtml(
    projects: BfaProjectExportModel[],
    options: ExportOptions,
    config: {
        pagePreset?: PdfPagePreset;
        autoHelperBaseUrl: string;
    }
): string {
    const preset = config.pagePreset || 'letter';
    const pageConfig = PDF_PAGE_PRESETS[preset];
    const margins = PDF_DEFAULT_MARGINS;
    const { autoHelperBaseUrl } = config;

    const htmlParts: string[] = [];

    // Document head with Carlito font and print styles
    htmlParts.push(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>BFA To-Do List</title>
    <style>
        @font-face {
            font-family: 'Carlito';
            src: url('${autoHelperBaseUrl}/fonts/Carlito/regular.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
        }
        @font-face {
            font-family: 'Carlito';
            src: url('${autoHelperBaseUrl}/fonts/Carlito/bold.ttf') format('truetype');
            font-weight: bold;
            font-style: normal;
        }
        @font-face {
            font-family: 'Carlito';
            src: url('${autoHelperBaseUrl}/fonts/Carlito/italic.ttf') format('truetype');
            font-weight: normal;
            font-style: italic;
        }
        
        @page {
            size: ${pageConfig.width}px ${pageConfig.height}px;
            margin: ${margins.top} ${margins.right} ${margins.bottom} ${margins.left};
        }
        
        * {
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Carlito', 'Calibri', sans-serif;
            font-size: 11pt;
            line-height: 1.4;
            color: #000;
            max-width: ${pageConfig.width - 96}px;
            margin: 0 auto;
        }
        
        h1 {
            font-size: 14pt;
            font-weight: bold;
            margin: 0 0 4px 0;
        }
        
        h2 {
            font-size: 12pt;
            font-weight: bold;
            margin: 16px 0 8px 0;
        }
        
        .date {
            font-size: 10pt;
            color: #666;
            margin-bottom: 16px;
        }
        
        .category-header {
            font-size: 13pt;
            font-weight: bold;
            margin: 24px 0 12px 0;
            padding-bottom: 4px;
            border-bottom: 1px solid #ccc;
        }
        
        .project {
            margin-bottom: 16px;
            page-break-inside: avoid;
        }
        
        .project-header {
            font-size: 11pt;
            font-weight: bold;
            margin-bottom: 4px;
        }
        
        .section-label {
            font-size: 10pt;
            font-weight: bold;
            margin: 8px 0 4px 0;
        }
        
        .contact-line, .step-line, .milestone-line {
            font-size: 10pt;
            margin: 2px 0;
            padding-left: 12px;
        }
        
        .highlight {
            background-color: #ffff00;
        }
        
        .completed {
            text-decoration: line-through;
            color: #666;
        }
        
        .page-break {
            page-break-before: always;
        }
    </style>
</head>
<body>`);

    // Document title
    htmlParts.push(`
    <h1>BFA To-Do List</h1>
    <p class="date">Generated: ${new Date().toLocaleDateString('en-CA')}</p>`);

    // Group projects by category
    const publicProjects = projects.filter((p) => p.category === 'public');
    const corporateProjects = projects.filter((p) => p.category === 'corporate');
    const privateProjects = projects.filter((p) => p.category === 'private_corporate');

    if (publicProjects.length > 0) {
        htmlParts.push(`<div class="category-header">PUBLIC ART</div>`);
        for (const project of publicProjects) {
            htmlParts.push(formatProjectHtml(project, options));
        }
    }

    if (corporateProjects.length > 0) {
        htmlParts.push(`<div class="page-break category-header">CORPORATE</div>`);
        for (const project of corporateProjects) {
            htmlParts.push(formatProjectHtml(project, options));
        }
    }

    if (privateProjects.length > 0) {
        htmlParts.push(`<div class="page-break category-header">PRIVATE / CORPORATE</div>`);
        for (const project of privateProjects) {
            htmlParts.push(formatProjectHtml(project, options));
        }
    }

    // Close document
    htmlParts.push(`
</body>
</html>`);

    return htmlParts.join('\n');
}

/**
 * Format a single project as HTML.
 */
function formatProjectHtml(
    project: BfaProjectExportModel,
    options: ExportOptions
): string {
    const parts: string[] = [];

    // Header line
    const headerLine = formatHeaderLine(project);
    parts.push(`<div class="project">`);
    parts.push(`<div class="project-header">${escapeHtml(headerLine)}</div>`);

    // Contacts block
    if (options.includeContacts && project.contactsBlock.lines.length > 0) {
        for (const line of project.contactsBlock.lines) {
            parts.push(`<p class="contact-line">${escapeHtml(line)}</p>`);
        }
    }

    // Milestones/Timeline
    if (options.includeMilestones && project.timelineBlock.milestones.length > 0) {
        parts.push(`<p class="section-label">Timeline:</p>`);
        for (const milestone of project.timelineBlock.milestones) {
            const statusMark = milestone.status === 'completed' ? '[x]' : '[ ]';
            const dateStr = milestone.dateText || 'TBD';
            const line = `${statusMark} ${milestone.kind}: ${dateStr}`;
            const highlightClass = isCurrentMonth(milestone.normalizedDate) ? ' highlight' : '';
            parts.push(`<p class="milestone-line${highlightClass}">${escapeHtml(line)}</p>`);
        }
    }

    // Selection Panel
    if (options.includeSelectionPanel && project.selectionPanelBlock.selectedArtist) {
        parts.push(`<p class="section-label">Selection Panel:</p>`);
        parts.push(`<p class="contact-line">Selected: ${escapeHtml(project.selectionPanelBlock.selectedArtist)}</p>`);
        if (project.selectionPanelBlock.artworkTitle) {
            parts.push(`<p class="contact-line">Artwork: ${escapeHtml(project.selectionPanelBlock.artworkTitle)}</p>`);
        }
    }

    // Status
    if (options.includeStatusNotes && project.statusBlock.projectStatusText) {
        parts.push(`<p class="section-label">Status: <span style="font-weight:normal">${escapeHtml(project.statusBlock.projectStatusText)}</span></p>`);
    }

    // Next Steps
    if (project.nextStepsBullets.length > 0) {
        const stepsToShow = options.includeOnlyOpenNextSteps
            ? project.nextStepsBullets.filter((s) => !s.completed)
            : project.nextStepsBullets;

        if (stepsToShow.length > 0) {
            parts.push(`<p class="section-label">Next Steps:</p>`);
            for (const step of stepsToShow) {
                const bullet = step.completed ? '[x]' : '[ ]';
                const assigneeSuffix = step.assigneeHint ? ` (${step.assigneeHint})` : '';
                const completedClass = step.completed ? ' completed' : '';
                parts.push(`<p class="step-line${completedClass}">${bullet} ${escapeHtml(step.text)}${escapeHtml(assigneeSuffix)}</p>`);
            }
        }
    }

    parts.push(`</div>`);
    return parts.join('\n');
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

/**
 * BFA DOCX Formatter
 *
 * Generates a Word document from BfaProjectExportModel[] using the `docx` package.
 * Uses Parchment design system tokens (Source Serif 4 + IBM Plex Mono).
 *
 * Sections per project: header, contacts, timeline, selection panel, status, next steps.
 * Projects grouped by category (PUBLIC ART, CORPORATE, PRIVATE / CORPORATE).
 *
 * Returns a `docx.Document` object. Caller serializes with `Packer.toBuffer()`.
 */

import {
    Document,
    Paragraph,
    TextRun,
    AlignmentType,
    BorderStyle,
} from 'docx';

import type { BfaProjectExportModel, ExportOptions } from '../schemas/exports.js';
import { compileDocxStyles } from './compile-docx-styles.js';
import { PARCHMENT_TOKENS } from './style-tokens.js';

// ============================================================================
// COMPILED TOKENS
// ============================================================================

const S = compileDocxStyles(PARCHMENT_TOKENS);

// ============================================================================
// HELPERS
// ============================================================================

function serifRun(text: string, options?: { bold?: boolean; size?: number; color?: string }): TextRun {
    return new TextRun({
        text,
        font: S.fonts.primary,
        size: options?.size ?? S.sizes.body,
        bold: options?.bold,
        color: options?.color ?? S.colors.text,
    });
}

function monoRun(text: string, options?: { size?: number; color?: string }): TextRun {
    return new TextRun({
        text,
        font: S.fonts.mono,
        size: options?.size ?? S.sizes.mono,
        color: options?.color ?? S.colors.textSecondary,
    });
}

function labelRun(text: string): TextRun {
    return new TextRun({
        text,
        font: S.fonts.primary,
        size: S.sizes.meta,
        color: S.colors.accentSecondary,
        allCaps: true,
        bold: true,
    });
}

// ============================================================================
// DOCUMENT BUILDER
// ============================================================================

/**
 * Generate a BFA To-Do DOCX document.
 */
export function generateBfaDocx(
    projects: BfaProjectExportModel[],
    options: ExportOptions,
): Document {
    const publicProjects = projects.filter((p) => p.category === 'public');
    const corporateProjects = projects.filter((p) => p.category === 'corporate');
    const privateProjects = projects.filter((p) => p.category === 'private_corporate');

    const children: Paragraph[] = [];

    // Document title
    children.push(
        new Paragraph({
            children: [serifRun('BFA To-Do List', { bold: true, size: S.sizes.h1 })],
            spacing: { after: 80 },
        }),
        new Paragraph({
            children: [monoRun(`Generated: ${new Date().toLocaleDateString('en-CA')}`)],
            spacing: { after: 300 },
        }),
    );

    if (publicProjects.length > 0) {
        children.push(categoryHeading('Public Art'));
        for (const project of publicProjects) {
            children.push(...formatProject(project, options));
        }
    }

    if (corporateProjects.length > 0) {
        children.push(categoryHeading('Corporate'));
        for (const project of corporateProjects) {
            children.push(...formatProject(project, options));
        }
    }

    if (privateProjects.length > 0) {
        children.push(categoryHeading('Private / Corporate'));
        for (const project of privateProjects) {
            children.push(...formatProject(project, options));
        }
    }

    return new Document({
        styles: {
            default: {
                document: {
                    run: S.defaultRun,
                    paragraph: S.defaultParagraph,
                },
            },
        },
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: S.pageMarginTwip,
                            right: S.pageMarginTwip,
                            bottom: S.pageMarginTwip,
                            left: S.pageMarginTwip,
                        },
                    },
                },
                children,
            },
        ],
    });
}

// ============================================================================
// SECTIONS
// ============================================================================

function categoryHeading(label: string): Paragraph {
    return new Paragraph({
        children: [serifRun(label.toUpperCase(), { bold: true, size: S.sizes.h2, color: S.colors.accent })],
        spacing: { before: 400, after: 200 },
        border: {
            bottom: { style: BorderStyle.SINGLE, size: 1, color: S.colors.border },
        },
    });
}

function formatProject(project: BfaProjectExportModel, options: ExportOptions): Paragraph[] {
    const parts: Paragraph[] = [];

    // Header line
    parts.push(new Paragraph({
        children: [serifRun(formatHeaderLine(project), { bold: true })],
        spacing: { before: 240, after: 80 },
    }));

    // Contacts
    if (options.includeContacts && project.contactsBlock.lines.length > 0) {
        parts.push(new Paragraph({
            children: [labelRun('Contacts')],
            spacing: { before: 80, after: 40 },
        }));
        for (const line of project.contactsBlock.lines) {
            parts.push(new Paragraph({
                children: [serifRun(line, { size: S.sizes.meta, color: S.colors.textSecondary })],
                indent: { left: 216 },
            }));
        }
    }

    // Timeline
    if (options.includeMilestones && project.timelineBlock.milestones.length > 0) {
        parts.push(new Paragraph({
            children: [labelRun('Timeline')],
            spacing: { before: 80, after: 40 },
        }));
        for (const milestone of project.timelineBlock.milestones) {
            const mark = milestone.status === 'completed' ? '\u2713' : '\u25CB';
            const dateStr = milestone.dateText || 'TBD';
            parts.push(new Paragraph({
                children: [
                    monoRun(`${mark} `, { size: S.sizes.meta }),
                    serifRun(`${milestone.kind}: ${dateStr}`, { size: S.sizes.meta }),
                ],
                indent: { left: 216 },
            }));
        }
    }

    // Selection Panel
    if (options.includeSelectionPanel && hasSelectionPanelContent(project)) {
        parts.push(new Paragraph({
            children: [labelRun('Selection Panel')],
            spacing: { before: 80, after: 40 },
        }));
        if (project.selectionPanelBlock.selectedArtist) {
            parts.push(new Paragraph({
                children: [
                    serifRun('Selected: ', { size: S.sizes.meta, color: S.colors.textSecondary }),
                    serifRun(project.selectionPanelBlock.selectedArtist, { size: S.sizes.meta, bold: true }),
                ],
                indent: { left: 216 },
            }));
        }
        if (project.selectionPanelBlock.artworkTitle) {
            parts.push(new Paragraph({
                children: [
                    serifRun('Artwork: ', { size: S.sizes.meta, color: S.colors.textSecondary }),
                    serifRun(project.selectionPanelBlock.artworkTitle, { size: S.sizes.meta }),
                ],
                indent: { left: 216 },
            }));
        }
        if (project.selectionPanelBlock.shortlist.length > 0) {
            parts.push(new Paragraph({
                children: [
                    serifRun('Shortlist: ', { size: S.sizes.meta, color: S.colors.textSecondary }),
                    serifRun(project.selectionPanelBlock.shortlist.join(', '), { size: S.sizes.meta }),
                ],
                indent: { left: 216 },
            }));
        }
        if (project.selectionPanelBlock.members.length > 0) {
            parts.push(new Paragraph({
                children: [
                    serifRun('Members: ', { size: S.sizes.meta, color: S.colors.textSecondary }),
                    serifRun(project.selectionPanelBlock.members.join(', '), { size: S.sizes.meta }),
                ],
                indent: { left: 216 },
            }));
        }
        if (project.selectionPanelBlock.alternates.length > 0) {
            parts.push(new Paragraph({
                children: [
                    serifRun('Alternates: ', { size: S.sizes.meta, color: S.colors.textSecondary }),
                    serifRun(project.selectionPanelBlock.alternates.join(', '), { size: S.sizes.meta }),
                ],
                indent: { left: 216 },
            }));
        }
    }

    // Status
    if (options.includeStatusNotes && project.statusBlock.projectStatusText) {
        parts.push(new Paragraph({
            children: [labelRun('Status')],
            spacing: { before: 80, after: 40 },
        }));
        parts.push(new Paragraph({
            children: [serifRun(project.statusBlock.projectStatusText, { size: S.sizes.meta })],
            indent: { left: 216 },
        }));
    }

    // Next Steps
    const stepsToShow = options.includeOnlyOpenNextSteps
        ? project.nextStepsBullets.filter((s) => !s.completed)
        : project.nextStepsBullets;

    if (stepsToShow.length > 0) {
        parts.push(new Paragraph({
            children: [labelRun('Next Steps')],
            spacing: { before: 80, after: 40 },
        }));
        for (const step of stepsToShow) {
            const bullet = step.completed ? '\u2713' : '\u2022';
            const assignee = step.assigneeHint ? ` (${step.assigneeHint})` : '';
            parts.push(new Paragraph({
                children: [
                    monoRun(`${bullet} `, { size: S.sizes.meta }),
                    serifRun(step.text + assignee, {
                        size: S.sizes.meta,
                        color: step.completed ? S.colors.textSecondary : S.colors.text,
                    }),
                ],
                indent: { left: 216 },
            }));
        }
    }

    // Spacer after project
    parts.push(new Paragraph({ spacing: { after: 160 } }));

    return parts;
}

// ============================================================================
// HELPERS
// ============================================================================

function hasSelectionPanelContent(project: BfaProjectExportModel): boolean {
    const sp = project.selectionPanelBlock;
    return !!(sp.selectedArtist || sp.artworkTitle || sp.shortlist.length > 0 || sp.members.length > 0 || sp.alternates.length > 0);
}

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

/**
 * BFA Google Docs Injector
 *
 * Per-project section replacement in a Google Doc after sync apply.
 * Finds project headers in the target doc and replaces their content sections
 * with fresh projections. Existing highlighting in the doc is maintained
 * through the reinjection loop — no programmatic highlight generation.
 *
 * Pure module — no DB access. Receives everything it needs.
 */

import type { BfaInjectionResult, BfaProjectExportModel, ExportOptions } from '@autoart/shared';
import { DEFAULT_EXPORT_OPTIONS } from '@autoart/shared';

import type { GoogleDocsClient, GoogleDocumentRequest } from '../exports/connectors/google-docs-client.js';
import type { GoogleDocsConnector, ParsedProjectHeader } from '../exports/connectors/google-docs-connector.js';

// ============================================================================
// TYPES
// ============================================================================

interface ProjectMatch {
    project: BfaProjectExportModel;
    header: ParsedProjectHeader;
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Inject updated project content into specific sections of a Google Doc.
 *
 * For each affected project:
 * 1. Matches export model to existing doc header by client+project name
 * 2. Deletes the content between this header and the next
 * 3. Inserts fresh formatted content
 * 4. Applies bold formatting to labels
 *
 * Requests are sorted in reverse document order to avoid index drift.
 */
export async function injectProjects(
    connector: GoogleDocsConnector,
    client: GoogleDocsClient,
    documentId: string,
    projects: BfaProjectExportModel[],
): Promise<BfaInjectionResult> {
    const errors: Array<{ projectId: string; projectLabel: string; error: string }> = [];
    let projectsInjected = 0;
    let projectsSkipped = 0;

    // 1. Analyze document to find existing project headers
    const analysis = await connector.analyzeDocument(documentId);
    const docHeaders = analysis.projectHeaders;

    if (docHeaders.length === 0) {
        return {
            documentId,
            documentUrl: analysis.webViewLink ?? '',
            projectsInjected: 0,
            projectsSkipped: projects.length,
            errors: [{
                projectId: '',
                projectLabel: '',
                error: 'No project headers found in document',
            }],
        };
    }

    // 2. Match projects to doc headers
    const matches: ProjectMatch[] = [];

    for (const project of projects) {
        const matched = matchProjectToHeader(project, docHeaders);
        if (matched) {
            matches.push({ project, header: matched });
        } else {
            projectsSkipped++;
        }
    }

    if (matches.length === 0) {
        return {
            documentId,
            documentUrl: analysis.webViewLink ?? '',
            projectsInjected: 0,
            projectsSkipped: projects.length,
            errors: [],
        };
    }

    // 3. Build batch update requests for each matched project
    // Process in reverse document order to avoid index drift
    matches.sort((a, b) => b.header.startIndex - a.header.startIndex);

    const allRequests: GoogleDocumentRequest[] = [];

    for (const { project, header } of matches) {
        try {
            const { requests } = buildProjectReplacement(
                project,
                header,
            );
            allRequests.push(...requests);
            projectsInjected++;
        } catch (err) {
            errors.push({
                projectId: project.projectId,
                projectLabel: `${project.header.clientName}: ${project.header.projectName}`,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    // 4. Execute batch update
    if (allRequests.length > 0) {
        await client.batchUpdate(documentId, allRequests);
    }

    return {
        documentId,
        documentUrl: analysis.webViewLink ?? '',
        projectsInjected,
        projectsSkipped,
        errors,
    };
}

// ============================================================================
// PROJECT MATCHING
// ============================================================================

/**
 * Match an export model to a document header by client+project name.
 * Tries exact normalized match first, then substring on clientName.
 */
function matchProjectToHeader(
    project: BfaProjectExportModel,
    headers: ParsedProjectHeader[],
): ParsedProjectHeader | null {
    const projClient = normalize(project.header.clientName);
    const projName = normalize(project.header.projectName);

    // Exact match on both client + project name
    for (const header of headers) {
        const docClient = normalize(header.clientName ?? '');
        const docProject = normalize(header.projectName ?? '');

        if (docClient === projClient && docProject === projName) {
            return header;
        }
    }

    // Fallback: client name substring match (handles slight naming variations)
    if (projClient.length >= 3) {
        for (const header of headers) {
            const docClient = normalize(header.clientName ?? '');
            if (docClient.includes(projClient) || projClient.includes(docClient)) {
                const docProject = normalize(header.projectName ?? '');
                if (docProject.includes(projName) || projName.includes(docProject)) {
                    return header;
                }
            }
        }
    }

    return null;
}

function normalize(s: string): string {
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

// ============================================================================
// CONTENT BUILDING
// ============================================================================

/**
 * Build Google Docs batchUpdate requests to replace a single project's content.
 *
 * Returns requests that:
 * 1. Delete existing content (from end of header line to start of next project)
 * 2. Insert new formatted content at the deletion point
 * 3. Apply bold to label prefixes
 */
function buildProjectReplacement(
    project: BfaProjectExportModel,
    header: ParsedProjectHeader,
): { requests: GoogleDocumentRequest[] } {
    const requests: GoogleDocumentRequest[] = [];

    // The header line itself is preserved — we only replace content AFTER the header.
    // header.startIndex is where the header line starts.
    // We need to find where the header line ends (first newline after startIndex).
    // Since parseProjectHeaders tracks line boundaries, the content starts
    // at headerLineEnd and goes to header.endIndex.

    // Compute where the header line ends (approximate: header rawText length + newline)
    const headerLineEnd = header.startIndex + header.rawText.length + 1; // +1 for newline
    const contentEnd = header.endIndex;

    // Only delete if there's content between header line and next section
    if (contentEnd > headerLineEnd) {
        requests.push({
            deleteContentRange: {
                range: {
                    startIndex: headerLineEnd,
                    endIndex: contentEnd,
                },
            },
        });
    }

    // Build the replacement text (everything except the header line)
    const contentText = formatProjectContent(project, DEFAULT_EXPORT_OPTIONS);

    // Insert new content at the position where we deleted
    if (contentText.length > 0) {
        requests.push({
            insertText: {
                location: { index: headerLineEnd },
                text: contentText,
            },
        });

        // Apply formatting to inserted content
        const formatRequests = buildFormattingRequests(
            contentText,
            headerLineEnd,
        );
        requests.push(...formatRequests);
    }

    return { requests };
}

/**
 * Format project content (everything below the header line).
 * Based on GoogleDocsConnector.formatSingleProject but without the header line.
 */
function formatProjectContent(
    project: BfaProjectExportModel,
    options: ExportOptions,
): string {
    const lines: string[] = [''];

    // Contacts
    if (options.includeContacts && project.contactsBlock.lines.length > 0) {
        lines.push(...project.contactsBlock.lines);
        lines.push('');
    }

    // Milestones
    if (options.includeMilestones && project.timelineBlock.milestones.length > 0) {
        for (const milestone of project.timelineBlock.milestones) {
            lines.push(`${milestone.kind}: ${milestone.dateText ?? 'TBC'}`);
        }
        lines.push('');
    }

    // Selection Panel
    if (options.includeSelectionPanel && (
        project.selectionPanelBlock.members.length > 0 ||
        project.selectionPanelBlock.shortlist.length > 0 ||
        project.selectionPanelBlock.selectedArtist
    )) {
        if (project.selectionPanelBlock.members.length > 0) {
            lines.push(`Selection Panel: ${project.selectionPanelBlock.members.join(', ')}`);
        }
        if (project.selectionPanelBlock.shortlist.length > 0) {
            lines.push(`Shortlist: ${project.selectionPanelBlock.shortlist.join(', ')}`);
        }
        if (project.selectionPanelBlock.selectedArtist) {
            lines.push(`Selected Artist: ${project.selectionPanelBlock.selectedArtist}`);
        }
        if (project.selectionPanelBlock.artworkTitle) {
            lines.push(`Artwork: ${project.selectionPanelBlock.artworkTitle}`);
        }
        lines.push('');
    }

    // Phase (canonical phase name from interpreter pipeline)
    if (project.statusBlock.stage) {
        lines.push(`Phase: ${project.statusBlock.stage}`);
    }

    // Status
    if (options.includeStatusNotes) {
        if (project.statusBlock.projectStatusText) {
            lines.push(`Project Status: ${project.statusBlock.projectStatusText}`);
        }
        if (project.statusBlock.bfaProjectStatusText) {
            lines.push(`BFA Project Status: ${project.statusBlock.bfaProjectStatusText}`);
        }
        if (project.statusBlock.nextStepsNarrative) {
            lines.push(project.statusBlock.nextStepsNarrative);
        }
        if (project.statusBlock.stage || project.statusBlock.projectStatusText || project.statusBlock.bfaProjectStatusText) {
            lines.push('');
        }
    }

    // Next Steps bullets
    const bullets = options.includeOnlyOpenNextSteps
        ? project.nextStepsBullets.filter(b => !b.completed)
        : project.nextStepsBullets;

    if (bullets.length > 0) {
        for (const bullet of bullets) {
            const symbol = bullet.completed ? '\u2713' : '\u25CF';
            lines.push(`${symbol} ${bullet.text}`);
        }
        lines.push('');
    }

    // Separator
    lines.push('\u2014'.repeat(40));
    lines.push('');

    return lines.join('\n');
}

// ============================================================================
// FORMATTING
// ============================================================================

/** Known label prefixes to bold in the output */
const LABEL_PREFIXES = [
    'Phase:',
    'Selection Panel:',
    'Shortlist:',
    'Selected Artist:',
    'Artwork:',
    'Project Status:',
    'BFA Project Status:',
];

/**
 * Build text style requests for bold labels.
 */
function buildFormattingRequests(
    contentText: string,
    insertOffset: number,
): GoogleDocumentRequest[] {
    const requests: GoogleDocumentRequest[] = [];

    // Bold label prefixes
    for (const prefix of LABEL_PREFIXES) {
        let searchStart = 0;
        while (true) {
            const idx = contentText.indexOf(prefix, searchStart);
            if (idx === -1) break;

            requests.push({
                updateTextStyle: {
                    range: {
                        startIndex: insertOffset + idx,
                        endIndex: insertOffset + idx + prefix.length,
                    },
                    textStyle: { bold: true },
                    fields: 'bold',
                },
            });
            searchStart = idx + prefix.length;
        }
    }

    // Also bold milestone kind labels (e.g. "DPAP:", "Install:")
    const lines = contentText.split('\n');
    let lineOffset = 0;
    for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0 && colonIdx < 40) {
            // Check if this looks like a "Label: Value" line (not a separator or bullet)
            const beforeColon = line.slice(0, colonIdx).trim();
            if (beforeColon.length > 0 && !/^[\u25CF\u2713]/.test(beforeColon)) {
                const labelEnd = colonIdx + 1; // include the colon
                requests.push({
                    updateTextStyle: {
                        range: {
                            startIndex: insertOffset + lineOffset,
                            endIndex: insertOffset + lineOffset + labelEnd,
                        },
                        textStyle: { bold: true },
                        fields: 'bold',
                    },
                });
            }
        }
        lineOffset += line.length + 1; // +1 for newline
    }

    return requests;
}


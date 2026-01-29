/**
 * Google Docs Connector
 *
 * Handles reading from and writing to Google Docs for BFA export.
 * Features:
 * - Parse existing BFA To-Do documents for backfeeding
 * - Write/update project blocks with BFA formatting
 * - Support template-based document creation
 */

import { GoogleDocsClient, type GoogleDocument, type GoogleDocumentRequest } from './google-docs-client.js';
import type { BfaProjectExportModel, ExportOptions } from '../types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface GoogleDocsConnectorConfig {
    accessToken: string;
}

export interface ParsedProjectHeader {
    /** Raw header line text */
    rawText: string;
    /** Index in the document where this project starts */
    startIndex: number;
    /** Index where this project ends (next project start or document end) */
    endIndex: number;
    /** Extracted staff initials */
    staffInitials: string[];
    /** Client name */
    clientName?: string;
    /** Project name */
    projectName?: string;
    /** Location */
    location?: string;
    /** Match confidence score (0-100) */
    matchScore: number;
}

export interface DocumentAnalysis {
    /** Google Doc ID analyzed */
    docId: string;
    /** Document title */
    docTitle: string;
    /** Projects found in the existing document */
    projectHeaders: ParsedProjectHeader[];
    /** Document last modified time */
    lastModified?: string;
}

export interface WriteDocumentResult {
    documentId: string;
    documentUrl: string;
    projectsWritten: number;
    success: boolean;
    error?: string;
}

// ============================================================================
// HEADER PARSING PATTERNS
// ============================================================================

/**
 * BFA header pattern examples:
 * - (JB/NY) Client Name: Project Name, Location (Art: $500K | Total: $1M) Install: 2025
 * - (JB) Client: Project, Vancouver (Art: TBC) Install: TBD
 * - (NY/JB/SK) Developer Inc: Tower Project, Calgary (Art: $250K | Total: $400K | Phase 1: $150K | Phase 2: $100K) Install: Q4 2026
 */
const HEADER_PATTERN = /^\s*\(([A-Z]{2}(?:\/[A-Z]{2})*)\)\s+([^:]+):\s+([^,]+),?\s*([^(]*?)?\s*(?:\([^)]*\))?\s*(?:Install:?\s*(.+))?$/i;

// Simpler pattern for partial matches
const PARTIAL_HEADER_PATTERN = /^\s*\(([A-Z]{2}(?:\/[A-Z]{2})*)\)\s+(.+)/i;

// ============================================================================
// CONNECTOR CLASS
// ============================================================================

export class GoogleDocsConnector {
    private client: GoogleDocsClient;

    constructor(config: GoogleDocsConnectorConfig) {
        this.client = new GoogleDocsClient({ accessToken: config.accessToken });
    }

    // ============================================================================
    // BACKFEEDING: READ EXISTING DOCUMENT
    // ============================================================================

    /**
     * Analyze an existing Google Doc to find BFA project headers.
     * Used for backfeeding - matching existing doc content to database projects.
     */
    async analyzeDocument(documentId: string): Promise<DocumentAnalysis> {
        const doc = await this.client.getDocument(documentId);
        const metadata = await this.client.getFileMetadata(documentId);

        const plainText = this.extractPlainText(doc);
        const projectHeaders = this.parseProjectHeaders(plainText, doc);

        return {
            docId: documentId,
            docTitle: doc.title,
            projectHeaders,
            lastModified: metadata.modifiedTime,
        };
    }

    /**
     * Extract plain text from Google Doc structure.
     */
    private extractPlainText(doc: GoogleDocument): string {
        const elements = doc.body?.content ?? [];
        let text = '';

        for (const element of elements) {
            if (element.paragraph) {
                for (const paragraphElement of element.paragraph.elements) {
                    if (paragraphElement.textRun?.content) {
                        text += paragraphElement.textRun.content;
                    }
                }
            }
        }

        return text;
    }

    /**
     * Parse document text to find project headers.
     */
    private parseProjectHeaders(text: string, doc: GoogleDocument): ParsedProjectHeader[] {
        const lines = text.split('\n');
        const headers: ParsedProjectHeader[] = [];
        let currentIndex = 1; // Google Docs indexes start at 1

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineLength = line.length + 1; // +1 for newline

            // Try full header pattern
            const fullMatch = line.match(HEADER_PATTERN);
            if (fullMatch) {
                const [, initials, client, project, location] = fullMatch;
                headers.push({
                    rawText: line,
                    startIndex: currentIndex,
                    endIndex: currentIndex + lineLength, // Will be updated when we find next header
                    staffInitials: initials.split('/'),
                    clientName: client?.trim(),
                    projectName: project?.trim(),
                    location: location?.trim(),
                    matchScore: 100,
                });
            } else {
                // Try partial pattern for less structured headers
                const partialMatch = line.match(PARTIAL_HEADER_PATTERN);
                if (partialMatch) {
                    const [, initials, rest] = partialMatch;
                    // Try to extract client/project from rest
                    const colonParts = rest.split(':');
                    headers.push({
                        rawText: line,
                        startIndex: currentIndex,
                        endIndex: currentIndex + lineLength,
                        staffInitials: initials.split('/'),
                        clientName: colonParts[0]?.trim(),
                        projectName: colonParts[1]?.split(',')[0]?.trim(),
                        location: colonParts[1]?.split(',')[1]?.trim(),
                        matchScore: 60,
                    });
                }
            }

            currentIndex += lineLength;
        }

        // Update endIndex values to point to the next header start
        for (let i = 0; i < headers.length - 1; i++) {
            headers[i].endIndex = headers[i + 1].startIndex;
        }
        // Last header extends to document end
        if (headers.length > 0) {
            const lastElement = doc.body?.content?.slice(-1)[0];
            headers[headers.length - 1].endIndex = lastElement?.endIndex ?? currentIndex;
        }

        return headers;
    }

    // ============================================================================
    // WRITING: CREATE/UPDATE DOCUMENT
    // ============================================================================

    /**
     * Create a new Google Doc with BFA export content.
     */
    async createDocument(
        title: string,
        projects: BfaProjectExportModel[],
        options: ExportOptions
    ): Promise<WriteDocumentResult> {
        try {
            // Create empty document
            const doc = await this.client.createDocument(title);

            // Generate content
            const content = this.formatProjectsForDoc(projects, options);

            // Insert content
            await this.client.insertText(doc.documentId, 1, content);

            // Apply formatting
            await this.applyBfaFormatting(doc.documentId, projects, options);

            // Get the document URL
            const metadata = await this.client.getFileMetadata(doc.documentId);

            return {
                documentId: doc.documentId,
                documentUrl: metadata.webViewLink,
                projectsWritten: projects.length,
                success: true,
            };
        } catch (error) {
            return {
                documentId: '',
                documentUrl: '',
                projectsWritten: 0,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Update an existing Google Doc with new project data.
     * Replaces entire content (for now - could be made smarter to preserve manual edits).
     */
    async updateDocument(
        documentId: string,
        projects: BfaProjectExportModel[],
        options: ExportOptions
    ): Promise<WriteDocumentResult> {
        try {
            // Generate new content
            const content = this.formatProjectsForDoc(projects, options);

            // Replace document content
            await this.client.replaceContent(documentId, content);

            // Apply formatting
            await this.applyBfaFormatting(documentId, projects, options);

            // Get the document URL
            const metadata = await this.client.getFileMetadata(documentId);

            return {
                documentId,
                documentUrl: metadata.webViewLink,
                projectsWritten: projects.length,
                success: true,
            };
        } catch (error) {
            return {
                documentId,
                documentUrl: '',
                projectsWritten: 0,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Format projects as plain text for Google Docs.
     */
    private formatProjectsForDoc(
        projects: BfaProjectExportModel[],
        options: ExportOptions
    ): string {
        const sections: string[] = [];

        // Group by category
        const publicProjects = projects.filter(p => p.category === 'public');
        const corporateProjects = projects.filter(p => p.category === 'corporate');
        const privateCorpProjects = projects.filter(p => p.category === 'private_corporate');

        if (publicProjects.length > 0) {
            sections.push('PUBLIC ART\n');
            sections.push(...publicProjects.map(p => this.formatSingleProject(p, options)));
        }

        if (corporateProjects.length > 0) {
            sections.push('\nCORPORATE\n');
            sections.push(...corporateProjects.map(p => this.formatSingleProject(p, options)));
        }

        if (privateCorpProjects.length > 0) {
            sections.push('\nPRIVATE / CORPORATE\n');
            sections.push(...privateCorpProjects.map(p => this.formatSingleProject(p, options)));
        }

        return sections.join('\n');
    }

    /**
     * Format a single project block.
     */
    private formatSingleProject(
        project: BfaProjectExportModel,
        options: ExportOptions
    ): string {
        const lines: string[] = [];

        // Header line
        const initials = project.header.staffInitials.length > 0
            ? `(${project.header.staffInitials.join('/')}) `
            : '';

        const budgetParts: string[] = [];
        if (project.header.budgets.artwork?.text) {
            budgetParts.push(`Art: ${project.header.budgets.artwork.text}`);
        }
        if (project.header.budgets.total?.text) {
            budgetParts.push(`Total: ${project.header.budgets.total.text}`);
        }
        if (project.header.budgets.phases) {
            for (const phase of project.header.budgets.phases) {
                if (phase.text) {
                    budgetParts.push(`${phase.phaseLabel}: ${phase.text}`);
                }
            }
        }

        const budgetStr = budgetParts.length > 0 ? ` (${budgetParts.join(' | ')})` : '';
        const installStr = project.header.install.dateText
            ? ` Install: ${project.header.install.dateText}`
            : project.header.install.statusText
                ? ` Install: ${project.header.install.statusText}`
                : '';

        lines.push(`${initials}${project.header.clientName}: ${project.header.projectName}, ${project.header.location}${budgetStr}${installStr}`);
        lines.push('');

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
            if (project.statusBlock.projectStatusText || project.statusBlock.bfaProjectStatusText) {
                lines.push('');
            }
        }

        // Next Steps bullets
        const bullets = options.includeOnlyOpenNextSteps
            ? project.nextStepsBullets.filter(b => !b.completed)
            : project.nextStepsBullets;

        if (bullets.length > 0) {
            for (const bullet of bullets) {
                const symbol = bullet.completed ? '✓' : '●';
                lines.push(`${symbol} ${bullet.text}`);
            }
            lines.push('');
        }

        // Add separator between projects
        lines.push('—'.repeat(40));
        lines.push('');

        return lines.join('\n');
    }

    /**
     * Apply BFA-style formatting to the document.
     * - Font family (default: Calibri for BFA)
     * - Bold headers
     * - Bullet formatting
     * - Yellow highlighting for current month items
     */
    private async applyBfaFormatting(
        documentId: string,
        _projects: BfaProjectExportModel[],
        _options: ExportOptions,
        font: string = 'Calibri'
    ): Promise<void> {
        // Get current document to find text positions
        const doc = await this.client.getDocument(documentId);
        const requests: GoogleDocumentRequest[] = [];
        const text = this.extractPlainText(doc);

        // Apply font to entire document first
        if (text.length > 0) {
            requests.push({
                updateTextStyle: {
                    range: { startIndex: 1, endIndex: text.length + 1 },
                    textStyle: {
                        weightedFontFamily: {
                            fontFamily: font,
                        },
                        fontSize: { magnitude: 11, unit: 'PT' },
                    },
                    fields: 'weightedFontFamily,fontSize',
                },
            });
        }

        // Find and format section headers (PUBLIC ART, etc.)
        const sectionHeaders = ['PUBLIC ART', 'CORPORATE', 'PRIVATE / CORPORATE'];

        for (const header of sectionHeaders) {
            const index = text.indexOf(header);
            if (index !== -1) {
                // Account for Google Docs 1-based indexing
                const startIndex = index + 1;
                const endIndex = startIndex + header.length;

                requests.push({
                    updateTextStyle: {
                        range: { startIndex, endIndex },
                        textStyle: {
                            bold: true,
                            fontSize: { magnitude: 14, unit: 'PT' },
                        },
                        fields: 'bold,fontSize',
                    },
                });
            }
        }

        // Find and bold project headers (lines starting with initials pattern)
        const lines = text.split('\n');
        let currentIndex = 1;

        for (const line of lines) {
            if (PARTIAL_HEADER_PATTERN.test(line)) {
                requests.push({
                    updateTextStyle: {
                        range: {
                            startIndex: currentIndex,
                            endIndex: currentIndex + line.length,
                        },
                        textStyle: { bold: true },
                        fields: 'bold',
                    },
                });
            }
            currentIndex += line.length + 1; // +1 for newline
        }

        // Apply formatting if we have any requests
        if (requests.length > 0) {
            await this.client.batchUpdate(documentId, requests);
        }
    }

    // ============================================================================
    // UTILITIES
    // ============================================================================

    /**
     * List available Google Docs for the user.
     */
    async listDocuments(): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
        return this.client.listDocuments();
    }

    /**
     * Test connection by fetching user's doc list.
     */
    async testConnection(): Promise<{ connected: boolean; error?: string }> {
        try {
            await this.client.listDocuments();
            return { connected: true };
        } catch (error) {
            return {
                connected: false,
                error: error instanceof Error ? error.message : 'Connection failed',
            };
        }
    }
}

export default GoogleDocsConnector;

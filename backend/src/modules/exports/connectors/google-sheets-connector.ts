/**
 * Google Sheets Connector
 *
 * Exports BFA project data to Google Sheets format.
 * Supports:
 * - Summary view (one row per project)
 * - Detailed view (multiple sheets with breakdowns)
 * - Budget tracking sheets
 * - Timeline/milestone tracking
 */

import { GoogleClient, type Spreadsheet, type SpreadsheetRequest, type RowData, type CellData } from './google-client.js';
import type { BfaProjectExportModel, ExportOptions } from '../types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface GoogleSheetsConnectorConfig {
    accessToken: string;
}

export interface SheetsExportOptions extends ExportOptions {
    /** Include a summary sheet */
    includeSummarySheet?: boolean;
    /** Include detailed project sheets */
    includeProjectSheets?: boolean;
    /** Include budget breakdown sheet */
    includeBudgetSheet?: boolean;
    /** Include timeline sheet */
    includeTimelineSheet?: boolean;
    /** Include next steps sheet */
    includeNextStepsSheet?: boolean;
}

export interface WriteSpreadsheetResult {
    spreadsheetId: string;
    spreadsheetUrl: string;
    sheetsCreated: string[];
    success: boolean;
    error?: string;
}

// ============================================================================
// CONNECTOR CLASS
// ============================================================================

export class GoogleSheetsConnector {
    private client: GoogleClient;

    constructor(config: GoogleSheetsConnectorConfig) {
        this.client = new GoogleClient({ accessToken: config.accessToken });
    }

    // ========================================================================
    // EXPORT OPERATIONS
    // ========================================================================

    /**
     * Create a new spreadsheet with BFA project data
     */
    async createSpreadsheet(
        title: string,
        projects: BfaProjectExportModel[],
        options: SheetsExportOptions
    ): Promise<WriteSpreadsheetResult> {
        try {
            // Create the spreadsheet
            const spreadsheet = await this.client.createSpreadsheet(title);
            const spreadsheetId = spreadsheet.spreadsheetId;
            const sheetsCreated: string[] = [];

            // Write summary sheet (default first sheet)
            if (options.includeSummarySheet !== false) {
                await this.writeSummarySheet(spreadsheetId, projects, options);
                sheetsCreated.push('Summary');
            }

            // Add budget sheet
            if (options.includeBudgetSheet) {
                await this.addSheet(spreadsheetId, 'Budgets');
                await this.writeBudgetSheet(spreadsheetId, projects);
                sheetsCreated.push('Budgets');
            }

            // Add timeline sheet
            if (options.includeTimelineSheet) {
                await this.addSheet(spreadsheetId, 'Timeline');
                await this.writeTimelineSheet(spreadsheetId, projects);
                sheetsCreated.push('Timeline');
            }

            // Add next steps sheet
            if (options.includeNextStepsSheet) {
                await this.addSheet(spreadsheetId, 'Next Steps');
                await this.writeNextStepsSheet(spreadsheetId, projects, options);
                sheetsCreated.push('Next Steps');
            }

            // Get the spreadsheet URL
            const file = await this.client.getFile(spreadsheetId);

            return {
                spreadsheetId,
                spreadsheetUrl: file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
                sheetsCreated,
                success: true,
            };
        } catch (error) {
            return {
                spreadsheetId: '',
                spreadsheetUrl: '',
                sheetsCreated: [],
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Update an existing spreadsheet with new data
     */
    async updateSpreadsheet(
        spreadsheetId: string,
        projects: BfaProjectExportModel[],
        options: SheetsExportOptions
    ): Promise<WriteSpreadsheetResult> {
        try {
            const sheetsCreated: string[] = [];

            // Get existing spreadsheet to check which sheets exist
            const spreadsheet = await this.client.getSpreadsheet(spreadsheetId);
            const existingSheets = new Set(spreadsheet.sheets.map(s => s.properties.title));

            // Update or create summary sheet
            if (options.includeSummarySheet !== false) {
                // Clear and rewrite the first sheet
                await this.client.clearValues(spreadsheetId, 'Sheet1!A:Z');
                await this.writeSummarySheet(spreadsheetId, projects, options, 'Sheet1');
                sheetsCreated.push('Summary');
            }

            // Update budget sheet
            if (options.includeBudgetSheet) {
                if (!existingSheets.has('Budgets')) {
                    await this.addSheet(spreadsheetId, 'Budgets');
                } else {
                    await this.client.clearValues(spreadsheetId, 'Budgets!A:Z');
                }
                await this.writeBudgetSheet(spreadsheetId, projects);
                sheetsCreated.push('Budgets');
            }

            // Update timeline sheet
            if (options.includeTimelineSheet) {
                if (!existingSheets.has('Timeline')) {
                    await this.addSheet(spreadsheetId, 'Timeline');
                } else {
                    await this.client.clearValues(spreadsheetId, 'Timeline!A:Z');
                }
                await this.writeTimelineSheet(spreadsheetId, projects);
                sheetsCreated.push('Timeline');
            }

            // Update next steps sheet
            if (options.includeNextStepsSheet) {
                if (!existingSheets.has('Next Steps')) {
                    await this.addSheet(spreadsheetId, 'Next Steps');
                } else {
                    await this.client.clearValues(spreadsheetId, 'Next Steps!A:Z');
                }
                await this.writeNextStepsSheet(spreadsheetId, projects, options);
                sheetsCreated.push('Next Steps');
            }

            const file = await this.client.getFile(spreadsheetId);

            return {
                spreadsheetId,
                spreadsheetUrl: file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
                sheetsCreated,
                success: true,
            };
        } catch (error) {
            return {
                spreadsheetId,
                spreadsheetUrl: '',
                sheetsCreated: [],
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    // ========================================================================
    // SHEET WRITERS
    // ========================================================================

    /**
     * Write summary sheet with one row per project
     */
    private async writeSummarySheet(
        spreadsheetId: string,
        projects: BfaProjectExportModel[],
        options: SheetsExportOptions,
        sheetName = 'Sheet1'
    ): Promise<void> {
        const headers = [
            'Staff',
            'Client',
            'Project',
            'Location',
            'Category',
            'Stage',
            'Artwork Budget',
            'Total Budget',
            'Install Date',
            'Selected Artist',
            'Project Status',
            'BFA Status',
        ];

        const rows: unknown[][] = [headers];

        for (const project of projects) {
            rows.push([
                project.header.staffInitials.join('/'),
                project.header.clientName,
                project.header.projectName,
                project.header.location,
                project.category,
                project.statusBlock.stage ?? '',
                project.header.budgets.artwork?.text ?? '',
                project.header.budgets.total?.text ?? '',
                project.header.install.dateText ?? project.header.install.statusText ?? '',
                project.selectionPanelBlock.selectedArtist ?? '',
                project.statusBlock.projectStatusText ?? '',
                project.statusBlock.bfaProjectStatusText ?? '',
            ]);
        }

        await this.client.updateValues(spreadsheetId, `${sheetName}!A1`, rows);

        // Format header row
        await this.formatHeaderRow(spreadsheetId, 0, headers.length);
    }

    /**
     * Write budget breakdown sheet
     */
    private async writeBudgetSheet(
        spreadsheetId: string,
        projects: BfaProjectExportModel[]
    ): Promise<void> {
        const headers = [
            'Client',
            'Project',
            'Artwork Budget',
            'Artwork (Numeric)',
            'Total Budget',
            'Total (Numeric)',
            'Phase 1',
            'Phase 2',
            'Phase 3',
        ];

        const rows: unknown[][] = [headers];

        for (const project of projects) {
            const phases = project.header.budgets.phases ?? [];
            rows.push([
                project.header.clientName,
                project.header.projectName,
                project.header.budgets.artwork?.text ?? '',
                project.header.budgets.artwork?.numeric ?? '',
                project.header.budgets.total?.text ?? '',
                project.header.budgets.total?.numeric ?? '',
                phases[0]?.text ?? '',
                phases[1]?.text ?? '',
                phases[2]?.text ?? '',
            ]);
        }

        await this.client.updateValues(spreadsheetId, 'Budgets!A1', rows);
    }

    /**
     * Write timeline/milestones sheet
     */
    private async writeTimelineSheet(
        spreadsheetId: string,
        projects: BfaProjectExportModel[]
    ): Promise<void> {
        const headers = [
            'Client',
            'Project',
            'Milestone Type',
            'Date',
            'Status',
        ];

        const rows: unknown[][] = [headers];

        for (const project of projects) {
            for (const milestone of project.timelineBlock.milestones) {
                rows.push([
                    project.header.clientName,
                    project.header.projectName,
                    milestone.kind,
                    milestone.dateText ?? '',
                    milestone.status ?? '',
                ]);
            }
        }

        await this.client.updateValues(spreadsheetId, 'Timeline!A1', rows);
    }

    /**
     * Write next steps sheet
     */
    private async writeNextStepsSheet(
        spreadsheetId: string,
        projects: BfaProjectExportModel[],
        options: SheetsExportOptions
    ): Promise<void> {
        const headers = [
            'Client',
            'Project',
            'Next Step',
            'Owner',
            'Due',
            'Completed',
        ];

        const rows: unknown[][] = [headers];

        for (const project of projects) {
            const bullets = options.includeOnlyOpenNextSteps
                ? project.nextStepsBullets.filter(b => !b.completed)
                : project.nextStepsBullets;

            for (const bullet of bullets) {
                rows.push([
                    project.header.clientName,
                    project.header.projectName,
                    bullet.text,
                    bullet.ownerHint ?? '',
                    bullet.dueHint ?? '',
                    bullet.completed ? 'Yes' : 'No',
                ]);
            }
        }

        await this.client.updateValues(spreadsheetId, 'Next Steps!A1', rows);
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    /**
     * Add a new sheet to spreadsheet
     */
    private async addSheet(spreadsheetId: string, title: string): Promise<void> {
        await this.client.batchUpdateSpreadsheet(spreadsheetId, [
            { addSheet: { properties: { title } } },
        ]);
    }

    /**
     * Format header row (bold, background color)
     */
    private async formatHeaderRow(
        spreadsheetId: string,
        sheetId: number,
        columnCount: number
    ): Promise<void> {
        const headerFormat: RowData = {
            values: Array(columnCount).fill({
                userEnteredFormat: {
                    backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
                    textFormat: { bold: true },
                },
            } as CellData),
        };

        await this.client.batchUpdateSpreadsheet(spreadsheetId, [
            {
                updateCells: {
                    rows: [headerFormat],
                    fields: 'userEnteredFormat(backgroundColor,textFormat)',
                    start: { sheetId, rowIndex: 0, columnIndex: 0 },
                },
            },
        ]);
    }

    /**
     * List available spreadsheets
     */
    async listSpreadsheets(): Promise<Array<{ id: string; name: string; modifiedTime?: string }>> {
        const files = await this.client.listSpreadsheets();
        return files.map(f => ({
            id: f.id,
            name: f.name,
            modifiedTime: f.modifiedTime,
        }));
    }

    /**
     * Test connection
     */
    async testConnection(): Promise<{ connected: boolean; error?: string }> {
        return this.client.testConnection();
    }
}

export default GoogleSheetsConnector;

/**
 * Monday CSV Parser
 *
 * Parses Monday.com CSV exports into import plan format.
 * Extracts:
 * - Stage headers (optional grouping info)
 * - Subprocesses (main rows)
 * - Tasks (subitems - comma-delimited in Subitems column)
 */

import type { ParseResult, ImportPlanContainer, ImportPlanItem } from '../types.js';

// ============================================================================
// TYPES
// ============================================================================

interface MondayRow {
    Name?: string;
    Subitems?: string;
    PM?: string;
    'Task Status'?: string;
    'Target Date'?: string;
    Priority?: string;
    Notes?: string;
    Files?: string;
    'Timeline - Start'?: string;
    'Timeline - End'?: string;
    'Key Personnel'?: string;
    Developer?: string;
    [key: string]: string | undefined;
}

// ============================================================================
// PARSER CLASS
// ============================================================================

export class MondayCSVParser {
    parse(rawData: string, config: Record<string, unknown> = {}): ParseResult {
        const rows = this.parseCSV(rawData);
        const containers: ImportPlanContainer[] = [];
        const items: ImportPlanItem[] = [];
        const validationIssues: ParseResult['validationIssues'] = [];

        let currentStageLabel: string | null = null;
        let currentStageOrder = 0;
        let processId: string | null = null;
        let lastSubprocessId: string | null = null;

        const processName = (config.processName as string) ?? 'Imported Process';

        for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
            const row = rows[rowIdx];
            const name = row.Name?.trim() ?? '';

            // Skip empty rows
            if (!name && !row.Subitems?.trim()) {
                continue;
            }

            // Create process container on first meaningful row
            if (!processId) {
                processId = `temp-process-1`;
                containers.push({
                    tempId: processId,
                    type: 'process',
                    title: processName,
                    parentTempId: null,
                });
            }

            // Detect stage headers (e.g., "Stage 1 - Project Initiation")
            if (this.isStageHeader(name)) {
                currentStageLabel = this.extractStageName(name);
                currentStageOrder++;
                continue;
            }

            // Detect subprocess (row with Name but may or may not have Subitems)
            if (name && !row.Subitems?.trim()) {
                // This is a subprocess header row
                const subprocessId = `temp-subprocess-${containers.length}`;
                containers.push({
                    tempId: subprocessId,
                    type: 'subprocess',
                    title: name,
                    parentTempId: processId,
                });
                lastSubprocessId = subprocessId;
                continue;
            }

            // Parse subitems (comma-delimited task names)
            if (row.Subitems?.trim()) {
                const parentId = lastSubprocessId;
                if (!parentId) {
                    validationIssues.push({
                        severity: 'warning',
                        message: `Subitems found without parent subprocess on row ${rowIdx + 1}`,
                    });
                    // Create a default subprocess
                    const subprocessId = `temp-subprocess-${containers.length}`;
                    containers.push({
                        tempId: subprocessId,
                        type: 'subprocess',
                        title: name || 'Untitled Subprocess',
                        parentTempId: processId,
                    });
                    lastSubprocessId = subprocessId;
                }

                const taskNames = row.Subitems.split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);

                for (const taskName of taskNames) {
                    const taskId = `temp-task-${items.length}`;
                    items.push({
                        tempId: taskId,
                        title: taskName,
                        parentTempId: lastSubprocessId!,
                        metadata: {
                            'import.stage_name': currentStageLabel,
                            'import.stage_order': currentStageOrder,
                            'import.source_row': rowIdx + 1,
                        },
                        plannedAction: {
                            type: 'CREATE_TASK',
                            payload: { title: taskName },
                        },
                        fieldRecordings: this.extractFieldRecordings(row),
                    });
                }
            }
        }

        // Validate results
        if (containers.length === 0) {
            validationIssues.push({
                severity: 'error',
                message: 'No containers (process/subprocess) detected in the data',
            });
        }

        if (items.length === 0 && containers.length > 1) {
            validationIssues.push({
                severity: 'warning',
                message: 'No task items detected. Check if the Subitems column contains data.',
            });
        }

        return { containers, items, validationIssues };
    }

    // ============================================================================
    // HELPERS
    // ============================================================================

    private parseCSV(rawData: string): MondayRow[] {
        const lines = rawData.split(/\r?\n/).filter((line) => line.trim());
        if (lines.length < 2) return [];

        const headers = this.parseCSVLine(lines[0]);
        const rows: MondayRow[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            const row: MondayRow = {};
            for (let j = 0; j < headers.length; j++) {
                row[headers[j]] = values[j] ?? '';
            }
            rows.push(row);
        }

        return rows;
    }

    private parseCSVLine(line: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());

        return result;
    }

    private isStageHeader(name: string): boolean {
        return /^Stage\s*\d/i.test(name);
    }

    private extractStageName(name: string): string {
        // Extract name after "Stage X -" or similar pattern
        const match = name.match(/^Stage\s*\d+\s*[-–—]\s*(.+)/i);
        return match ? match[1].trim() : name;
    }

    private extractFieldRecordings(row: MondayRow): Array<{ fieldName: string; value: unknown }> {
        const recordings: Array<{ fieldName: string; value: unknown }> = [];

        if (row['Task Status']?.trim()) {
            recordings.push({ fieldName: 'Status', value: row['Task Status'].trim() });
        }
        if (row['Target Date']?.trim()) {
            recordings.push({ fieldName: 'Target Date', value: row['Target Date'].trim() });
        }
        if (row.Priority?.trim()) {
            recordings.push({ fieldName: 'Priority', value: row.Priority.trim() });
        }
        if (row.Notes?.trim()) {
            recordings.push({ fieldName: 'Notes', value: row.Notes.trim() });
        }
        if (row.PM?.trim()) {
            recordings.push({ fieldName: 'Project Manager', value: row.PM.trim() });
        }

        return recordings;
    }
}

export default MondayCSVParser;

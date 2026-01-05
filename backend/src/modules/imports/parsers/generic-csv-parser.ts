/**
 * Generic CSV Parser
 *
 * Simple CSV parser that creates tasks from rows.
 * Expects columns: name/title, status, description, etc.
 */

import type { ParseResult, ImportPlanContainer, ImportPlanItem } from '../types.js';

// ============================================================================
// PARSER CLASS
// ============================================================================

export class GenericCSVParser {
    parse(rawData: string, config: Record<string, unknown> = {}): ParseResult {
        const rows = this.parseCSV(rawData);
        const containers: ImportPlanContainer[] = [];
        const items: ImportPlanItem[] = [];
        const validationIssues: ParseResult['validationIssues'] = [];

        if (rows.length === 0) {
            validationIssues.push({
                severity: 'error',
                message: 'No data found in CSV',
            });
            return { containers, items, validationIssues };
        }

        const processName = (config.processName as string) ?? 'Imported Data';
        const subprocessName = (config.subprocessName as string) ?? 'Imported Items';

        // Create default containers
        const processId = 'temp-process-1';
        const subprocessId = 'temp-subprocess-1';

        containers.push({
            tempId: processId,
            type: 'process',
            title: processName,
            parentTempId: null,
        });

        containers.push({
            tempId: subprocessId,
            type: 'subprocess',
            title: subprocessName,
            parentTempId: processId,
        });

        // Identify title column
        const headers = Object.keys(rows[0]);
        const titleColumn = this.findTitleColumn(headers);

        if (!titleColumn) {
            validationIssues.push({
                severity: 'warning',
                message: 'No title/name column detected. Using first column.',
            });
        }

        const titleKey = titleColumn ?? headers[0];

        // Create items from rows
        for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
            const row = rows[rowIdx];
            const title = String(row[titleKey] ?? '').trim();

            if (!title) {
                validationIssues.push({
                    severity: 'warning',
                    message: `Row ${rowIdx + 1} has no title, skipping`,
                    recordTempId: `temp-task-${rowIdx}`,
                });
                continue;
            }

            const taskId = `temp-task-${items.length}`;
            items.push({
                tempId: taskId,
                title,
                parentTempId: subprocessId,
                metadata: {
                    'import.source_row': rowIdx + 1,
                },
                plannedAction: {
                    type: 'CREATE_TASK',
                    payload: { title },
                },
                fieldRecordings: this.extractFieldRecordings(row, titleKey),
            });
        }

        return { containers, items, validationIssues };
    }

    // ============================================================================
    // HELPERS
    // ============================================================================

    private parseCSV(rawData: string): Record<string, string>[] {
        const lines = rawData.split(/\r?\n/).filter((line) => line.trim());
        if (lines.length < 2) return [];

        const headers = this.parseCSVLine(lines[0]);
        const rows: Record<string, string>[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            const row: Record<string, string> = {};
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

    private findTitleColumn(headers: string[]): string | null {
        const candidates = ['title', 'name', 'task', 'item', 'subject', 'heading'];
        for (const candidate of candidates) {
            const found = headers.find((h) => h.toLowerCase().includes(candidate));
            if (found) return found;
        }
        return null;
    }

    private extractFieldRecordings(
        row: Record<string, string>,
        titleKey: string
    ): Array<{ fieldName: string; value: unknown }> {
        const recordings: Array<{ fieldName: string; value: unknown }> = [];
        const skipKeys = [titleKey];
        const commonFields = ['status', 'priority', 'due', 'date', 'assignee', 'owner', 'notes', 'description'];

        for (const [key, value] of Object.entries(row)) {
            if (skipKeys.includes(key)) continue;
            if (!value?.trim()) continue;

            const keyLower = key.toLowerCase();
            const isCommon = commonFields.some((f) => keyLower.includes(f));

            if (isCommon) {
                recordings.push({ fieldName: key, value: value.trim() });
            }
        }

        return recordings;
    }
}

export default GenericCSVParser;

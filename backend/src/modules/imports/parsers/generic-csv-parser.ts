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
    ): Array<{ fieldName: string; value: unknown; renderHint?: string }> {
        const recordings: Array<{ fieldName: string; value: unknown; renderHint?: string }> = [];
        let unnamedCounter = 1;

        for (const [key, value] of Object.entries(row)) {
            // Skip title column
            if (key === titleKey) continue;
            // Skip empty values
            if (!value?.trim()) continue;

            // Handle empty/unnamed headers - preserve data with generated name
            const fieldName = key.trim() || `Field ${unnamedCounter++}`;
            const trimmedValue = value.trim();

            recordings.push({
                fieldName,
                value: trimmedValue,
                renderHint: this.inferRenderHint(fieldName.toLowerCase(), trimmedValue)
            });
        }

        return recordings;
    }

    /**
     * Infer a render hint from the field name and value content.
     * Known patterns get semantic hints; unknown fields default to text.
     */
    private inferRenderHint(keyLower: string, value: string): string {
        // Known field patterns → semantic hints
        if (keyLower.includes('status')) return 'status';
        if (keyLower.includes('priority')) return 'select';
        if (keyLower.includes('date') || keyLower.includes('due')) return 'date';
        if (keyLower.includes('owner') || keyLower.includes('assignee')) return 'person';
        if (keyLower.includes('description') || keyLower.includes('notes')) return 'longtext';

        // Long text detection (>200 chars or contains newlines)
        if (value.length > 200 || value.includes('\n')) return 'longtext';

        // Default to plain text
        return 'text';
    }
}

export default GenericCSVParser;

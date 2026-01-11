/**
 * Monday CSV Parser (v3.0)
 *
 * Parses Monday.com CSV exports into import plan format.
 * Improved for varied export formats:
 * - Header KV block pre-pass for metadata
 * - Flexible stage detection (colon optional)
 * - Stable container hierarchy (no per-task subprocesses)
 * - Proper subtask handling
 */

import type { ParseResult, ImportPlanContainer, ImportPlanItem } from '../types.js';

// ============================================================================
// TYPES
// ============================================================================

interface MondayRow {
    [key: string]: string | undefined;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if a row is a table header (Name, Subitems, ...)
 */
function isTableHeader(row: MondayRow): boolean {
    const name = (row['Name'] ?? row[0] ?? '').toLowerCase();
    const subitems = (row['Subitems'] ?? row[1] ?? '').toLowerCase();
    return (name === 'name' && subitems === 'subitems') ||
        (name === 'subitems' && subitems === 'name');
}

/**
 * Check if a value looks like a metadata label (ends with colon only)
 */
function isMetadataLabel(value: string): boolean {
    const trimmed = value.trim();
    return /^[A-Za-z\s]+:$/.test(trimmed);
}

/**
 * Patterns to detect stage headers
 */
const STAGE_PATTERNS = [
    /^Stage\s+\d+/i,
    /^Phase\s+\d+/i,
];

/**
 * Section headers to treat as stages
 */
const SECTION_HEADERS = [
    'project files',
    'plaque',
    'legal letters',
    'photography',
];

// ============================================================================
// PARSER CLASS
// ============================================================================

export class MondayCSVParser {
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

        // Extract process name from row 1 (Monday export format has project title in first cell)
        const csvTitle = rows.length > 0 ? (rows[0][0] ?? rows[0]['Name'] ?? '').trim() : '';
        const processName = csvTitle || (config.processName as string) || 'Imported Process';

        // Create the main process container
        const processId = 'temp-process-main';
        containers.push({
            tempId: processId,
            type: 'process',
            title: processName,
            parentTempId: null,
            definitionName: 'process', // Classification hint
        });

        let currentStageId: string | null = null;
        let currentStageName: string | null = null;
        let currentStageOrder = 0;
        let currentTaskId: string | null = null;
        let stageCounter = 0;
        let taskCounter = 0;
        let subtaskCounter = 0;

        for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
            const row = rows[rowIdx];
            const col0 = (row['Name'] ?? row[0] ?? '').trim();
            const col1 = (row['Subitems'] ?? row[1] ?? '').trim();

            // Skip empty rows
            if (!col0 && !col1) continue;

            // Skip table headers
            if (isTableHeader(row)) continue;

            // Skip "Subitems" header row (appears after main task rows)
            if (col0.toLowerCase() === 'subitems' && (row['Name'] ?? row[1] ?? '').trim().toLowerCase() === 'name') {
                continue;
            }

            // Detect stage headers
            const isStage = STAGE_PATTERNS.some((p) => p.test(col0));
            const isSection = SECTION_HEADERS.includes(col0.toLowerCase());

            if (isStage || isSection) {
                const stageId = `temp-stage-${stageCounter++}`;
                const stageName = this.extractStageName(col0);
                containers.push({
                    tempId: stageId,
                    type: 'subprocess',
                    title: stageName || col0, // Use extracted name if available
                    parentTempId: processId,
                    definitionName: 'stage', // Classification hint
                });
                currentStageId = stageId;
                currentStageName = stageName;
                currentStageOrder++;
                currentTaskId = null;
                continue;
            }

            // Skip rows before first stage
            if (!currentStageId) continue;

            // Skip metadata-like rows that leaked through
            if (isMetadataLabel(col0)) continue;

            // Subtask row: empty col0, non-empty col1
            if (col0 === '' && col1 !== '') {
                if (currentTaskId) {
                    // Create subtask as an item under the current task's parent stage
                    const subtaskId = `temp-subtask-${subtaskCounter++}`;
                    items.push({
                        tempId: subtaskId,
                        title: col1,
                        parentTempId: currentStageId!,
                        metadata: {
                            isSubtask: true,
                            parentTaskTempId: currentTaskId,
                            status: row['Status'] ?? row[3] ?? 'Not Started',
                            targetDate: row['Target Date'] ?? row[4] ?? null,
                            'import.stage_name': currentStageName,
                            'import.stage_order': currentStageOrder,
                            'import.source_row': rowIdx + 1,
                        },
                        plannedAction: {
                            type: 'CREATE_SUBTASK',
                            payload: { title: col1 },
                        },
                        fieldRecordings: this.extractFieldRecordings(row),
                    });
                }
                continue;
            }

            // Task row: non-empty col0 under a stage
            if (col0 !== '') {
                const taskId = `temp-task-${taskCounter++}`;

                // Parse subitems preview from col1 (comma-separated list)
                const subitemsList = col1 ? col1.split(',').map((s) => s.trim()).filter(Boolean) : [];

                items.push({
                    tempId: taskId,
                    title: col0,
                    parentTempId: currentStageId!,
                    metadata: {
                        status: row['Task Status'] ?? row[3] ?? 'Not Started',
                        targetDate: row['Target Date'] ?? row[4] ?? null,
                        priority: row['Priority'] ?? row[5] ?? null,
                        notes: row['Notes'] ?? row[6] ?? null,
                        subitemsPreview: subitemsList.length > 0 ? subitemsList : null,
                        'import.stage_name': currentStageName,
                        'import.stage_order': currentStageOrder,
                        'import.source_row': rowIdx + 1,
                    },
                    plannedAction: {
                        type: 'CREATE_TASK',
                        payload: { title: col0 },
                    },
                    fieldRecordings: this.extractFieldRecordings(row),
                });
                currentTaskId = taskId;
            }
        }

        // Validation
        if (containers.length <= 1) {
            validationIssues.push({
                severity: 'warning',
                message: 'No stages detected. Check if "Stage X" headers exist in the data.',
            });
        }

        if (items.length === 0) {
            validationIssues.push({
                severity: 'warning',
                message: 'No tasks found. Check CSV structure.',
            });
        }

        // Check for tasks that look like metadata (end with ":")
        const suspiciousTasks = items.filter((i) => i.title.endsWith(':'));
        if (suspiciousTasks.length > 0) {
            validationIssues.push({
                severity: 'warning',
                message: `Found ${suspiciousTasks.length} task(s) ending with ":" which may be metadata`,
            });
        }

        return { containers, items, validationIssues };
    }

    // ============================================================================
    // HELPERS
    // ============================================================================

    private parseCSV(rawData: string): MondayRow[] {
        const rows: MondayRow[] = [];
        let currentRow: string[] = [];
        let currentCell = '';
        let inQuotes = false;

        for (let i = 0; i < rawData.length; i++) {
            const char = rawData[i];
            const nextChar = rawData[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    currentCell += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                currentRow.push(currentCell);
                currentCell = '';
            } else if ((char === '\r' || char === '\n') && !inQuotes) {
                if (char === '\r' && nextChar === '\n') i++;
                currentRow.push(currentCell);
                if (currentRow.some((c) => c.trim())) {
                    // Convert array to object with indices as keys
                    const rowObj: MondayRow = {};
                    currentRow.forEach((val, idx) => {
                        rowObj[idx] = val;
                    });
                    rows.push(rowObj);
                }
                currentRow = [];
                currentCell = '';
            } else {
                currentCell += char;
            }
        }

        if (currentCell) currentRow.push(currentCell);
        if (currentRow.length > 0 && currentRow.some((c) => c.trim())) {
            const rowObj: MondayRow = {};
            currentRow.forEach((val, idx) => {
                rowObj[idx] = val;
            });
            rows.push(rowObj);
        }

        return rows;
    }

    private extractStageName(name: string): string {
        // Extract name after "Stage X:" or "Stage X -" pattern
        const match = name.match(/^Stage\s*\d+\s*[:–—-]\s*(.+)/i);
        return match ? match[1].trim() : name;
    }

    private extractFieldRecordings(row: MondayRow): Array<{ fieldName: string; value: unknown; renderHint?: string }> {
        const recordings: Array<{ fieldName: string; value: unknown; renderHint?: string }> = [];
        let unnamedCounter = 1;

        // Known field mappings with specific render hints (preserve existing behavior)
        const knownFields: Record<string, { keys: string[]; renderHint: string }> = {
            'Status': { keys: ['Task Status', 'Status', '3'], renderHint: 'status' },
            'Target Date': { keys: ['Target Date', '4'], renderHint: 'date' },
            'Priority': { keys: ['Priority', '5'], renderHint: 'select' },
            'Notes': { keys: ['Notes', '6'], renderHint: 'longtext' },
            'Owner': { keys: ['PM', '2'], renderHint: 'person' },
        };

        const processedKeys = new Set<string>();

        // First pass: extract known fields with specific hints
        for (const [fieldName, config] of Object.entries(knownFields)) {
            for (const key of config.keys) {
                const value = row[key];
                if (value?.trim()) {
                    recordings.push({
                        fieldName,
                        value: value.trim(),
                        renderHint: config.renderHint
                    });
                    config.keys.forEach(k => processedKeys.add(k));
                    break;
                }
            }
        }

        // Second pass: capture all remaining columns
        for (const [key, value] of Object.entries(row)) {
            if (processedKeys.has(key)) continue;
            if (!value?.trim()) continue;
            // Skip Name and Subitems columns (handled separately)
            if (key === 'Name' || key === 'Subitems' || key === '0' || key === '1') continue;

            // Handle empty/unnamed headers
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
        if (keyLower.includes('status')) return 'status';
        if (keyLower.includes('priority')) return 'select';
        if (keyLower.includes('date') || keyLower.includes('due')) return 'date';
        if (keyLower.includes('owner') || keyLower.includes('assignee') || keyLower.includes('pm')) return 'person';
        if (keyLower.includes('description') || keyLower.includes('notes')) return 'longtext';

        // Long text detection (>200 chars or contains newlines)
        if (value.length > 200 || value.includes('\n')) return 'longtext';

        return 'text';
    }
}

export default MondayCSVParser;

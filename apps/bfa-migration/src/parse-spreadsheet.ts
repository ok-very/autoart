/**
 * Parse the Vancouver Project Template spreadsheet into structured task data
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// xlsx is CJS-only, use require
const XLSX = require('xlsx') as typeof import('xlsx');

export interface ParsedTask {
    name: string;
    stageNumber: number;
    stageName: string;
    notes: string;
    emailTemplate: string;
    isMilestone: boolean;
    isSubtask: boolean;
    /** Index of parent task within the stage (for subtasks) */
    parentIndex: number | null;
    /** Original row index in the stage for ordering */
    orderInStage: number;
}

export interface ParsedStage {
    number: number;
    name: string;
    tasks: ParsedTask[];
}

const STAGE_REGEX = /^STAGE\s+(\d+)\s*[—–-]\s*(.+)$/i;
const MILESTONE_REGEX = /^★\s*(.+)$/;
const SUBTASK_REGEX = /^\s*→\s*(.+)$/;

export async function parseSpreadsheet(filePath: string): Promise<ParsedStage[]> {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    const stages: ParsedStage[] = [];
    let currentStage: ParsedStage | null = null;
    let lastParentIndex = -1;

    // Skip header rows (0-3), start at row 4 (0-indexed)
    for (let i = 4; i < rows.length; i++) {
        const row = rows[i];
        const cellA = String(row[0] ?? '').trim();
        const cellF = String(row[5] ?? '').trim(); // Notes
        const cellG = String(row[6] ?? '').trim(); // Email template

        // Skip empty rows and footer
        if (!cellA || cellA.startsWith('BFA Vancouver')) continue;

        // Check for stage header
        const stageMatch = cellA.match(STAGE_REGEX);
        if (stageMatch) {
            currentStage = {
                number: parseInt(stageMatch[1], 10),
                name: stageMatch[2].trim(),
                tasks: [],
            };
            stages.push(currentStage);
            lastParentIndex = -1;
            continue;
        }

        if (!currentStage) continue;

        // Check for milestone
        const milestoneMatch = cellA.match(MILESTONE_REGEX);
        if (milestoneMatch) {
            currentStage.tasks.push({
                name: milestoneMatch[1].trim(),
                stageNumber: currentStage.number,
                stageName: currentStage.name,
                notes: cellF,
                emailTemplate: cellG,
                isMilestone: true,
                isSubtask: false,
                parentIndex: null,
                orderInStage: currentStage.tasks.length,
            });
            // Milestones don't become parents
            continue;
        }

        // Check for subtask
        const subtaskMatch = cellA.match(SUBTASK_REGEX);
        if (subtaskMatch) {
            currentStage.tasks.push({
                name: subtaskMatch[1].trim(),
                stageNumber: currentStage.number,
                stageName: currentStage.name,
                notes: cellF,
                emailTemplate: cellG,
                isMilestone: false,
                isSubtask: true,
                parentIndex: lastParentIndex >= 0 ? lastParentIndex : null,
                orderInStage: currentStage.tasks.length,
            });
            continue;
        }

        // Regular task
        lastParentIndex = currentStage.tasks.length;
        currentStage.tasks.push({
            name: cellA,
            stageNumber: currentStage.number,
            stageName: currentStage.name,
            notes: cellF,
            emailTemplate: cellG,
            isMilestone: false,
            isSubtask: false,
            parentIndex: null,
            orderInStage: currentStage.tasks.length,
        });
    }

    return stages;
}

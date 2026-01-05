/**
 * Import Types
 *
 * Shared types for the imports module.
 */

export interface ImportPlanContainer {
    tempId: string;
    type: 'project' | 'process' | 'subprocess';
    title: string;
    parentTempId: string | null;
}

export interface ImportPlanItem {
    tempId: string;
    title: string;
    parentTempId: string;
    metadata: Record<string, unknown>;
    plannedAction: {
        type: string;
        payload: Record<string, unknown>;
    };
    fieldRecordings: Array<{
        fieldName: string;
        value: unknown;
    }>;
}

export interface ImportPlan {
    sessionId: string;
    containers: ImportPlanContainer[];
    items: ImportPlanItem[];
    validationIssues: Array<{
        severity: 'error' | 'warning';
        message: string;
        recordTempId?: string;
    }>;
}

export interface ParseResult {
    containers: ImportPlanContainer[];
    items: ImportPlanItem[];
    validationIssues: Array<{
        severity: 'error' | 'warning';
        message: string;
        recordTempId?: string;
    }>;
}

export type FieldRecording = { fieldName: string; value: unknown };


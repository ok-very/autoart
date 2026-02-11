/**
 * Breadcrumb Trace System
 *
 * Lightweight step logger that writes a JSON trace file per test run.
 * Designed for future MCP server consumption — each test step is
 * replayable as an MCP tool call.
 *
 * Output format:
 * {
 *   "testId": "csv-import-golden-path",
 *   "startedAt": "2026-02-10T...",
 *   "steps": [
 *     { "t": 0, "step": "authenticate", "waypoint": "session-ready" },
 *     { "t": 1200, "step": "upload-csv", "data": { "rows": 3 } }
 *   ]
 * }
 */

import * as fs from 'fs';
import * as path from 'path';

export interface BreadcrumbStep {
    /** Milliseconds since test start */
    t: number;
    /** Step name */
    step: string;
    /** Optional waypoint name (decision-tree node) */
    waypoint?: string;
    /** Optional arbitrary data */
    data?: Record<string, unknown>;
}

export interface BreadcrumbTrace {
    testId: string;
    startedAt: string;
    steps: BreadcrumbStep[];
}

export class TestBreadcrumbs {
    private testId: string;
    private startTime: number;
    private startedAt: string;
    private steps: BreadcrumbStep[] = [];

    constructor(testId: string) {
        this.testId = testId;
        this.startTime = Date.now();
        this.startedAt = new Date().toISOString();
    }

    /**
     * Log a named step with optional data.
     */
    log(step: string, data?: Record<string, unknown>): void {
        const entry: BreadcrumbStep = {
            t: Date.now() - this.startTime,
            step,
        };
        if (data) entry.data = data;
        this.steps.push(entry);
    }

    /**
     * Log a waypoint checkpoint (a named, assertable state in the decision tree).
     */
    checkpoint(waypoint: string, data?: Record<string, unknown>): void {
        const entry: BreadcrumbStep = {
            t: Date.now() - this.startTime,
            step: waypoint,
            waypoint,
        };
        if (data) entry.data = data;
        this.steps.push(entry);
    }

    /**
     * Write the trace to a JSON file.
     *
     * @param outputDir - Directory to write to (created if missing)
     */
    async flush(outputDir: string): Promise<void> {
        const trace: BreadcrumbTrace = {
            testId: this.testId,
            startedAt: this.startedAt,
            steps: this.steps,
        };

        await fs.promises.mkdir(outputDir, { recursive: true });

        const filename = `${this.testId}-${Date.now()}.json`;
        const filepath = path.join(outputDir, filename);

        await fs.promises.writeFile(filepath, JSON.stringify(trace, null, 2), 'utf-8');
    }

    /**
     * Get the raw trace object (useful for in-test assertions).
     */
    getTrace(): BreadcrumbTrace {
        return {
            testId: this.testId,
            startedAt: this.startedAt,
            steps: [...this.steps],
        };
    }
}

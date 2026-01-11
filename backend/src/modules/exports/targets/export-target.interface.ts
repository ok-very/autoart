/**
 * Export Target Interface
 *
 * Defines the contract for pluggable export targets.
 * Allows modular addition of new export formats (invoices, budgets, InDesign, etc.)
 */

import type { ExportOptions, BfaProjectExportModel, ExportResult } from '../types.js';

// ============================================================================
// VALIDATION
// ============================================================================

export interface ValidationResult {
    valid: boolean;
    errors?: string[];
}

// ============================================================================
// EXPORT TARGET INTERFACE
// ============================================================================

/**
 * Export Target - Pluggable export format implementation.
 * 
 * Each target is responsible for:
 * 1. Validating configuration (OAuth tokens, file paths, etc.)
 * 2. Projecting database state into the target's data model
 * 3. Executing the export (writing files, uploading to APIs, etc.)
 */
export interface ExportTarget {
    /** Unique target ID (e.g., 'bfa-rtf', 'google-docs') */
    readonly id: string;

    /** Human-readable name */
    readonly name: string;

    /** Description for UI */
    readonly description: string;

    /** Required OAuth scopes (if applicable) */
    readonly requiredScopes?: string[];

    /**
     * Validate configuration before execution.
     * Check for required fields, OAuth tokens, file permissions, etc.
     */
    validate(config: Record<string, unknown>): Promise<ValidationResult>;

    /**
     * Project database state into target format.
     * Most targets will use BfaProjectExportModel,
     * but this is flexible for future custom projections.
     */
    project(
        projectIds: string[],
        options: ExportOptions
    ): Promise<unknown>;

    /**
     * Execute the export.
     * Writes to file, uploads to API, etc.
     * Returns result with success status and output URL/path.
     */
    execute(
        projection: unknown,
        config: Record<string, unknown>
    ): Promise<ExportResult>;
}

// ============================================================================
// TARGET REGISTRY
// ============================================================================

/**
 * Target registry for dynamic lookup.
 */
export interface ExportTargetRegistry {
    /**
     * Get target by ID.
     * Throws if target not found.
     */
    getTarget(targetId: string): ExportTarget;

    /**
     * List all available targets.
     */
    listTargets(): ExportTarget[];

    /**
     * Register a new target.
     */
    registerTarget(target: ExportTarget): void;
}

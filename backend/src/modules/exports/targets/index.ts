/**
 * Export Target Registry
 *
 * Central registry for all export targets.
 * Provides lookup and listing of available targets.
 */

import { BfaRtfTarget } from './bfa-rtf-target.js';
import type { ExportTarget, ExportTargetRegistry } from './export-target.interface.js';
import { GoogleDocsTarget } from './google-docs-target.js';

// ============================================================================
// REGISTRY IMPLEMENTATION
// ============================================================================

class ExportTargetRegistryImpl implements ExportTargetRegistry {
    private targets: Map<string, ExportTarget> = new Map();

    constructor() {
        // Register built-in targets
        this.registerTarget(new BfaRtfTarget());
        this.registerTarget(new GoogleDocsTarget());
    }

    getTarget(targetId: string): ExportTarget {
        const target = this.targets.get(targetId);
        if (!target) {
            throw new Error(`Export target not found: ${targetId}`);
        }
        return target;
    }

    listTargets(): ExportTarget[] {
        return Array.from(this.targets.values());
    }

    registerTarget(target: ExportTarget): void {
        this.targets.set(target.id, target);
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

const registry = new ExportTargetRegistryImpl();

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get an export target by ID.
 * @throws Error if target not found
 */
export function getExportTarget(targetId: string): ExportTarget {
    return registry.getTarget(targetId);
}

/**
 * List all available export targets.
 */
export function listExportTargets(): ExportTarget[] {
    return registry.listTargets();
}

/**
 * Register a custom export target.
 * Useful for plugins or custom formats.
 */
export function registerExportTarget(target: ExportTarget): void {
    registry.registerTarget(target);
}

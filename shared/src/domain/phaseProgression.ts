/**
 * @autoart/shared - Phase Progression
 *
 * Domain logic for determining phase advancement eligibility.
 *
 * RULE: Phase advancement is never inferred implicitly by UI state.
 * RULE: Backend must enforce this rule for any phase mutation.
 */

import type {
    PhaseProgressionResult,
    MissingField,
    ProjectState,
} from './types';
import { getMissingFields } from './completeness';

// ==================== PHASE PROGRESSION ====================

/**
 * Determines whether a project can advance to the next phase.
 *
 * @param currentPhase - The current phase (0-indexed)
 * @param projectState - The current project state
 * @returns Whether advancement is allowed and any blockers
 */
export function canAdvancePhase(
    currentPhase: number,
    projectState: ProjectState
): PhaseProgressionResult {
    // Get all missing fields
    const allMissing = getMissingFields(projectState);

    // Filter to fields that block this phase
    const blockers = allMissing.filter(
        (field) => field.phase <= currentPhase && field.severity === 'blocking'
    );

    // Warnings are fields that are missing but not blocking
    const warnings = allMissing.filter(
        (field) => field.phase <= currentPhase && field.severity === 'warning'
    );

    return {
        allowed: blockers.length === 0,
        blockers,
        warnings,
    };
}

/**
 * Gets the maximum phase a project can reach given its current state.
 *
 * @param projectState - The current project state
 * @param maxPhases - The total number of phases (default: 5)
 * @returns The maximum reachable phase (0-indexed)
 */
export function getMaxReachablePhase(
    projectState: ProjectState,
    maxPhases: number = 5
): number {
    for (let phase = 0; phase < maxPhases; phase++) {
        const result = canAdvancePhase(phase, { ...projectState, phase });
        if (!result.allowed) {
            return phase;
        }
    }
    return maxPhases - 1;
}

/**
 * Gets a summary of phase readiness.
 *
 * @param projectState - The current project state
 * @param maxPhases - The total number of phases
 * @returns Array of phase readiness info
 */
export function getPhaseReadinessSummary(
    projectState: ProjectState,
    maxPhases: number = 5
): Array<{
    phase: number;
    ready: boolean;
    blockerCount: number;
    warningCount: number;
}> {
    const summary: Array<{
        phase: number;
        ready: boolean;
        blockerCount: number;
        warningCount: number;
    }> = [];

    for (let phase = 0; phase < maxPhases; phase++) {
        const result = canAdvancePhase(phase, { ...projectState, phase });
        summary.push({
            phase,
            ready: result.allowed,
            blockerCount: result.blockers.length,
            warningCount: result.warnings.length,
        });
    }

    return summary;
}

/**
 * Gets all blockers for a specific phase.
 *
 * @param phase - The phase to check (0-indexed)
 * @param projectState - The current project state
 * @returns Array of blocking missing fields
 */
export function getPhaseBlockers(
    phase: number,
    projectState: ProjectState
): MissingField[] {
    const allMissing = getMissingFields({ ...projectState, phase });
    return allMissing.filter(
        (field) => field.phase <= phase && field.severity === 'blocking'
    );
}

/**
 * Validates a phase transition.
 *
 * @param fromPhase - The current phase
 * @param toPhase - The target phase
 * @param projectState - The current project state
 * @returns Validation result
 */
export function validatePhaseTransition(
    fromPhase: number,
    toPhase: number,
    projectState: ProjectState
): { valid: boolean; reason?: string; blockers?: MissingField[] } {
    // Can always go backward
    if (toPhase < fromPhase) {
        return { valid: true };
    }

    // Can only advance one phase at a time
    if (toPhase > fromPhase + 1) {
        return {
            valid: false,
            reason: 'Can only advance one phase at a time',
        };
    }

    // Check if current phase requirements are met
    const result = canAdvancePhase(fromPhase, projectState);

    if (!result.allowed) {
        return {
            valid: false,
            reason: `Missing ${result.blockers.length} required field(s) for phase ${fromPhase + 1}`,
            blockers: result.blockers,
        };
    }

    return { valid: true };
}

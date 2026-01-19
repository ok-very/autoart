/**
 * Runner Module Types
 * 
 * Types for runner invocation via AutoHelper.
 */

// =============================================================================
// RUNNER TYPES
// =============================================================================

export type RunnerId = 'autocollector';

export interface RunnerConfig {
    source_path: string;
    template?: string;
    [key: string]: unknown;
}

export interface RunnerInvokeRequest {
    runner_id: RunnerId;
    config: RunnerConfig;
    output_folder: string;
    context_id?: string;
    gemini_api_key?: string; // Ephemeral, not persisted
}

// =============================================================================
// PROGRESS & RESULTS
// =============================================================================

export interface RunnerProgress {
    stage: string;
    message: string;
    percent?: number;
}

export interface ArtifactRef {
    ref_id: string;
    path: string;
    artifact_type: string;
    mime_type?: string;
}

export interface RunnerResult {
    success: boolean;
    artifacts: ArtifactRef[];
    error?: string;
    duration_ms?: number;
}

export interface RunnerStatus {
    active: boolean;
    current_runner?: RunnerId;
    progress?: RunnerProgress;
}

// =============================================================================
// REVIEW TYPES
// =============================================================================

export type ReviewType = 'grammar' | 'structure' | 'full';

export interface ReviewRequest {
    artifact_path: string;
    review_type: ReviewType;
    context_id?: string;
    gemini_api_key?: string; // Ephemeral, not persisted
}

export interface PatchSuggestion {
    id: string;
    category: string;
    severity: 'info' | 'warning' | 'error';
    original_text?: string;
    suggested_text?: string;
    explanation: string;
}

export interface ReviewResult {
    success: boolean;
    patches: PatchSuggestion[];
    summary?: string;
    error?: string;
}

export interface ApplyPatchesRequest {
    artifact_path: string;
    patch_ids: string[];
    context_id?: string;
}

export interface ApplyPatchesResult {
    success: boolean;
    applied_count: number;
    output_path?: string;
    error?: string;
}

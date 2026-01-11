/**
 * Action/Event Hooks - Action/Event architecture primitives
 * 
 * This category includes hooks for:
 * - Actions (intent declarations)
 * - Action Views (materialized projections)
 * - Action References
 * - Composer (task builder)
 * - Project Log (event stream)
 * - Workflow Surface (materialized DAG)
 * - Workflow operations (event emission helpers)
 */

// Re-export from parent directory (hooks will be moved here)
export * from '../actions';
export * from '../actionViews';
export * from '../actionReferences';
export * from '../composer';
export * from '../projectLog';
export * from '../workflowSurface';

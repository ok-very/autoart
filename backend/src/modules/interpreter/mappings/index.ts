/**
 * Mapping Rules Index
 *
 * This module provides the mapping rules for interpreting CSV data
 * into domain events using InterpretationOutput variants.
 *
 * Design: Pure functions - no database logic, fully testable.
 *
 * Rule Families (11):
 * - intent: Action hints (request, prepare, coordinate) + catch-all patterns
 * - artwork: Artwork lifecycle (initiated/selected/designed/fabricated/installed)
 * - permit: Permits + milestone achievements (PPAP/DPAP/SP/Install)
 * - stage: Stage/phase transitions (12 BFA canonical phases)
 * - decision: Milestones, approvals, selections
 * - meeting: Meeting scheduling/held
 * - process: Process initiation/completion
 * - document: Document prep/submission
 * - communication: Requests, submissions, follow-ups
 * - budget: Budget allocations (artwork budget, total budget, phase allocations)
 * - invoice: Invoices, contracts, payments
 */

// Type exports
export type { MappingRule, MappingContext, InterpretationOutput } from './types.js';
export { applyMappingRules, extractDateFromContext } from './types.js';

// Rule exports by family
export { artworkMappingRules } from './artwork-rules.js';
export { budgetMappingRules } from './budget-rules.js';
export { meetingMappingRules } from './meeting-rules.js';
export { communicationMappingRules } from './communication-rules.js';
export { documentMappingRules } from './document-rules.js';
export { decisionMappingRules } from './decision-rules.js';
export { invoiceMappingRules } from './invoice-rules.js';
export { permitMappingRules } from './permit-rules.js';
export { processMappingRules } from './process-rules.js';
export { stageMappingRules } from './stage-rules.js';
export { intentMappingRules } from './intent-mapping-rules.js';
// Legacy alias for backward compatibility
export { intentMappingRules as taskMappingRules } from './intent-mapping-rules.js';

// Combined default rules
import { artworkMappingRules } from './artwork-rules.js';
import { budgetMappingRules } from './budget-rules.js';
import { communicationMappingRules } from './communication-rules.js';
import { decisionMappingRules } from './decision-rules.js';
import { documentMappingRules } from './document-rules.js';
import { intentMappingRules } from './intent-mapping-rules.js';
import { invoiceMappingRules } from './invoice-rules.js';
import { meetingMappingRules } from './meeting-rules.js';
import { permitMappingRules } from './permit-rules.js';
import { processMappingRules } from './process-rules.js';
import { stageMappingRules } from './stage-rules.js';
import type { MappingRule } from './types.js';

/**
 * All mapping rules combined and sorted by priority.
 * Higher priority rules are applied first.
 *
 * Spread order determines tiebreaker for equal-priority terminal rules:
 * intent > artwork > permit > stage > decision > meeting > process > document > communication > budget > invoice
 */
export const defaultMappingRules: MappingRule[] = [
    ...intentMappingRules,        // Highest priority - action_hint rules are terminal
    ...artworkMappingRules,       // Artwork lifecycle (initiated/selected/designed/fabricated/installed)
    ...permitMappingRules,        // Permits + milestone achievements (PPAP/DPAP/SP/Install)
    ...stageMappingRules,         // Stage transitions (12 BFA canonical phases)
    ...decisionMappingRules,      // Milestones, approvals
    ...meetingMappingRules,       // Meeting scheduling/held
    ...processMappingRules,       // Process initiation/completion
    ...documentMappingRules,      // Document prep/submission
    ...communicationMappingRules, // Requests, submissions, follow-ups
    ...budgetMappingRules,        // Budget allocations (lower priority - context-dependent)
    ...invoiceMappingRules,       // Invoices, contracts
].sort((a, b) => (b.priority || 0) - (a.priority || 0));

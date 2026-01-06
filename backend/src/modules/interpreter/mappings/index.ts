/**
 * Mapping Rules Index
 *
 * This module provides the mapping rules for interpreting CSV data
 * into domain events using InterpretationOutput variants.
 *
 * Design: Pure functions - no database logic, fully testable.
 * 
 * Rule Families:
 * - decision: Milestones, approvals, selections
 * - meeting: Meeting scheduling/held
 * - process: Process initiation/completion
 * - document: Document prep/submission
 * - communication: Requests, submissions, follow-ups
 * - invoice: Invoices, contracts, payments
 * - intent: Action hints (request, prepare, coordinate) + catch-all patterns
 */

// Type exports
export type { MappingRule, MappingContext, InterpretationOutput } from './types.js';
export { applyMappingRules, extractDateFromContext } from './types.js';

// Rule exports by family
export { meetingMappingRules } from './meeting-rules.js';
export { communicationMappingRules } from './communication-rules.js';
export { documentMappingRules } from './document-rules.js';
export { decisionMappingRules } from './decision-rules.js';
export { invoiceMappingRules } from './invoice-rules.js';
export { processMappingRules } from './process-rules.js';
export { intentMappingRules } from './intent-mapping-rules.js';
// Legacy alias for backward compatibility
export { intentMappingRules as taskMappingRules } from './intent-mapping-rules.js';

// Combined default rules
import { meetingMappingRules } from './meeting-rules.js';
import { communicationMappingRules } from './communication-rules.js';
import { documentMappingRules } from './document-rules.js';
import { decisionMappingRules } from './decision-rules.js';
import { invoiceMappingRules } from './invoice-rules.js';
import { processMappingRules } from './process-rules.js';
import { intentMappingRules } from './intent-mapping-rules.js';
import type { MappingRule } from './types.js';

/**
 * All mapping rules combined and sorted by priority.
 * Higher priority rules are applied first.
 * 
 * Priority order:
 * 1. Intent rules (action_hint) - highest priority, terminal
 * 2. Decision rules (milestones, approvals)
 * 3. Meeting rules
 * 4. Process rules
 * 5. Document rules
 * 6. Communication rules
 * 7. Invoice rules
 */
export const defaultMappingRules: MappingRule[] = [
    ...intentMappingRules,      // Highest priority - action_hint rules are terminal
    ...decisionMappingRules,    // Milestones, approvals
    ...meetingMappingRules,     // Meeting scheduling/held
    ...processMappingRules,     // Process initiation/completion
    ...documentMappingRules,    // Document prep/submission
    ...communicationMappingRules, // Requests, submissions, follow-ups
    ...invoiceMappingRules,     // Invoices, contracts
].sort((a, b) => (b.priority || 0) - (a.priority || 0));

/**
 * Mapping Rules Index
 *
 * This module provides the mapping rules for interpreting CSV data
 * into domain events using the 7 canonical fact families.
 *
 * Design: Pure functions - no database logic, fully testable.
 */

// Type exports
export type { MappingRule, MappingContext, MappingOutput } from './types.js';
export { applyMappingRules, extractDateFromContext } from './types.js';

// Rule exports by family
export { meetingMappingRules } from './meeting-rules.js';
export { communicationMappingRules } from './communication-rules.js';
export { documentMappingRules } from './document-rules.js';
export { decisionMappingRules } from './decision-rules.js';
export { invoiceMappingRules } from './invoice-rules.js';
export { processMappingRules } from './process-rules.js';

// Combined default rules
import { meetingMappingRules } from './meeting-rules.js';
import { communicationMappingRules } from './communication-rules.js';
import { documentMappingRules } from './document-rules.js';
import { decisionMappingRules } from './decision-rules.js';
import { invoiceMappingRules } from './invoice-rules.js';
import { processMappingRules } from './process-rules.js';
import type { MappingRule } from './types.js';

/**
 * All mapping rules combined and sorted by priority.
 * Higher priority rules are applied first.
 */
export const defaultMappingRules: MappingRule[] = [
    ...decisionMappingRules,    // Highest priority (milestones, approvals)
    ...meetingMappingRules,     // Meeting scheduling/held
    ...processMappingRules,     // Process initiation/completion
    ...documentMappingRules,    // Document prep/submission
    ...communicationMappingRules, // Requests, submissions, follow-ups
    ...invoiceMappingRules,     // Invoices, contracts
].sort((a, b) => (b.priority || 0) - (a.priority || 0));

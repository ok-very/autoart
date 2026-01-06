/**
 * Mapping Rules Index
 *
 * This module provides the mapping rules for interpreting CSV data
 * into domain events. Each mapping rule defines a pattern to match
 * and the events to emit when matched.
 *
 * Design: Pure functions - no database logic, fully testable.
 */

export type { MappingRule, MappingContext, MappingOutput } from './types.js';
export { applyMappingRules, extractDateFromContext } from './types.js';
export { meetingMappingRules } from './meeting-rules.js';
export { processMappingRules } from './process-rules.js';
export { invoiceMappingRules } from './invoice-rules.js';

// Combined default rules
import { meetingMappingRules } from './meeting-rules.js';
import { processMappingRules } from './process-rules.js';
import { invoiceMappingRules } from './invoice-rules.js';
import type { MappingRule } from './types.js';

export const defaultMappingRules: MappingRule[] = [
    ...meetingMappingRules,
    ...processMappingRules,
    ...invoiceMappingRules,
];

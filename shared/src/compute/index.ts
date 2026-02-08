/**
 * @autoart/shared — Compute Module
 *
 * Formula evaluation, rollup aggregation, currency helpers, and cycle detection.
 * Used by both backend (computed-fields.service) and frontend (display).
 */

export {
  evaluateFormula,
  extractReferences,
  isFormula,
  formatFormulaDisplay,
  buildFormulaData,
  formatCurrency,
  parseCurrencyInput,
  detectCycles,
  type FormulaValue,
  type CurrencyValue,
  type JsonLogicRule,
} from './formula-engine.js';

export {
  computeRollup,
  type AggregationType,
  type RollupResult,
} from './rollup-engine.js';

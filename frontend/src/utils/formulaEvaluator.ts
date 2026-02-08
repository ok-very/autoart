/**
 * Formula Evaluator — Re-exports from @autoart/shared compute module
 *
 * This file now delegates to the shared formula engine for consistency
 * between frontend and backend evaluation.
 */

export {
  evaluateFormula,
  extractReferences,
  isFormula,
  formatFormulaDisplay,
  buildFormulaData,
  type FormulaValue,
  type JsonLogicRule,
} from '@autoart/shared';

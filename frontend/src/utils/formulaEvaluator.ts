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
  createRecordResolver,
  type ReferenceResolver,
  type FormulaValue,
} from '@autoart/shared';

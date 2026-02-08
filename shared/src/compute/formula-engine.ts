/**
 * Formula Engine — Shared compute module (JsonLogic)
 *
 * Evaluates JsonLogic rules against record data.
 * Currency-aware: all currency arithmetic uses integer minor units (cents).
 * Includes cycle detection for computed field dependency graphs.
 */

import jsonLogic from 'json-logic-js';
import type { JsonLogicRule } from './json-logic.js';

export type { JsonLogicRule } from './json-logic.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Formula evaluation result.
 */
export interface FormulaValue {
  rule: JsonLogicRule;
  resolvedValue: number | null;
  references: string[];
  error?: string;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Evaluate a JsonLogic rule against a data object.
 *
 * @param rule - JsonLogic rule (e.g., { "*": [{ "var": "qty" }, { "var": "unit_price" }] })
 * @param data - Flat record data object with resolved values
 */
export function evaluateFormula(
  rule: JsonLogicRule,
  data: Record<string, unknown>,
): FormulaValue {
  const refs = extractReferences(rule);
  const result: FormulaValue = {
    rule,
    resolvedValue: null,
    references: refs,
  };

  if (rule === null || rule === undefined) {
    return result;
  }

  try {
    const prepared = buildFormulaData(data);
    // Ensure all referenced variables exist in prepared data (default to 0).
    // json-logic-js returns null for missing vars, which causes NaN in arithmetic.
    for (const ref of refs) {
      if (!(ref in prepared)) {
        prepared[ref] = 0;
      }
    }
    const value = jsonLogic.apply(rule, prepared);

    if (typeof value === 'number' && isFinite(value)) {
      result.resolvedValue = value;
    } else if (typeof value === 'number') {
      // Infinity / NaN from division by zero etc.
      result.error = 'Non-finite result';
    } else {
      result.error = `Non-numeric result: ${typeof value}`;
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Evaluation error';
  }

  return result;
}

/**
 * Extract all variable references from a JsonLogic rule.
 * Walks the JSON tree looking for { "var": "..." } nodes.
 */
export function extractReferences(rule: JsonLogicRule): string[] {
  const refs = new Set<string>();

  function walk(node: JsonLogicRule): void {
    if (node === null || node === undefined || typeof node !== 'object') return;

    // Check if this is a { "var": "..." } node
    if ('var' in node) {
      const varRef = (node as { var: unknown }).var;
      if (typeof varRef === 'string' && varRef.length > 0) {
        refs.add(varRef);
      }
      return;
    }

    // Recurse into operator arguments
    for (const key of Object.keys(node)) {
      const val = (node as Record<string, unknown>)[key];
      if (Array.isArray(val)) {
        for (const item of val) {
          walk(item as JsonLogicRule);
        }
      } else if (typeof val === 'object' && val !== null) {
        walk(val as JsonLogicRule);
      }
    }
  }

  walk(rule);
  return Array.from(refs);
}

/**
 * Build a flat data object for formula evaluation.
 * Flattens currency objects ({ amount, currency }) to their numeric amount.
 * Converts string numbers to numbers. Nulls become 0 for safe arithmetic.
 */
export function buildFormulaData(
  data: Record<string, unknown>,
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      result[key] = 0;
      continue;
    }

    // Currency field: { amount: number, currency: string }
    if (typeof value === 'object' && 'amount' in value) {
      const amt = (value as { amount: unknown }).amount;
      if (typeof amt === 'number') {
        result[key] = amt;
      } else if (typeof amt === 'string') {
        const n = Number(amt);
        result[key] = isNaN(n) ? 0 : n;
      } else {
        result[key] = 0;
      }
      continue;
    }

    if (typeof value === 'number') {
      result[key] = value;
      continue;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      result[key] = isNaN(parsed) ? 0 : parsed;
      continue;
    }

    // Non-numeric types default to 0
    result[key] = 0;
  }

  return result;
}

/**
 * Check if a value looks like a JsonLogic rule.
 */
export function isFormula(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;
  // A JsonLogic rule is an object with operator keys
  const keys = Object.keys(value as object);
  return keys.length > 0;
}

/**
 * Format a computed numeric value for display.
 */
export function formatFormulaDisplay(formulaValue: FormulaValue): string {
  if (formulaValue.error) {
    return `Error: ${formulaValue.error}`;
  }
  if (formulaValue.resolvedValue !== null) {
    const num = formulaValue.resolvedValue;
    if (Number.isInteger(num)) {
      return num.toLocaleString();
    }
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return '';
}

// ============================================================================
// CURRENCY HELPERS
// ============================================================================

/**
 * Currency value stored as integer minor units (cents).
 * Avoids IEEE 754 float issues. Same approach as Stripe.
 */
export interface CurrencyValue {
  /** Amount in minor units (cents). 15000 = $150.00 */
  amount: number;
  /** ISO 4217 currency code */
  currency: string;
}

/**
 * Format a currency value for display.
 * Converts integer cents to formatted string.
 */
export function formatCurrency(value: CurrencyValue, locale?: string): string {
  const major = value.amount / 100;
  return new Intl.NumberFormat(locale ?? 'en-CA', {
    style: 'currency',
    currency: value.currency,
  }).format(major);
}

/**
 * Parse a display string into minor units.
 * "150.00" → 15000, "1,234.56" → 123456
 */
export function parseCurrencyInput(input: string): number {
  const cleaned = input.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

// ============================================================================
// CYCLE DETECTION
// ============================================================================

/**
 * Detect circular dependencies in a set of computed field formulas.
 * Returns the set of field keys involved in cycles (empty if none).
 *
 * @param fieldFormulas - Map of field key → JsonLogic rule
 */
export function detectCycles(fieldFormulas: Map<string, JsonLogicRule>): Set<string> {
  const graph = new Map<string, string[]>();

  for (const [key, rule] of fieldFormulas) {
    graph.set(key, extractReferences(rule));
  }

  const cycleNodes = new Set<string>();
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string): boolean {
    if (inStack.has(node)) {
      cycleNodes.add(node);
      return true;
    }
    if (visited.has(node)) return false;

    visited.add(node);
    inStack.add(node);

    const deps = graph.get(node) ?? [];
    for (const dep of deps) {
      if (dfs(dep)) {
        cycleNodes.add(node);
      }
    }

    inStack.delete(node);
    return false;
  }

  for (const key of graph.keys()) {
    dfs(key);
  }

  return cycleNodes;
}

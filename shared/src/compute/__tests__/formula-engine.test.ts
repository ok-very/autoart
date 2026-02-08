import { describe, it, expect } from 'vitest';
import {
  evaluateFormula,
  extractReferences,
  buildFormulaData,
  detectCycles,
  isFormula,
  formatFormulaDisplay,
} from '../formula-engine.js';
import type { JsonLogicRule } from '../json-logic.js';

describe('evaluateFormula', () => {
  it('evaluates line_total: qty * unit_price', () => {
    const rule: JsonLogicRule = { '*': [{ var: 'qty' }, { var: 'unit_price' }] };
    const data = { qty: 5, unit_price: 10000 }; // 5 × $100.00 in cents
    const result = evaluateFormula(rule, data);
    expect(result.resolvedValue).toBe(50000);
    expect(result.error).toBeUndefined();
  });

  it('evaluates line_tax: line_total * vat_rate / 100', () => {
    const rule: JsonLogicRule = { '/': [{ '*': [{ var: 'line_total' }, { var: 'vat_rate' }] }, 100] };
    const data = { line_total: 50000, vat_rate: 13 };
    const result = evaluateFormula(rule, data);
    expect(result.resolvedValue).toBe(6500);
  });

  it('evaluates total: subtotal + tax_total', () => {
    const rule: JsonLogicRule = { '+': [{ var: 'subtotal' }, { var: 'tax_total' }] };
    const data = { subtotal: 150000, tax_total: 19500 };
    const result = evaluateFormula(rule, data);
    expect(result.resolvedValue).toBe(169500);
  });

  it('evaluates remaining: allocated - spent', () => {
    const rule: JsonLogicRule = { '-': [{ var: 'allocated_amount' }, { var: 'spent_amount' }] };
    const data = { allocated_amount: 500000, spent_amount: 120000 };
    const result = evaluateFormula(rule, data);
    expect(result.resolvedValue).toBe(380000);
  });

  it('returns null for null rule', () => {
    const result = evaluateFormula(null, {});
    expect(result.resolvedValue).toBeNull();
  });

  it('handles missing variables (default to 0)', () => {
    const rule: JsonLogicRule = { '+': [{ var: 'a' }, { var: 'b' }] };
    const result = evaluateFormula(rule, { a: 100 });
    expect(result.resolvedValue).toBe(100); // b defaults to 0
  });

  it('reports error for division by zero producing Infinity', () => {
    const rule: JsonLogicRule = { '/': [{ var: 'a' }, { var: 'b' }] };
    const result = evaluateFormula(rule, { a: 100, b: 0 });
    expect(result.error).toBeDefined();
    expect(result.resolvedValue).toBeNull();
  });
});

describe('extractReferences', () => {
  it('extracts vars from nested rule', () => {
    const rule: JsonLogicRule = { '/': [{ '*': [{ var: 'line_total' }, { var: 'vat_rate' }] }, 100] };
    const refs = extractReferences(rule);
    expect(refs).toContain('line_total');
    expect(refs).toContain('vat_rate');
    expect(refs).toHaveLength(2);
  });

  it('returns empty for null rule', () => {
    expect(extractReferences(null)).toEqual([]);
  });

  it('returns empty for primitive rule', () => {
    expect(extractReferences(42)).toEqual([]);
  });

  it('deduplicates repeated vars', () => {
    const rule: JsonLogicRule = { '+': [{ var: 'x' }, { var: 'x' }] };
    expect(extractReferences(rule)).toEqual(['x']);
  });
});

describe('buildFormulaData', () => {
  it('passes through plain numbers', () => {
    expect(buildFormulaData({ qty: 5 })).toEqual({ qty: 5 });
  });

  it('flattens currency objects to amount', () => {
    const data = { unit_price: { amount: 10000, currency: 'CAD' } };
    expect(buildFormulaData(data)).toEqual({ unit_price: 10000 });
  });

  it('converts string numbers', () => {
    expect(buildFormulaData({ x: '42.5' })).toEqual({ x: 42.5 });
  });

  it('converts null/undefined to 0', () => {
    expect(buildFormulaData({ x: null, y: undefined })).toEqual({ x: 0, y: 0 });
  });

  it('converts non-numeric strings to 0', () => {
    expect(buildFormulaData({ x: 'hello' })).toEqual({ x: 0 });
  });
});

describe('detectCycles', () => {
  it('detects A → B → A cycle', () => {
    const formulas = new Map<string, JsonLogicRule>([
      ['a', { '+': [{ var: 'b' }, 1] }],
      ['b', { '+': [{ var: 'a' }, 1] }],
    ]);
    const cycles = detectCycles(formulas);
    expect(cycles.size).toBeGreaterThan(0);
    expect(cycles.has('a')).toBe(true);
    expect(cycles.has('b')).toBe(true);
  });

  it('passes acyclic graph', () => {
    const formulas = new Map<string, JsonLogicRule>([
      ['total', { '+': [{ var: 'subtotal' }, { var: 'tax' }] }],
      ['subtotal', { '*': [{ var: 'qty' }, { var: 'price' }] }],
    ]);
    const cycles = detectCycles(formulas);
    expect(cycles.size).toBe(0);
  });
});

describe('isFormula', () => {
  it('returns true for JsonLogic objects', () => {
    expect(isFormula({ '+': [1, 2] })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isFormula(null)).toBe(false);
  });

  it('returns false for strings', () => {
    expect(isFormula('hello')).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isFormula({})).toBe(false);
  });
});

describe('formatFormulaDisplay', () => {
  it('formats integer result', () => {
    const fv = { rule: null, resolvedValue: 50000, references: [] };
    expect(formatFormulaDisplay(fv)).toBe('50,000');
  });

  it('formats decimal result', () => {
    const fv = { rule: null, resolvedValue: 123.456, references: [] };
    expect(formatFormulaDisplay(fv)).toMatch(/123/);
  });

  it('shows error', () => {
    const fv = { rule: null, resolvedValue: null, references: [], error: 'Bad' };
    expect(formatFormulaDisplay(fv)).toBe('Error: Bad');
  });
});

describe('Invoice rollup chain (end-to-end formula resolution)', () => {
  // Simulates the full computed-fields resolution chain without a database.
  // This mirrors what computed-fields.service.ts does: rollups first, then formulas in dependency order.

  const lineItems = [
    { qty: 5, unit_price: 10000, vat_rate: 13 },   // $100/unit × 5 = $500, tax = $65
    { qty: 2, unit_price: 25000, vat_rate: 13 },   // $250/unit × 2 = $500, tax = $65
    { qty: 1, unit_price: 50000, vat_rate: 0 },    // $500/unit × 1 = $500, tax = $0
  ];

  const payments = [
    { amount: 50000 },  // $500
    { amount: 30000 },  // $300
  ];

  // Step 1: Compute line item formulas
  const lineTotal = (item: typeof lineItems[0]) =>
    evaluateFormula({ '*': [{ var: 'qty' }, { var: 'unit_price' }] }, item).resolvedValue!;

  const lineTax = (item: typeof lineItems[0], lt: number) =>
    evaluateFormula(
      { '/': [{ '*': [{ var: 'line_total' }, { var: 'vat_rate' }] }, 100] },
      { ...item, line_total: lt },
    ).resolvedValue!;

  it('computes line totals correctly', () => {
    expect(lineTotal(lineItems[0])).toBe(50000);
    expect(lineTotal(lineItems[1])).toBe(50000);
    expect(lineTotal(lineItems[2])).toBe(50000);
  });

  it('computes line taxes correctly', () => {
    expect(lineTax(lineItems[0], 50000)).toBe(6500);
    expect(lineTax(lineItems[1], 50000)).toBe(6500);
    expect(lineTax(lineItems[2], 50000)).toBe(0);
  });

  it('computes full invoice chain: subtotal → tax_total → total → paid_amount → balance_due', () => {
    // Simulate rollup aggregation (sum of line totals and line taxes)
    const computedLineTotals = lineItems.map((item) => lineTotal(item));
    const computedLineTaxes = lineItems.map((item, i) => lineTax(item, computedLineTotals[i]));

    const subtotal = computedLineTotals.reduce((a, b) => a + b, 0);
    const taxTotal = computedLineTaxes.reduce((a, b) => a + b, 0);

    expect(subtotal).toBe(150000);  // $1,500
    expect(taxTotal).toBe(13000);   // $130

    // Compute invoice total: subtotal + tax_total
    const totalResult = evaluateFormula(
      { '+': [{ var: 'subtotal' }, { var: 'tax_total' }] },
      { subtotal, tax_total: taxTotal },
    );
    expect(totalResult.resolvedValue).toBe(163000);  // $1,630

    // Simulate payment rollup
    const paidAmount = payments.reduce((a, p) => a + p.amount, 0);
    expect(paidAmount).toBe(80000);  // $800

    // Compute balance_due: total - paid_amount
    const balanceResult = evaluateFormula(
      { '-': [{ var: 'total' }, { var: 'paid_amount' }] },
      { total: totalResult.resolvedValue, paid_amount: paidAmount },
    );
    expect(balanceResult.resolvedValue).toBe(83000);  // $830
  });
});

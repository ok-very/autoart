import { describe, it, expect } from 'vitest';
import { computeRollup } from '../rollup-engine.js';

describe('computeRollup', () => {
  const records = [
    { amount: 100, qty: 2 },
    { amount: 200, qty: 3 },
    { amount: 300, qty: 5 },
  ];

  it('sums numeric values', () => {
    const result = computeRollup(records, 'amount', 'sum');
    expect(result.value).toBe(600);
    expect(result.count).toBe(3);
  });

  it('counts records', () => {
    const result = computeRollup(records, 'amount', 'count');
    expect(result.value).toBe(3);
  });

  it('finds min', () => {
    const result = computeRollup(records, 'amount', 'min');
    expect(result.value).toBe(100);
  });

  it('finds max', () => {
    const result = computeRollup(records, 'amount', 'max');
    expect(result.value).toBe(300);
  });

  it('computes average', () => {
    const result = computeRollup(records, 'amount', 'avg');
    expect(result.value).toBe(200);
  });

  it('handles empty records — sum returns 0', () => {
    const result = computeRollup([], 'amount', 'sum');
    expect(result.value).toBe(0);
    expect(result.count).toBe(0);
  });

  it('handles empty records — min returns null', () => {
    const result = computeRollup([], 'amount', 'min');
    expect(result.value).toBeNull();
  });

  it('handles currency objects', () => {
    const currencyRecords = [
      { amount: { amount: 10000, currency: 'CAD' } },
      { amount: { amount: 20000, currency: 'CAD' } },
    ];
    const result = computeRollup(currencyRecords, 'amount', 'sum');
    expect(result.value).toBe(30000);
  });

  it('skips null values in aggregation', () => {
    const mixedRecords = [
      { amount: 100 },
      { amount: null },
      { amount: 300 },
    ];
    const result = computeRollup(mixedRecords, 'amount', 'sum');
    expect(result.value).toBe(400);
    expect(result.count).toBe(2);
  });
});

import { describe, expect, it } from 'vitest';
import { computePriorityScore, CONFIRMATIONS_WEIGHT, SEVERITY_WEIGHT } from '../../src/algorithms/priority.js';

describe('SEVERITY_WEIGHT', () => {
  it('ranks CRITICAL above HIGH above MEDIUM above LOW', () => {
    expect(SEVERITY_WEIGHT.CRITICAL).toBeGreaterThan(SEVERITY_WEIGHT.HIGH);
    expect(SEVERITY_WEIGHT.HIGH).toBeGreaterThan(SEVERITY_WEIGHT.MEDIUM);
    expect(SEVERITY_WEIGHT.MEDIUM).toBeGreaterThan(SEVERITY_WEIGHT.LOW);
  });
});

describe('computePriorityScore(severity, confirmations, ageDays, traffic)', () => {
  it('equals the severity weight for a fresh, single, quiet report', () => {
    expect(computePriorityScore('LOW', 0, 0, 0)).toBe(SEVERITY_WEIGHT.LOW);
    expect(computePriorityScore('CRITICAL', 0, 0, 0)).toBe(40);
  });

  it('adds the confirmation bonus per citizen confirmation', () => {
    const base = computePriorityScore('MEDIUM', 0, 0, 0);
    const confirmed = computePriorityScore('MEDIUM', 2, 0, 0);
    expect(confirmed - base).toBe(2 * CONFIRMATIONS_WEIGHT);
  });

  it('caps how many confirmations contribute', () => {
    expect(computePriorityScore('LOW', 4, 0, 0)).toBe(10 + 4 * CONFIRMATIONS_WEIGHT);
    expect(computePriorityScore('LOW', 20, 0, 0)).toBe(10 + 4 * CONFIRMATIONS_WEIGHT);
  });

  it('clamps age to [0, 20] and rounds', () => {
    expect(computePriorityScore('LOW', 0, 25, 0)).toBe(10 + 20); // clamp high
    expect(computePriorityScore('LOW', 0, -3, 0)).toBe(10 + 0); // clamp low
    expect(computePriorityScore('LOW', 0, 1.6, 0)).toBe(10 + 2); // rounds up
  });

  it('clamps traffic to [0, 10] and rounds', () => {
    expect(computePriorityScore('LOW', 0, 0, 15)).toBe(10 + 10); // clamp high
    expect(computePriorityScore('LOW', 0, 0, -2)).toBe(10 + 0); // clamp low
    expect(computePriorityScore('LOW', 0, 0, 3.4)).toBe(10 + 3); // rounds down
  });

  it('caps at the theoretical maximum', () => {
    expect(computePriorityScore('CRITICAL', 4, 100, 100)).toBe(40 + 4 * CONFIRMATIONS_WEIGHT + 20 + 10);
  });

  it('is monotone — more urgent inputs never lower the score', () => {
    expect(computePriorityScore('HIGH', 0, 0, 0)).toBeGreaterThanOrEqual(computePriorityScore('MEDIUM', 0, 0, 0));
    expect(computePriorityScore('MEDIUM', 1, 0, 0)).toBeGreaterThan(computePriorityScore('MEDIUM', 0, 0, 0));
  });
});

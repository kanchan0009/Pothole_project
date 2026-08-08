import { describe, expect, it } from 'vitest';
import { DUPLICATE_RADIUS_M, OPEN_STATUSES } from '../../src/algorithms/duplicate.js';

describe('DUPLICATE_RADIUS_M', () => {
  it('flags open reports within 20 m', () => {
    expect(DUPLICATE_RADIUS_M).toBe(20);
  });
});

describe('OPEN_STATUSES', () => {
  it('includes every in-flight status', () => {
    expect(OPEN_STATUSES).toEqual(['PENDING', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS']);
  });

  it('excludes terminal statuses', () => {
    expect(OPEN_STATUSES).not.toContain('COMPLETED');
    expect(OPEN_STATUSES).not.toContain('REJECTED');
  });
});

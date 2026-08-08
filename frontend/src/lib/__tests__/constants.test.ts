import { describe, expect, it } from 'vitest';
import {
  DUPLICATE_RADIUS_M,
  REJECT_REASONS,
  SEVERITY_META,
  SEVERITY_ORDER,
  SEVERITY_WEIGHT,
  STATUS_META,
  STATUS_ORDER,
} from '../constants';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const MARKERS = ['yellow', 'blue', 'purple', 'orange', 'green', 'gray'] as const;

describe('STATUS_META', () => {
  it('covers every status with label, hex color, marker and tone', () => {
    expect(STATUS_ORDER).toHaveLength(6);
    for (const status of STATUS_ORDER) {
      const meta = STATUS_META[status];
      expect(meta.label).toBeTruthy();
      expect(meta.color).toMatch(HEX);
      expect(MARKERS).toContain(meta.marker);
      expect(meta.tone).toBeTruthy();
    }
  });

  it('labels the statuses with the spec wording', () => {
    expect(STATUS_META.PENDING.label).toBe('Pending Verification');
    expect(STATUS_META.IN_PROGRESS.label).toBe('In Progress');
    expect(STATUS_META.COMPLETED.label).toBe('Completed');
    expect(STATUS_META.REJECTED.label).toBe('Rejected');
  });
});

describe('SEVERITY_META', () => {
  it('covers every severity with label and hex color', () => {
    expect(SEVERITY_ORDER).toHaveLength(4);
    for (const severity of SEVERITY_ORDER) {
      expect(SEVERITY_META[severity].label).toBeTruthy();
      expect(SEVERITY_META[severity].color).toMatch(HEX);
    }
  });
});

describe('SEVERITY_WEIGHT', () => {
  it('increases with severity (matches the backend priority weights)', () => {
    expect(SEVERITY_WEIGHT.LOW).toBeLessThan(SEVERITY_WEIGHT.MEDIUM);
    expect(SEVERITY_WEIGHT.MEDIUM).toBeLessThan(SEVERITY_WEIGHT.HIGH);
    expect(SEVERITY_WEIGHT.HIGH).toBeLessThan(SEVERITY_WEIGHT.CRITICAL);
  });
});

describe('DUPLICATE_RADIUS_M', () => {
  it('is 20 meters per the spec', () => {
    expect(DUPLICATE_RADIUS_M).toBe(20);
  });
});

describe('REJECT_REASONS', () => {
  it('offers the spec preset rejection reasons', () => {
    expect(REJECT_REASONS).toEqual([
      'Duplicate report',
      'Invalid image',
      'Incorrect location',
      'Not a pothole',
      'Low quality image',
      'Other',
    ]);
  });
});

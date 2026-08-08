import { describe, expect, it } from 'vitest';
import { formatCoords, formatDate, formatDateTime, formatHours, formatTime, timeAgo } from '../format';

/** Build an ISO string from LOCAL parts so wall-clock assertions hold in any timezone. */
function iso(y: number, m: number, d: number, hh = 0, mm = 0): string {
  return new Date(y, m - 1, d, hh, mm).toISOString();
}

describe('formatDateTime', () => {
  it('renders "d Mon yyyy, hh:mm"', () => {
    expect(formatDateTime(iso(2026, 8, 6, 14, 30))).toBe('6 Aug 2026, 14:30');
  });
});

describe('formatDate', () => {
  it('renders "d Mon yyyy"', () => {
    expect(formatDate(iso(2026, 8, 6))).toBe('6 Aug 2026');
  });
});

describe('formatTime', () => {
  it('zero-pads hours and minutes', () => {
    expect(formatTime(iso(2026, 8, 6, 9, 5))).toBe('09:05');
  });
});

describe('timeAgo', () => {
  const now = Date.now();
  const mins = 60_000;
  const hours = 3_600_000;
  const days = 86_400_000;

  it('labels the last minute "just now"', () => {
    expect(timeAgo(new Date(now - 30_000).toISOString())).toBe('just now');
  });

  it('renders minutes, hours and days', () => {
    expect(timeAgo(new Date(now - 5 * mins).toISOString())).toBe('5m ago');
    expect(timeAgo(new Date(now - 2 * hours).toISOString())).toBe('2h ago');
    expect(timeAgo(new Date(now - 3 * days).toISOString())).toBe('3d ago');
  });
});

describe('formatHours', () => {
  it('handles missing values', () => {
    expect(formatHours(null)).toBe('—');
    expect(formatHours(undefined)).toBe('—');
  });

  it('renders hours under two days', () => {
    expect(formatHours(0)).toBe('0h');
    expect(formatHours(40)).toBe('40h');
  });

  it('renders days + remainder', () => {
    expect(formatHours(50)).toBe('2d 2h');
    expect(formatHours(62.5)).toBe('2d 15h');
    expect(formatHours(48)).toBe('2d');
    expect(formatHours(72)).toBe('3d');
  });
});

describe('formatCoords', () => {
  it('formats to four decimal places', () => {
    expect(formatCoords(27.7172, 85.324)).toBe('27.7172, 85.3240');
  });

  it('returns a dash when a coordinate is missing', () => {
    expect(formatCoords(null, 85.324)).toBe('—');
    expect(formatCoords(27.7172, null)).toBe('—');
    expect(formatCoords(undefined, undefined)).toBe('—');
  });
});

import { describe, expect, it } from 'vitest';
import { boundingBox, haversineDistance } from '../../src/algorithms/geo.js';

describe('haversineDistance', () => {
  it('returns zero for identical coordinates', () => {
    expect(haversineDistance(27.7172, 85.324, 27.7172, 85.324)).toBe(0);
  });

  it('measures roughly 111 km per degree of latitude', () => {
    // One degree of latitude is ~111.2 km regardless of longitude.
    const d = haversineDistance(27.7172, 85.324, 28.7172, 85.324);
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_500);
  });

  it('measures roughly 111 km per degree of longitude at the equator', () => {
    const d = haversineDistance(0, 0, 0, 1);
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_500);
  });

  it('is symmetric', () => {
    const a = haversineDistance(27.7, 85.3, 27.72, 85.35);
    const b = haversineDistance(27.72, 85.35, 27.7, 85.3);
    expect(a).toBeCloseTo(b, 6);
  });

  it('stays small for points a few metres apart', () => {
    // ~0.0001° of longitude at Kathmandu's latitude is roughly 10 m.
    const d = haversineDistance(27.7172, 85.324, 27.7172, 85.3241);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(20);
  });
});

describe('boundingBox', () => {
  it('is centred on the given point', () => {
    const box = boundingBox(27.7, 85.3, 1000);
    expect(box.minLat).toBeLessThan(27.7);
    expect(box.maxLat).toBeGreaterThan(27.7);
    expect(box.minLng).toBeLessThan(85.3);
    expect(box.maxLng).toBeGreaterThan(85.3);
  });

  it('spans 2 * radius / 111320 degrees of latitude', () => {
    const radius = 5000;
    const box = boundingBox(27.7, 85.3, radius);
    expect(box.maxLat - box.minLat).toBeCloseTo((2 * radius) / 111_320, 6);
  });

  it('widens the longitude span near the poles (cosine clamp)', () => {
    const nearEquator = boundingBox(0, 0, 1000);
    const farNorth = boundingBox(89.9, 0, 1000); // cos(89.9°) is clamped up to 0.01
    const equatorSpan = nearEquator.maxLng - nearEquator.minLng;
    const poleSpan = farNorth.maxLng - farNorth.minLng;
    expect(poleSpan).toBeGreaterThan(equatorSpan);
  });
});

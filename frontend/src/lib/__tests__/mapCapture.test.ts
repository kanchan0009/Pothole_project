import { describe, expect, it } from 'vitest';
import { haversineDistance, nearbyFilter } from '../mapCapture';
import { mergePlaces, searchLocalPlaces } from '../mapPlaces';

// Kathmandu → Patan is ~4.7 km as the crow flies.
const KATHMANDU = { lat: 27.7172, lng: 85.324 };
const PATAN = { lat: 27.6747, lng: 85.3247 };

describe('haversineDistance', () => {
  it('returns ~4.7 km between Kathmandu and Patan', () => {
    const d = haversineDistance(KATHMANDU.lat, KATHMANDU.lng, PATAN.lat, PATAN.lng);
    expect(d).toBeGreaterThan(4000);
    expect(d).toBeLessThan(5500);
  });

  it('returns ~0 for identical points', () => {
    expect(haversineDistance(KATHMANDU.lat, KATHMANDU.lng, KATHMANDU.lat, KATHMANDU.lng)).toBeLessThan(0.01);
  });
});

describe('nearbyFilter', () => {
  const reports = [
    { id: 1, latitude: KATHMANDU.lat, longitude: KATHMANDU.lng }, // ~0 m
    { id: 2, latitude: PATAN.lat, longitude: PATAN.lng }, // ~4.7 km
    { id: 3, latitude: null, longitude: null }, // no coordinates
  ];

  it('keeps only reports within the radius and drops coordinate-less rows', () => {
    expect(nearbyFilter(reports, KATHMANDU, 2500).map((r) => r.id)).toEqual([1]);
    expect(nearbyFilter(reports, KATHMANDU, 6000).map((r) => r.id)).toEqual([1, 2]);
  });
});

describe('searchLocalPlaces', () => {
  it('matches curated places by name', () => {
    expect(searchLocalPlaces('koteshwor')[0]?.label).toBe('Koteshwor');
    expect(searchLocalPlaces('bhaktapur')[0]?.label).toBe('Bhaktapur');
    expect(searchLocalPlaces('Kirtipur')[0]?.label).toBe('Kirtipur');
  });

  it('returns nothing for an unknown query', () => {
    expect(searchLocalPlaces('zzzz')).toEqual([]);
    expect(searchLocalPlaces('')).toEqual([]);
  });
});

describe('mergePlaces', () => {
  const local = [
    { id: 'local-a', label: 'Kathmandu', sublabel: 'Kathmandu District', lat: 27.7, lng: 85.32, source: 'local' as const },
    { id: 'local-b', label: 'Patan', sublabel: 'Lalitpur District', lat: 27.67, lng: 85.32, source: 'local' as const },
  ];
  const remote = [
    { id: 'nom-1', label: 'Kathmandu', sublabel: 'Kathmandu, Bagmati, Nepal', lat: 27.71, lng: 85.32, source: 'nominatim' as const },
    { id: 'nom-2', label: 'Bhaktapur', sublabel: 'Bhaktapur, Bagmati, Nepal', lat: 27.67, lng: 85.43, source: 'nominatim' as const },
  ];

  it('dedupes by label and keeps the curated result first', () => {
    const merged = mergePlaces(local, remote);
    expect(merged.map((p) => p.label)).toEqual(['Kathmandu', 'Patan', 'Bhaktapur']);
    expect(merged[0].source).toBe('local');
  });

  it('caps the result list', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `x-${i}`,
      label: `Place ${i}`,
      sublabel: '',
      lat: 27.7,
      lng: 85.3,
      source: 'local' as const,
    }));
    expect(mergePlaces(many, [], 5)).toHaveLength(5);
  });
});

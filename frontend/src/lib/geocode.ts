export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface ReverseGeocodeResult {
  address?: string;
  roadName?: string;
  municipality?: string;
  ward?: string;
  landmark?: string;
}


export function getCurrentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => reject(new Error('Could not get your location. Pick it on the map instead.')),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 }
    );
  });
}


export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      display_name?: string;
      address?: {
        road?: string;
        path?: string;
        pedestrian?: string;
        city?: string;
        town?: string;
        municipality?: string;
        village?: string;
        county?: string;
        state_district?: string;
        city_district?: string;
        suburb?: string;
        neighbourhood?: string;
        postcode?: string;
        amenity?: string;
      };
    };
    const a = data.address ?? {};
    return {
      address: data.display_name,
      roadName: a.road || a.path || a.pedestrian || '',
      municipality: a.city || a.town || a.municipality || a.village || a.county || a.state_district || '',
      ward: a.city_district || a.suburb || a.neighbourhood || a.postcode || '',
      landmark: a.amenity || a.neighbourhood || '',
    };
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

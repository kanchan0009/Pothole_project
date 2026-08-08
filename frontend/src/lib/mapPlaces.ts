/**
 * Place search for the map page.
 *
 * Suggestions come from two sources:
 *  1. A curated list of well-known Kathmandu-valley locations (instant, offline).
 *  2. OpenStreetMap's public Nominatim geocoder for anything else (debounced
 *     by the caller, silently ignored on failure).
 *
 * Results are normalized into {@link PlaceSuggestion} so the SearchBar can
 * render and select them uniformly.
 */

export interface PlaceSuggestion {
  /** Stable key for React lists / dedupe. */
  id: string;
  /** Primary label (place name). */
  label: string;
  /** Secondary context (district / full address). */
  sublabel: string;
  lat: number;
  lng: number;
  source: "local" | "nominatim";
}

export interface CuratedPlace {
  name: string;
  district: string;
  lat: number;
  lng: number;
}

/** Curated Kathmandu-valley locations with approximate centroids. */
export const KATHMANDU_PLACES: CuratedPlace[] = [
  { name: "Kathmandu", district: "Kathmandu", lat: 27.7172, lng: 85.324 },
  {
    name: "Patan (Lalitpur)",
    district: "Lalitpur",
    lat: 27.6747,
    lng: 85.3247,
  },
  { name: "Bhaktapur", district: "Bhaktapur", lat: 27.671, lng: 85.4297 },
  { name: "Kalanki", district: "Kathmandu", lat: 27.6995, lng: 85.275 },
  { name: "Koteshwor", district: "Kathmandu", lat: 27.671, lng: 85.345 },
  { name: "Thamel", district: "Kathmandu", lat: 27.7157, lng: 85.312 },
  { name: "Boudha", district: "Kathmandu", lat: 27.7215, lng: 85.3617 },
  { name: "Pashupatinath", district: "Kathmandu", lat: 27.7109, lng: 85.348 },
  { name: "Swayambhu", district: "Kathmandu", lat: 27.715, lng: 85.29 },
  { name: "Ratnapark", district: "Kathmandu", lat: 27.705, lng: 85.316 },
  { name: "Balaju", district: "Kathmandu", lat: 27.7297, lng: 85.299 },
  { name: "Gongabu", district: "Kathmandu", lat: 27.732, lng: 85.31 },
  { name: "Maharajgunj", district: "Kathmandu", lat: 27.7165, lng: 85.335 },
  { name: "Baluwatar", district: "Kathmandu", lat: 27.724, lng: 85.322 },
  { name: "Sanepa", district: "Lalitpur", lat: 27.6802, lng: 85.3095 },
  { name: "Jawalakhel", district: "Lalitpur", lat: 27.671, lng: 85.317 },
  { name: "Pulchowk", district: "Lalitpur", lat: 27.6766, lng: 85.316 },
  { name: "Lagankhel", district: "Lalitpur", lat: 27.674, lng: 85.324 },
  { name: "Gwarko", district: "Lalitpur", lat: 27.673, lng: 85.346 },
  { name: "Chabahil", district: "Kathmandu", lat: 27.718, lng: 85.34 },
  { name: "Baneshwor", district: "Kathmandu", lat: 27.698, lng: 85.337 },
  { name: "Sinamangal", district: "Kathmandu", lat: 27.695, lng: 85.345 },
  { name: "Teku", district: "Kathmandu", lat: 27.705, lng: 85.307 },
  { name: "Budhanilkantha", district: "Kathmandu", lat: 27.775, lng: 85.36 },
  { name: "Kirtipur", district: "Kathmandu", lat: 27.6655, lng: 85.2777 },
  { name: "Chovar", district: "Kathmandu", lat: 27.6652, lng: 85.2851 },
  { name: "Thimi", district: "Bhaktapur", lat: 27.687, lng: 85.39 },
  { name: "Suryabinayak", district: "Bhaktapur", lat: 27.6644, lng: 85.4278 },
  { name: "Nagarkot", district: "Bhaktapur", lat: 27.715, lng: 85.52 },
  { name: "Lubhu", district: "Lalitpur", lat: 27.648, lng: 85.347 },
];

export function toSuggestion(p: CuratedPlace): PlaceSuggestion {
  return {
    id: `local-${p.name.toLowerCase().replace(/\s+/g, "-")}`,
    label: p.name,
    sublabel: `${p.district} District`,
    lat: p.lat,
    lng: p.lng,
    source: "local",
  };
}

/** Sync match against the curated list — prefix matches rank first. */
export function searchLocalPlaces(query: string): PlaceSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: Array<{ s: PlaceSuggestion; score: number }> = [];
  for (const p of KATHMANDU_PLACES) {
    const name = p.name.toLowerCase();
    const district = p.district.toLowerCase();
    let score = -1;
    if (name.startsWith(q)) score = 0;
    else if (name.includes(q)) score = 1;
    else if (district.includes(q)) score = 2;
    if (score >= 0) scored.push({ s: toSuggestion(p), score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.s.label.localeCompare(b.s.label))
    .map((x) => x.s);
}

/**
 * Async geocode via Nominatim (Nepal only). Resolves to [] on any failure so
 * the search UI never hard-fails. Pass an AbortController signal to cancel
 * in-flight requests when the user keeps typing.
 */
export async function searchRemotePlaces(
  query: string,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=np&limit=8&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      display_name?: string;
      lat: string;
      lon: string;
      address?: Record<string, string>;
      type?: string;
      class?: string;
    }>;

    return data
      .filter((d) => d.display_name)
      .map((d, i) => {
        const addr = d.address ?? {};
        const roadLabel =
          addr.road ||
          addr.path ||
          addr.pedestrian ||
          addr.cycleway ||
          addr.footway ||
          addr.residential ||
          addr.street ||
          d.display_name!.split(",")[0];
        const locality =
          addr.suburb ||
          addr.neighbourhood ||
          addr.city_district ||
          addr.village ||
          addr.town ||
          addr.city ||
          addr.county ||
          addr.state_district ||
          addr.municipality ||
          addr.postcode ||
          "";
        const sublabelParts: string[] = [];
        if (locality) sublabelParts.push(locality);
        if (addr.city || addr.county)
          sublabelParts.push(addr.city || addr.county);
        if (d.type) sublabelParts.push(d.type);
        return {
          id: `nom-${i}-${d.display_name}`,
          label: roadLabel,
          sublabel:
            sublabelParts.filter(Boolean).join(" · ") || d.display_name!,
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon),
          source: "nominatim" as const,
        };
      });
  } catch {
    return [];
  }
}

/**
 * Merges local + remote suggestions, deduping by place name, keeping curated
 * results first. Caps the list for the dropdown.
 */
export function mergePlaces(
  local: PlaceSuggestion[],
  remote: PlaceSuggestion[],
  max = 8,
): PlaceSuggestion[] {
  const seen = new Set<string>();
  const out: PlaceSuggestion[] = [];
  for (const s of [...local, ...remote]) {
    const key = `${s.label.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

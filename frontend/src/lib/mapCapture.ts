import html2canvas from 'html2canvas';
import { reverseGeocode, type ReverseGeocodeResult } from './geocode';
import type { MapCaptureDraft } from '../types';

/** Selection box in CSS pixels relative to the map wrapper. */
export interface BoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MapCaptureResult {
  /** PNG file ready to attach to the report form. */
  file: File;
  /** Persistable data URL of the same image (survives a redirect / refresh). */
  previewUrl: string;
  /** Center of the captured region (lat/lng). */
  latitude: number;
  longitude: number;
  address: ReverseGeocodeResult;
  timestamp: string;
}

/**
 * Renders the Leaflet DOM to a canvas with html2canvas, crops it to the
 * selection box, draws a dashed border around the captured region, and returns
 * the cropped image plus the region's center coordinates.
 *
 * `mapNode` must be the element that wraps ONLY the map (not the overlay UI),
 * so the search bar / selection box / camera button never appear in the shot.
 * `centerToLatLng` converts a container pixel point (the box centre) to lat/lng
 * using the live Leaflet map instance.
 */
export async function captureMapArea(
  mapNode: HTMLElement,
  rect: BoxRect,
  centerToLatLng: (point: { x: number; y: number }) => { lat: number; lng: number } | null
): Promise<MapCaptureResult> {
  const scale = Math.min(2, window.devicePixelRatio || 1);
  const canvas = await html2canvas(mapNode, {
    useCORS: true,
    scale,
    backgroundColor: null,
    logging: false,
  });

  // Crop rect, clamped to the canvas bounds.
  const cw = canvas.width;
  const ch = canvas.height;
  const x = Math.max(0, Math.min(cw - 1, Math.round(rect.x * scale)));
  const y = Math.max(0, Math.min(ch - 1, Math.round(rect.y * scale)));
  const w = Math.max(1, Math.min(cw - x, Math.round(rect.width * scale)));
  const h = Math.max(1, Math.min(ch - y, Math.round(rect.height * scale)));

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser');
  ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);

  // Dashed accent border so the shot visibly matches the selected box.
  const line = Math.max(2, Math.round(3 * scale));
  ctx.strokeStyle = '#00B4D8';
  ctx.lineWidth = line;
  ctx.setLineDash([line * 3, line * 3]);
  ctx.strokeRect(line / 2, line / 2, w - line, h - line);

  const file = await canvasToPngFile(out);
  const previewUrl = await fileToDataURL(file);
  const center = centerToLatLng({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
  let address: ReverseGeocodeResult = {};
  if (center) {
    try {
      address = await reverseGeocode(center.lat, center.lng);
    } catch {
      /* manual entry is the fallback on the report form */
    }
  }
  return {
    file,
    previewUrl,
    latitude: center?.lat ?? 0,
    longitude: center?.lng ?? 0,
    address,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Geo helpers
// ---------------------------------------------------------------------------

const EARTH_RADIUS_M = 6371000;

/** Haversine distance between two points, in metres. */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Reports within `radiusM` metres of `center`. */
export function nearbyFilter<T extends { latitude?: number | null; longitude?: number | null }>(
  reports: T[],
  center: { lat: number; lng: number },
  radiusM: number
): T[] {
  return reports.filter((r) => {
    if (r.latitude == null || r.longitude == null) return false;
    return haversineDistance(center.lat, center.lng, r.latitude, r.longitude) <= radiusM;
  });
}

// ---------------------------------------------------------------------------
// Draft persistence
// ---------------------------------------------------------------------------

/** sessionStorage key the map page uses to hand the capture to /report. */
export const MAP_CAPTURE_STORAGE_KEY = 'rg_map_capture';

export function saveMapCaptureDraft(draft: MapCaptureDraft): void {
  try {
    sessionStorage.setItem(MAP_CAPTURE_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* quota exceeded — the immediate navigation still works */
  }
}

export function readMapCaptureDraft(): MapCaptureDraft | null {
  try {
    const raw = sessionStorage.getItem(MAP_CAPTURE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MapCaptureDraft;
  } catch {
    return null;
  }
}

export function clearMapCaptureDraft(): void {
  sessionStorage.removeItem(MAP_CAPTURE_STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Blob / data-URL conversion
// ---------------------------------------------------------------------------

function canvasToPngFile(canvas: HTMLCanvasElement): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(new File([blob], 'map-capture.png', { type: 'image/png' })) : reject(new Error('Could not encode the map screenshot'))),
      'image/png'
    );
  });
}

export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image'));
    reader.readAsDataURL(file);
  });
}

export async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || 'image/png' });
}

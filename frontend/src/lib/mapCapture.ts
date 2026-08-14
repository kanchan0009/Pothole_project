import html2canvas from 'html2canvas';
import { reverseGeocode, type ReverseGeocodeResult } from './geocode';
import type { MapCaptureDraft } from '../types';


export interface BoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MapCaptureResult {
  
  file: File;
  
  previewUrl: string;
  
  latitude: number;
  longitude: number;
  address: ReverseGeocodeResult;
  timestamp: string;
}


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





const EARTH_RADIUS_M = 6371000;


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






export const MAP_CAPTURE_STORAGE_KEY = 'rg_map_capture';

export function saveMapCaptureDraft(draft: MapCaptureDraft): void {
  try {
    sessionStorage.setItem(MAP_CAPTURE_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    
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

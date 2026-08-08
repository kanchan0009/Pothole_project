/** Small, dependency-free formatting helpers shared across dashboards. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ISO string → "12 Aug 2026, 14:30". */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ISO string → "12 Aug 2026". */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** ISO string → "14:30" (time only). */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Relative time ("2h ago", "3d ago") — for activity feeds. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

/** Hours → human label ("62.5h" or "2d 14h"). */
export function formatHours(hours: number | null | undefined): string {
  if (hours == null) return '—';
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  return rem ? `${days}d ${rem}h` : `${days}d`;
}

/** Coordinates → "27.7172, 85.3240". */
export function formatCoords(lat?: number | null, lng?: number | null): string {
  if (lat == null || lng == null) return '—';
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

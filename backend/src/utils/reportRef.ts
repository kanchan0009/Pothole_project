/** Human-facing reference code, e.g. RG-000041. Mirrors the frontend receipt lib. */
export function reportRef(id: number): string {
  return `RG-${String(id).padStart(6, '0')}`;
}

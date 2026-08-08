/** Receipt reference formatter — `RG-<zero-padded id>`, mirroring the backend. */
export function reportRef(id: number): string {
  return `RG-${String(id).padStart(6, '0')}`;
}

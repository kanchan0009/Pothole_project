
export function reportRef(id: number): string {
  return `RG-${String(id).padStart(6, '0')}`;
}

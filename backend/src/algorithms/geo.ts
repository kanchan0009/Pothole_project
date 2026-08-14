
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const R = 6_371_000; 
  return 2 * R * Math.asin(Math.sqrt(a));
}


export function boundingBox(lat: number, lng: number, radiusM: number) {
  const latDeg = radiusM / 111_320;
  const lngDeg = radiusM / (111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return {
    minLat: lat - latDeg,
    maxLat: lat + latDeg,
    minLng: lng - lngDeg,
    maxLng: lng + lngDeg,
  };
}

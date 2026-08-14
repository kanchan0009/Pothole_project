import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';

type HeatPoint = [number, number, number];


function HeatLayer({ points }: { points: HeatPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const layer = L.heatLayer(points, {
      radius: 24,
      blur: 16,
      maxZoom: 17,
      minOpacity: 0.4,
      
      gradient: {
        0.2: '#48CAE4',
        0.4: '#00B4D8',
        0.6: '#FFA500',
        0.8: '#DC3545',
        1.0: '#9D174D',
      },
    });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points]);

  return null;
}


export function Heatmap({ points }: { points: HeatPoint[] }) {
  if (!points.length) {
    return (
      <div className="grid h-72 w-full place-items-center rounded-xl border border-dashed border-primary/20 text-sm text-primary/50">
        No geolocated reports yet
      </div>
    );
  }

  const center: [number, number] = [points[0][0], points[0][1]];
  return (
    <div className="h-72 w-full overflow-hidden rounded-xl border border-primary/10">
      <MapContainer center={center} zoom={11} scrollWheelZoom={false} className="z-0 h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <HeatLayer points={points} />
      </MapContainer>
    </div>
  );
}

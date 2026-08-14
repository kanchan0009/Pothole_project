import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LatLng } from '../../lib/geocode';


const DEFAULT_CENTER: [number, number] = [27.7172, 85.324];


const pinIcon = L.divIcon({
  className: 'rg-map-pin',
  html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#DC3545;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.45);"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

function ClickHandler({ onPick }: { onPick: (ll: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    },
  });
  return null;
}

function Recenter({ position }: { position: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo([position.latitude, position.longitude], 16, { duration: 0.6 });
    }
  }, [position, map]);
  return null;
}

export function LocationPicker({
  value,
  onChange,
}: {
  value: LatLng | null;
  onChange: (ll: LatLng) => void;
}) {
  return (
    <div className="relative h-72 w-full overflow-hidden rounded-xl border border-primary/10">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={13}
        scrollWheelZoom
        className="z-0 h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={onChange} />
        <Recenter position={value} />
        {value && <Marker position={[value.latitude, value.longitude]} icon={pinIcon} />}
      </MapContainer>
      <span className="pointer-events-none absolute bottom-2 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-primary/85 px-3 py-1 text-[11px] font-semibold text-white shadow-card">
        Tap the map to set the exact spot
      </span>
    </div>
  );
}

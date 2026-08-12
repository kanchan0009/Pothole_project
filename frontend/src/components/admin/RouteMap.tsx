import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import type { ReportRoute } from '../../types';
import { Card } from '../ui/Card';

/** Kathmandu valley — default view when there is no route to fit. */
const DEFAULT_CENTER: [number, number] = [27.7172, 85.324];

/** Red dashed pin — the pothole / report. */
const potholeIcon = L.divIcon({
  className: 'rg-map-pin',
  html: '<div style="width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#DC3545;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.45);"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 20],
});

/** Blue crew marker — the maintenance team. */
const teamIcon = L.divIcon({
  className: 'rg-map-team',
  html: '<div style="width:20px;height:20px;border-radius:50%;background:#2563EB;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.45);"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) {
      if (points.length === 1) map.setView(points[0]!, 16);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48] });
  }, [points, map]);
  return null;
}

/**
 * The Dijkstra route from the maintenance crew to the pothole, drawn on a
 * Leaflet map with the road polyline between two markers. Unreachable routes
 * (off-network, no coords, no workers) render a graceful empty state instead.
 */
export function RouteMap({ route }: { route: ReportRoute | null }) {
  const plan = route?.route;

  if (!route || !plan?.reachable || !plan.path || !route.team) {
    const reason =
      plan?.reason === 'no-coordinates'
        ? 'This report has no coordinates to route from.'
        : plan?.reason === 'no-workers'
          ? 'No maintenance workers with coordinates are available.'
          : plan?.reason === 'off-network'
            ? `The report is ${Math.round((plan.offNetworkM ?? 0) / 1000)} km from the nearest mapped road — off the network.`
            : 'No road route could be found on the OSM network.';
    return (
      <div className="grid h-64 place-items-center rounded-xl border border-primary/10 bg-primary/[0.02] p-4 text-center">
        <div>
          <p className="text-sm font-semibold text-primary/70">No route available</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-primary/50">{reason}</p>
        </div>
      </div>
    );
  }

  const path = plan.path;
  const teamPos: [number, number] = [route.team.lat, route.team.lng];
  // The polyline runs team → report, so the report is its last point.
  const reportPos: [number, number] = path[path.length - 1]!;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/5 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-primary">Dijkstra route</p>
          <p className="text-[11px] text-primary/50">
            Team: <span className="font-semibold text-primary">{route.team.name}</span>
            {route.teamSource === 'assigned'
              ? ' (assigned)'
              : route.teamSource === 'selected'
                ? ' (selected worker)'
                : ' (nearest by road)'}
          </p>
        </div>
        <div className="flex items-center gap-3 text-right">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary/40">Distance</p>
            <p className="text-sm font-extrabold text-primary">{plan.distanceKm!.toFixed(2)} km</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary/40">ETA</p>
            <p className="text-sm font-extrabold text-accent">{plan.etaMinutes!.toFixed(1)} min</p>
          </div>
        </div>
      </div>

      <div className="relative h-64 w-full">
        <MapContainer center={DEFAULT_CENTER} zoom={13} scrollWheelZoom className="z-0 h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={[teamPos, ...path, reportPos]} />
          <Marker position={teamPos} icon={teamIcon} />
          <Marker position={reportPos} icon={potholeIcon} />
          <Polyline positions={path} pathOptions={{ color: '#2563EB', weight: 4, opacity: 0.85 }} />
        </MapContainer>
      </div>
    </Card>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Circle, MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import { motion } from 'framer-motion';
import { FaCamera, FaClipboardList, FaMapMarkerAlt, FaTimes, FaUserLock } from 'react-icons/fa';
import { reportsApi } from '../api/reports';
import { useAuth } from '../features/auth/auth-context';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { SkeletonRow } from '../components/ui/Skeleton';
import { Spinner } from '../components/ui/Spinner';
import { useToast } from '../components/ui/Toast';
import { ReportDetailDrawer } from '../components/user/ReportDetailDrawer';
import { SearchBar } from '../components/map/SearchBar';
import { SelectionBox } from '../components/map/SelectionBox';
import { SEVERITY_META, STATUS_META, STATUS_ORDER } from '../lib/constants';
import { formatDate, timeAgo } from '../lib/format';
import { captureMapArea, nearbyFilter, saveMapCaptureDraft, type BoxRect } from '../lib/mapCapture';
import type { PlaceSuggestion } from '../lib/mapPlaces';
import type { MapCaptureDraft, Report, ReportStatus, Severity } from '../types';


const DEFAULT_CENTER: [number, number] = [27.7172, 85.324];
const MAP_LIMIT = 50; 

const NEARBY_RADIUS_M = 2500;


const MAP_STATUS_COLORS: Record<ReportStatus, string> = {
  PENDING: '#FFA500', 
  IN_PROGRESS: '#2563EB', 
  COMPLETED: '#28A745', 
  REJECTED: '#DC3545', 
  VERIFIED: '#00B4D8', 
  ASSIGNED: '#7C3AED', 
  REMOVED: "#DC3545", 
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}


function markerIcon(color: string, selected: boolean): L.DivIcon {
  const size = selected ? 20 : 16;
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid #fff;${
      selected ? `box-shadow:0 0 0 6px ${color}33, 0 2px 10px rgba(11,31,58,.5);` : 'box-shadow:0 2px 8px rgba(11,31,58,.45);'
    }"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}


const focusIcon = L.divIcon({
  className: '',
  html: '<div style="position:relative;width:18px;height:18px;">' +
    '<span style="position:absolute;inset:0;border-radius:50%;background:#00B4D8;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.4);"></span>' +
    '<span style="position:absolute;inset:-7px;border-radius:50%;border:2px solid #00B4D8;animation:rg-map-ping 1.4s ease-out infinite;"></span></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});


function MapController({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap();
  const fired = useRef(false);
  useEffect(() => {
    if (!fired.current) {
      fired.current = true;
      onReady(map);
    }
  }, [map, onReady]);
  return null;
}

function centeredRect(container: { width: number; height: number }, wFrac: number, hFrac: number): BoxRect {
  const width = Math.round(container.width * wFrac);
  const height = Math.round(container.height * hFrac);
  return {
    x: Math.round((container.width - width) / 2),
    y: Math.round((container.height - height) / 2),
    width,
    height,
  };
}


function SeverityChip({ severity }: { severity: Severity }) {
  const meta = SEVERITY_META[severity];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: meta.color }}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
}


function MapStatusBadge({ status }: { status: ReportStatus }) {
  const color = MAP_STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: `${color}1A`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {STATUS_META[status].label}
    </span>
  );
}

function PopupBody({ report, onDetails }: { report: Report; onDetails: (id: number) => void }) {
  return (
    <div className="w-60">
      <img src={report.imageUrl} alt="" className="h-28 w-full rounded-lg object-cover" />
      <p className="mt-2 text-sm font-bold text-primary">{report.title}</p>
      <p className="mt-0.5 truncate text-xs text-primary/50">
        {report.roadName} · {report.municipality} · Ward {report.ward}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <SeverityChip severity={report.severity} />
        <span className="text-[11px] text-primary/40">{formatDate(report.createdAt)}</span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs text-primary/60">{report.description}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <MapStatusBadge status={report.status} />
        <button
          onClick={() => onDetails(report.id)}
          className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-primary-light"
        >
          View details
        </button>
      </div>
    </div>
  );
}

export function PublicMap() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [focus, setFocus] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [box, setBox] = useState<BoxRect | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [container, setContainer] = useState<{ width: number; height: number } | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  
  const focusInitRef = useRef<{ lat: number; lng: number } | null>(null);

  
  const myReports = useQuery({
    queryKey: ['user', 'reports', 'map'],
    queryFn: () => reportsApi.mine({ limit: MAP_LIMIT }),
    enabled: !!user,
  });
  const publicReports = useQuery({
    queryKey: ['map', 'public'],
    queryFn: () => reportsApi.list({ limit: MAP_LIMIT }),
  });

  const allReports = publicReports.data?.reports ?? [];
  const reportsToShow = useMemo(() => {
    if (!focus) return allReports.filter((r) => r.latitude != null && r.longitude != null);
    return nearbyFilter(allReports, { lat: focus.lat, lng: focus.lng }, NEARBY_RADIUS_M);
  }, [allReports, focus]);

  const handleMapReady = useCallback((map: L.Map) => {
    mapInstanceRef.current = map;
    setMapReady(true);
  }, []);

  
  useEffect(() => {
    const node = mapRef.current;
    if (!node) return;
    const update = () => setContainer({ width: node.clientWidth, height: node.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  
  
  useEffect(() => {
    if (!focus || !container) return;
    if (focusInitRef.current?.lat === focus.lat && focusInitRef.current?.lng === focus.lng) return;
    focusInitRef.current = { lat: focus.lat, lng: focus.lng };
    setBox(centeredRect(container, 0.45, 0.5));
  }, [focus, container]);

  
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map && focus) map.flyTo([focus.lat, focus.lng], 15, { duration: 1.2 });
  }, [focus, mapReady]);

  function handleSelectPlace(place: PlaceSuggestion) {
    setFocus({ lat: place.lat, lng: place.lng, label: place.label });
    toast.info(`Showing potholes near ${place.label}`);
  }

  function clearFocus() {
    setFocus(null);
    setBox(null);
    setHighlightId(null);
  }

  function flyToReport(report: Report) {
    if (report.latitude == null || report.longitude == null) return;
    const map = mapInstanceRef.current;
    if (map) map.flyTo([report.latitude, report.longitude], 16, { duration: 1 });
    setHighlightId(report.id);
  }

  
  async function handleCapture() {
    const node = mapRef.current;
    if (!node || !box || !focus) {
      toast.error('Search a location and adjust the capture box first');
      return;
    }
    setCapturing(true);
    try {
      const result = await captureMapArea(node, box, (point) => {
        const map = mapInstanceRef.current;
        if (!map) return null;
        const ll = map.containerPointToLatLng(L.point(point.x, point.y));
        return { lat: ll.lat, lng: ll.lng };
      });
      const draft: MapCaptureDraft = {
        previewUrl: result.previewUrl,
        latitude: result.latitude,
        longitude: result.longitude,
        roadName: result.address.roadName ?? '',
        municipality: result.address.municipality ?? '',
        ward: result.address.ward ?? '',
        address: result.address.address ?? '',
        timestamp: result.timestamp,
      };
      saveMapCaptureDraft(draft);
      toast.success('Map area captured — finish your report');
      navigate('/report');
    } catch (err) {
      console.error('map capture failed', err);
      toast.error('Could not capture the map area. Please try again.');
    } finally {
      setCapturing(false);
    }
  }

  
  
  const cameraPos = useMemo(() => {
    if (!box || !container) return null;
    const gap = 14;
    const below = box.y + box.height + gap;
    const fitsBelow = below + 56 <= container.height;
    const top = fitsBelow ? below : Math.max(8, box.y - 56);
    const left = clamp(box.x + box.width - 48, 8, Math.max(8, container.width - 64));
    return { top, left };
  }, [box, container]);

  const myList = myReports.data?.reports ?? [];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-primary">Hazard map</h1>
          <p className="mt-1 text-sm text-primary/60">
            Search a location, inspect nearby potholes, then capture the area to file a report.
          </p>
        </div>
        {user && (
          <Link
            to="/report"
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-accent-light"
          >
            <FaCamera /> Report a hazard
          </Link>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        {}
        <aside className="order-2 flex max-h-[480px] flex-col gap-4 lg:order-1 lg:max-h-[640px]">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary-light">
              <FaClipboardList className="text-accent" /> My reports
            </h2>
            {user && myReports.data && (
              <span className="rounded-full bg-primary/5 px-2.5 py-1 text-xs font-bold text-primary/60">
                {myReports.data.pagination.total}
              </span>
            )}
          </div>

          <div className="scroll-slim flex-1 space-y-3 overflow-y-auto pr-1">
            {!user ? (
              <LoginPrompt />
            ) : myReports.isLoading && !myReports.data ? (
              <div className="space-y-3">
                <SkeletonRow lines={4} />
              </div>
            ) : myReports.isError ? (
              <ErrorState onRetry={() => void myReports.refetch()} />
            ) : myList.length === 0 ? (
              <EmptyMyReports />
            ) : (
              myList.map((r) => (
                <Card key={r.id} hover className="p-3.5">
                  <div className="flex gap-3">
                    <img src={r.imageUrl} alt="" className="h-16 w-20 shrink-0 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-primary">{r.title}</p>
                      <p className="mt-0.5 truncate text-xs text-primary/50">
                        {r.roadName} · {r.municipality} · Ward {r.ward}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <SeverityChip severity={r.severity} />
                        <span className="text-[11px] text-primary/40">{timeAgo(r.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <MapStatusBadge status={r.status} />
                    <div className="flex items-center gap-2">
                      {r.latitude != null && r.longitude != null && (
                        <Button size="sm" variant="ghost" onClick={() => flyToReport(r)}>
                          <FaMapMarkerAlt /> Show
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setSelectedId(r.id)}>
                        View details
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </aside>

        {}
        <section className="relative order-1 h-[520px] overflow-hidden rounded-card border border-primary/10 bg-primary/5 shadow-card lg:order-2 lg:h-[640px]">
          {}
          <div ref={mapRef} className="absolute inset-0">
            <MapContainer center={DEFAULT_CENTER} zoom={12} scrollWheelZoom zoomControl={false} className="z-0 h-full w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapController onReady={handleMapReady} />
              <ZoomControl position="bottomright" />
              {reportsToShow.map((r) =>
                r.latitude == null || r.longitude == null ? null : (
                  <Marker
                    key={r.id}
                    position={[r.latitude, r.longitude]}
                    icon={markerIcon(MAP_STATUS_COLORS[r.status], r.id === highlightId)}
                    eventHandlers={{ click: () => setHighlightId(r.id) }}
                  >
                    <Popup maxWidth={280}>
                      <PopupBody report={r} onDetails={setSelectedId} />
                    </Popup>
                  </Marker>
                )
              )}
              {focus && (
                <>
                  <Marker position={[focus.lat, focus.lng]} icon={focusIcon} />
                  <Circle
                    center={[focus.lat, focus.lng]}
                    radius={NEARBY_RADIUS_M}
                    pathOptions={{ color: '#00B4D8', weight: 2, dashArray: '6 6', fillColor: '#00B4D8', fillOpacity: 0.06 }}
                  />
                </>
              )}
            </MapContainer>
          </div>

          {}
          <div className="pointer-events-none absolute inset-x-0 top-4 z-40 flex justify-center">
            <div className="pointer-events-auto">
              <SearchBar onSelect={handleSelectPlace} />
            </div>
          </div>

          {}
          {focus && (
            <div className="pointer-events-none absolute left-4 top-4 z-40">
              <div className="flex items-center gap-2 rounded-full bg-primary/85 px-3 py-1.5 text-xs font-bold text-white shadow-card backdrop-blur">
                <FaMapMarkerAlt className="text-accent" />
                {publicReports.isFetching
                  ? 'Locating…'
                  : `${reportsToShow.length} pothole${reportsToShow.length === 1 ? '' : 's'} nearby`}
                <button onClick={clearFocus} aria-label="Clear location" className="pointer-events-auto text-white/70 transition hover:text-white">
                  <FaTimes />
                </button>
              </div>
            </div>
          )}

          {}
          {focus && !publicReports.isFetching && reportsToShow.length === 0 && (
            <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
              <div className="rounded-xl bg-white/95 px-5 py-3 text-center shadow-card">
                <p className="text-sm font-bold text-primary">No potholes in this area</p>
                <p className="mt-0.5 text-xs text-primary/50">Capture the area to be the first to report one.</p>
              </div>
            </div>
          )}

          {}
          <div className="pointer-events-none absolute bottom-4 left-4 z-40 rounded-xl bg-white/95 p-3 shadow-card">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-primary/50">Status</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {STATUS_ORDER.map((s) => (
                <span key={s} className="flex items-center gap-1.5 text-[11px] font-semibold text-primary/70">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: MAP_STATUS_COLORS[s] }} />
                  {STATUS_META[s].label}
                </span>
              ))}
            </div>
          </div>

          {}
          {focus && box && container && (
            <div className="pointer-events-none absolute inset-0 z-30">
              <SelectionBox rect={box} container={container} onChange={setBox} />
            </div>
          )}

          {}
          {cameraPos && focus && (
            <button
              onClick={() => void handleCapture()}
              disabled={capturing}
              aria-label="Capture selected map area"
              title="Capture this area and report a pothole"
              className="absolute z-50 grid h-12 w-12 place-items-center rounded-full bg-accent text-white shadow-card-hover transition hover:bg-accent-light disabled:opacity-70"
              style={{ left: cameraPos.left, top: cameraPos.top }}
            >
              {capturing ? <Spinner size="sm" className="!border-white/30 !border-t-white" /> : <FaCamera className="text-lg" />}
            </button>
          )}

          {}
          {capturing && (
            <div className="absolute inset-0 z-[60] grid place-items-center bg-primary/30 backdrop-blur-[2px]">
              <div className="flex items-center gap-3 rounded-xl bg-white px-5 py-3 shadow-card-hover">
                <Spinner size="sm" /> <span className="text-sm font-bold text-primary">Capturing map area…</span>
              </div>
            </div>
          )}
        </section>
      </div>

      <ReportDetailDrawer reportId={selectedId} onClose={() => setSelectedId(null)} />
    </motion.div>
  );
}

function LoginPrompt() {
  return (
    <Card className="p-6 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent">
        <FaUserLock className="text-xl" />
      </div>
      <h3 className="mt-4 text-sm font-bold text-primary">See your reports</h3>
      <p className="mt-1 text-xs text-primary/50">
        Log in to view the potholes you've reported and follow their repair progress.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <Link to="/login" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-light">
          Log in
        </Link>
        <Link to="/register" className="rounded-lg border border-primary/15 px-4 py-2 text-sm font-semibold text-primary/70 transition hover:border-accent hover:text-accent">
          Create an account
        </Link>
      </div>
    </Card>
  );
}

function EmptyMyReports() {
  return (
    <Card className="p-6 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/5 text-primary/30">
        <FaClipboardList className="text-xl" />
      </div>
      <h3 className="mt-4 text-sm font-bold text-primary">No reports yet</h3>
      <p className="mt-1 text-xs text-primary/50">
        Search a location on the map and capture the pothole to file your first report.
      </p>
      <Link
        to="/report"
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-accent-light"
      >
        <FaCamera /> Report a hazard
      </Link>
    </Card>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="p-6 text-center">
      <p className="text-sm font-semibold text-danger">Couldn't load your reports</p>
      <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>
        Try again
      </Button>
    </Card>
  );
}

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  FaCamera,
  FaCheckCircle,
  FaDownload,
  FaExclamationTriangle,
  FaMapMarkerAlt,
  FaRobot,
  FaRoute,
  FaTrash,
} from "react-icons/fa";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Ruler, Footprints, Sun, RefreshCcw } from "lucide-react";
import { reportsApi, type NearbyReport } from "../../api/reports";
import { LocationPicker } from "../../components/map/LocationPicker";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field, Select, TextArea, TextInput } from "../../components/ui/Field";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import {
  getCurrentPosition,
  reverseGeocode,
  type LatLng,
} from "../../lib/geocode";
import {
  clearMapCaptureDraft,
  dataUrlToFile,
  readMapCaptureDraft,
} from "../../lib/mapCapture";
import { reportRef } from "../../lib/receipt";
import { SEVERITY_META, STATUS_META } from "../../lib/constants";
import {
  canvasToJpegFile,
  MAX_PHOTO_BYTES,
  normalizePhotoFile,
  PHOTO_ACCEPT,
} from "../../lib/photoFile";
import type { DetectionResult, MapCaptureDraft, Report } from "../../types";

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "Title must be at least 5 characters")
    .max(120, "Title is too long"),
  description: z
    .string()
    .trim()
    .min(10, "Please describe the hazard in a little more detail")
    .max(2000, "Description is too long"),
  roadName: z.string().trim().min(2, "Road name is required").max(120),
  municipality: z.string().trim().min(2, "Municipality is required").max(80),
  ward: z.string().trim().min(1, "Ward is required").max(20),
  landmark: z.string().trim().max(120).optional().or(z.literal("")),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
});

type FormValues = z.infer<typeof schema>;

const SEVERITY_OPTIONS: Array<{
  value: FormValues["severity"];
  label: string;
}> = [
    { value: "LOW", label: "Low — minor surface damage" },
    { value: "MEDIUM", label: "Medium — noticeable pothole" },
    { value: "HIGH", label: "High — large, risky pothole" },
    { value: "CRITICAL", label: "Critical — hazard / blocks traffic" },
  ];

export function NewReport() {
  const toast = useToast();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { severity: "MEDIUM", landmark: "" },
  });

  const [photo, setPhoto] = useState<File | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateWarn, setDuplicateWarn] = useState<NearbyReport | null>(null);
  const [created, setCreated] = useState<Report | null>(null);
  const [confirmRemoveSuccess, setConfirmRemoveSuccess] = useState(false);
  const [removingSuccess, setRemovingSuccess] = useState(false);
  /** 'map' when the report photo/location came from the map page's capture. */
  const [source, setSource] = useState<"manual" | "map">("manual");

  // Autocomplete (typeahead) state for road/place search
  const [roadQuery, setRoadQuery] = useState<string>(
    getValues("roadName") ?? "",
  );
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimerRef = useRef<number | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  const [overrideAi, setOverrideAi] = useState(false);
  /** Ignores stale /api/reports/detect responses when the photo changes quickly (e.g. camera after upload). */
  const detectSeqRef = useRef(0);

  // Consume a capture handed over by the map page. Stored in sessionStorage so
  // it survives a login redirect; cleared once applied;
  useEffect(() => {
    const draft = readMapCaptureDraft();
    if (!draft) return;
    clearMapCaptureDraft();
    void applyMapDraft(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPhotoFile(file: File) {
    const normalized = normalizePhotoFile(file);
    if (!normalized) {
      toast.error("Only JPG, PNG or WEBP photos are supported");
      return;
    }
    if (normalized.size > MAX_PHOTO_BYTES) {
      toast.error("Photo must be 5 MB or smaller");
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    detectSeqRef.current += 1;
    setDetection(null);
    setDetectError(null);
    setOverrideAi(false);
    setPhoto(normalized);
    setPhotoPreview(URL.createObjectURL(normalized));
    setSource("manual");
    void runDetection(normalized);
  }

  function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    applyPhotoFile(file);
  }

  function capturePhoto() {
    void startCamera();
  }

  function uploadPhoto() {
    uploadInputRef.current?.click();
  }

  /** Opens the device camera for a live preview (preferred on mobile + desktop). */
  async function startCamera() {
    setCameraError(null);
    detectSeqRef.current += 1;
    setDetection(null);
    setDetectError(null);
    setDetecting(false);
    setOverrideAi(false);

    if (!window.isSecureContext) {
      setCameraError(
        "Camera access requires HTTPS. Use Upload image instead, or open the site via https:// or localhost.",
      );
      cameraInputRef.current?.click();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Live camera is not supported here — opening your device camera app instead.");
      cameraInputRef.current?.click();
      return;
    }

    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      setCameraStream(stream);
    } catch (err) {
      const denied =
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
      setCameraError(
        denied
          ? "Camera permission denied. Allow camera access in your browser, or upload a photo instead."
          : "Could not open the camera. Trying your device camera app instead.",
      );
      cameraInputRef.current?.click();
    }
  }

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview(null);
    setDetection(null);
    setDetectError(null);
    setOverrideAi(false);
    stopCamera();
  }

  async function takeSnapshot() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      toast.error("Camera is still starting — wait a moment and try again");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();
    const file = await canvasToJpegFile(canvas);
    if (!file) {
      toast.error("Could not save the camera photo — try again or upload instead");
      return;
    }
    applyPhotoFile(file);
  }

  function stopCamera() {
    setCameraStream((current) => {
      current?.getTracks().forEach((track) => track.stop());
      return null;
    });
  }

  // Pipe the MediaStream into the <video> element once the preview mounts.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !cameraStream) return;
    video.srcObject = cameraStream;
    void video.play().catch(() => {
      setCameraError("Could not start the camera preview.");
    });
    return () => {
      video.srcObject = null;
    };
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  /** Pre-fills the form from a map-page capture — the user only adds details. */
  async function applyMapDraft(draft: MapCaptureDraft) {
    try {
      const file = await dataUrlToFile(draft.previewUrl, "map-capture.png");
      setPhoto(file);
      setPhotoPreview(draft.previewUrl);
    } catch {
      setSource("manual");
      toast.error(
        "Could not restore the map capture — please upload a photo instead",
      );
      return;
    }
    setSource("map");
    setLocation({ latitude: draft.latitude, longitude: draft.longitude });
    setValue(
      "title",
      `Pothole near ${draft.roadName || draft.municipality || "captured location"}`.slice(
        0,
        120,
      ),
    );
    setValue("roadName", draft.roadName || "Captured road area");
    setValue("municipality", draft.municipality || "Kathmandu");
    setValue("ward", draft.ward || "1");
    setValue("landmark", "");
  }

  /** Step-2 AI gate — server-side detection; submission is blocked without a hit. */
  async function runDetection(file: File) {
    const seq = detectSeqRef.current;
    setDetecting(true);
    setDetection(null);
    setDetectError(null);
    setOverrideAi(false);
    try {
      const result = await reportsApi.detect(file);
      if (seq !== detectSeqRef.current) return;
      setDetection(result);
    } catch (err) {
      if (seq !== detectSeqRef.current) return;
      setDetectError(
        err instanceof Error ? err.message : "AI detection failed",
      );
    } finally {
      if (seq === detectSeqRef.current) setDetecting(false);
    }
  }

  async function handleLocationSet(ll: LatLng) {
    setLocation(ll);
    setGeocoding(true);
    try {
      const geo = await reverseGeocode(ll.latitude, ll.longitude);
      if (geo.roadName)
        setValue("roadName", geo.roadName, { shouldDirty: true });
      if (geo.municipality)
        setValue("municipality", geo.municipality, { shouldDirty: true });
      if (geo.ward) setValue("ward", geo.ward, { shouldDirty: true });
      if (geo.landmark)
        setValue("landmark", geo.landmark, { shouldDirty: true });
    } finally {
      setGeocoding(false);
    }
    // Proactive duplicate check so the reporter can decide before submitting.
    try {
      const dup = await reportsApi.checkDuplicate(ll.latitude, ll.longitude);
      setDuplicateWarn(
        dup.duplicate && dup.nearbyReport ? dup.nearbyReport : null,
      );
    } catch {
      /* non-blocking */
    }
  }

  async function handleUseMyLocation() {
    setLocating(true);
    try {
      const ll = await getCurrentPosition();
      await handleLocationSet(ll);
      toast.success("Location captured");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not get your location",
      );
    } finally {
      setLocating(false);
    }
  }

  async function doSubmit(ignoreDuplicate: boolean) {
    if (!photo) {
      toast.error("Please attach a photo of the hazard");
      return;
    }
    stopCamera();
    if (!location) {
      toast.error(
        "Please set the location on the map (or use your current location)",
      );
      return;
    }
    if (source === "manual" && (!detection || (!detection.isPothole && !overrideAi))) {
      toast.error(
        detection && !detection.isPothole
          ? detection.message ??
              "No pothole detected — please upload another photo or confirm bypass"
          : "AI detection is still analyzing the photo",
      );
      return;
    }
    const v = getValues();
    const form = new FormData();
    form.append("image", photo);
    form.append("title", v.title);
    form.append("description", v.description);
    form.append("roadName", v.roadName);
    form.append("municipality", v.municipality);
    form.append("ward", v.ward);
    form.append("landmark", v.landmark ?? "");
    form.append("severity", v.severity);
    form.append("latitude", String(location.latitude));
    form.append("longitude", String(location.longitude));
    form.append("ignoreDuplicate", String(ignoreDuplicate));
    form.append("skipDetection", String(source === "map" || overrideAi));

    setSubmitting(true);
    try {
      const result = await reportsApi.create(form);
      if (!result.ok) {
        setDuplicateWarn(result.nearbyReport);
        toast.info("A similar report already exists nearby");
        return;
      }
      setCreated(result.report);
      toast.success("Report submitted successfully!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not submit the report",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const onContinueDuplicate = () => void doSubmit(true);
  const onCancelDuplicate = () => setDuplicateWarn(null);

  async function handleDeleteReport() {
    if (!created) return;
    setRemovingSuccess(true);
    try {
      await reportsApi.removeForUser(created.id);
      toast.success("Report deleted permanently.");
      navigate("/dashboard");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete the report",
      );
    } finally {
      setRemovingSuccess(false);
    }
  }

  const stepsCompleted = new Set<number>();
  if (photoPreview) stepsCompleted.add(1);
  if (source === "map" || overrideAi || (detection && detection.isPothole))
    stepsCompleted.add(2);
  if (location) stepsCompleted.add(3);
  if (photoPreview && location) stepsCompleted.add(4);
  const currentStep = !stepsCompleted.has(1)
    ? 1
    : !stepsCompleted.has(2)
      ? 2
      : !stepsCompleted.has(3)
        ? 3
        : 4;

  if (created) {
    return (
      <div className="min-h-screen bg-slate-100 py-10">
        <div className="mx-auto max-w-3xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div
              className="rounded-3xl bg-white p-8"
              style={{ boxShadow: "0 24px 80px rgba(15,23,42,0.08)" }}
            >
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/10 text-success">
                <FaCheckCircle className="h-9 w-9" />
              </div>
              <h1 className="mt-5 text-3xl font-extrabold text-primary">
                Report submitted!
              </h1>
              <p className="mt-3 text-primary/70 text-sm max-w-2xl">
                Reference{" "}
                <span className="font-bold text-accent">
                  {reportRef(created.id)}
                </span>
                . Your report is now{" "}
                <span className="font-semibold">PENDING</span> review by the
                municipality.
              </p>

              <dl className="mt-8 grid gap-4 rounded-3xl bg-primary/5 p-6 text-sm sm:grid-cols-2">
                <InfoItem label="Road" value={created.roadName} />
                <InfoItem
                  label="Location"
                  value={`${created.municipality}, Ward ${created.ward}`}
                />
                <InfoItem
                  label="Severity"
                  value={SEVERITY_META[created.severity].label}
                />
                <InfoItem
                  label="Coordinates"
                  value={`${created.latitude?.toFixed(5)}, ${created.longitude?.toFixed(5)}`}
                />
              </dl>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
                <Button onClick={() => void reportsApi.receipt(created.id)}>
                  <FaDownload /> Download receipt
                </Button>
                {!confirmRemoveSuccess ? (
                  <Button variant="danger" onClick={() => setConfirmRemoveSuccess(true)}>
                    <FaTrash /> Delete report
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="danger"
                      loading={removingSuccess}
                      onClick={() => void handleDeleteReport()}
                    >
                      Yes, delete permanently
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmRemoveSuccess(false)}>
                      Cancel
                    </Button>
                  </>
                )}
              </div>
              {confirmRemoveSuccess && (
                <p className="mt-4 text-center text-xs text-primary/60">
                  This permanently deletes {reportRef(created.id)} from your account, admin lists, and the
                  database. Download the receipt first if you need a copy.
                </p>
              )}
              <div className="mt-4 flex justify-center">
                <Button variant="outline" onClick={() => navigate("/dashboard")}>
                  Go to my dashboard
                </Button>
              </div>
              <p className="mt-5 text-center text-xs text-primary/50">
                You can track status updates and history for this report from your dashboard.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-8">
          <h1 className="text-4xl font-extrabold text-primary">
            Report a road hazard
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-primary/60">
            Upload a photo, pin the location and describe the issue so road
            crews can prioritize repairs faster.
          </p>
        </header>

        {duplicateWarn && (
          <DuplicateWarning
            nearby={duplicateWarn}
            onContinue={onContinueDuplicate}
            onCancel={onCancelDuplicate}
            loading={submitting}
          />
        )}

        <div
          className="rounded-3xl bg-white p-5"
          style={{ boxShadow: "0 24px 80px rgba(15,23,42,0.08)" }}
        >
          <ReportStepper current={currentStep} completed={stepsCompleted} />
        </div>

        <form
          onSubmit={handleSubmit(() => void doSubmit(false))}
          className="mt-6 grid gap-6 lg:grid-cols-3"
        >
          <div className="lg:col-span-2 space-y-6">
            <Card className="space-y-6 p-6">
              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary-light">
                  <FaCamera />
                  <span>1 · Photo</span>
                </div>
                {photoPreview ? (
                  <div className="relative overflow-hidden rounded-3xl">
                    <img
                      src={photoPreview}
                      alt={
                        source === "map"
                          ? "Captured map area"
                          : "Pothole preview"
                      }
                      className={`h-56 w-full ${source === "map" ? "bg-primary/5 object-contain" : "object-cover"}`}
                    />
                    {source === "map" ? (
                      <span className="absolute right-3 top-3 rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                        Map capture
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        className="absolute right-3 top-3"
                        onClick={clearPhoto}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ) : cameraStream ? (
                  <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-black">
                    <video
                      ref={videoRef}
                      className="h-56 w-full object-cover"
                      playsInline
                      autoPlay
                      muted
                    />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/50 p-3">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={takeSnapshot}
                      >
                        Capture photo
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={stopCamera}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 rounded-3xl border-2 border-dashed border-primary/20 bg-primary/5 p-6 text-primary/70 transition hover:border-accent hover:text-accent">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <FaCamera className="text-5xl" />
                      <p className="text-sm font-semibold text-primary">
                        Take or upload a photo
                      </p>
                      <p className="text-xs">JPG / PNG / WEBP · max 5 MB</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button
                        type="button"
                        variant="primary"
                        onClick={capturePhoto}
                      >
                        Take image
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={uploadPhoto}
                      >
                        Upload image
                      </Button>
                    </div>
                    {cameraError && (
                      <p className="mt-3 text-sm text-danger">{cameraError}</p>
                    )}
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept={PHOTO_ACCEPT}
                      capture="environment"
                      className="hidden"
                      onChange={handlePhoto}
                    />
                    <input
                      ref={uploadInputRef}
                      type="file"
                      accept={PHOTO_ACCEPT}
                      className="hidden"
                      onChange={handlePhoto}
                    />
                  </div>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary-light">
                  <FaRobot />
                  <span>2 · AI detection</span>
                </div>
                {source === "map" ? (
                  <div className="flex items-center gap-3 rounded-3xl border border-success/20 bg-success/5 p-4 text-sm font-semibold text-success">
                    <FaCheckCircle /> Map capture attached — AI photo check is
                    not required.
                  </div>
                ) : (
                  <>
                    {detecting && (
                      <div className="flex items-center gap-3 rounded-3xl border border-primary/10 bg-primary/5 p-4 text-sm text-primary/70">
                        <Spinner size="sm" /> Analyzing the photo for a pothole…
                      </div>
                    )}
                    {detectError && (
                      <div className="rounded-3xl border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
                        {detectError}
                      </div>
                    )}
                    {!detecting && detection?.isPothole && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-3xl border border-success/20 bg-success/5 px-4 py-3">
                          <p className="flex items-center gap-2 text-sm font-bold text-success">
                            <FaCheckCircle /> Pothole detected
                          </p>
                          <Badge tone="success">
                            {Math.round(detection.confidence * 100)}% confidence
                          </Badge>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-primary/10">
                          <div
                            className="h-full rounded-full bg-success transition-all"
                            style={{
                              width: `${Math.round(detection.confidence * 100)}%`,
                            }}
                          />
                        </div>
                        {detection.severity && (
                          <div className="flex items-center justify-between rounded-3xl border border-primary/10 bg-primary/[0.03] px-4 py-3 text-sm">
                            <span className="text-primary/60">
                              CNN severity (authoritative)
                            </span>
                            <span
                              className="font-extrabold"
                              style={{
                                color: SEVERITY_META[detection.severity].color,
                              }}
                            >
                              {SEVERITY_META[detection.severity].label}
                            </span>
                          </div>
                        )}
                        {detection.previewUrl && (
                          <figure className="relative overflow-hidden rounded-3xl">
                            <img
                              src={detection.previewUrl}
                              alt="Detected pothole"
                              className="h-40 w-full object-cover"
                            />
                            <figcaption className="absolute right-2 top-2 rounded-full bg-primary/80 px-2 py-0.5 text-[10px] font-bold text-white">
                              AI detection box
                            </figcaption>
                          </figure>
                        )}
                      </div>
                    )}
                    {!detecting && detection && !detection.isPothole && (
                      <div className="space-y-3">
                        <div className="rounded-3xl border-2 border-warning/50 bg-warning/5 p-4">
                          <p className="flex items-center gap-2 text-sm font-bold text-warning">
                            <FaExclamationTriangle /> No pothole detected
                          </p>
                          <p className="mt-1 text-sm text-primary/70">
                            {detection.message ??
                              "This photo does not appear to contain a pothole. Please upload another image that clearly shows the road hazard."}
                          </p>
                          {detection.classProbs && detection.classProbs[0] !== undefined && (
                            <p className="mt-2 text-xs text-primary/50">
                              AI classification: {Math.round(detection.classProbs[0] * 100)}% no
                              pothole
                              {detection.confidence > 0
                                ? ` · ${Math.round(detection.confidence * 100)}% best pothole match`
                                : ""}
                            </p>
                          )}
                        </div>
                        <label className="flex items-center gap-2 text-sm text-primary/80 cursor-pointer p-2 hover:bg-primary/5 rounded-lg transition">
                          <input
                            type="checkbox"
                            checked={overrideAi}
                            onChange={(e) => setOverrideAi(e.target.checked)}
                            className="rounded border-primary/30 text-accent focus:ring-accent"
                          />
                          I am sure this is a pothole (bypass AI check)
                        </label>
                      </div>
                    )}
                    {!detecting && !detection && !detectError && (
                      <p className="text-xs text-primary/50">
                        Choose a photo above and it will be checked
                        automatically.
                      </p>
                    )}
                  </>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary-light">
                  <FaMapMarkerAlt />
                  <span>3 · Location</span>
                </div>
                {source === "map" && location ? (
                  <div className="rounded-3xl border border-success/20 bg-success/5 p-4">
                    <p className="flex items-center gap-2 text-sm font-bold text-success">
                      <FaCheckCircle /> Location captured from the map
                    </p>
                    <p className="mt-1 font-mono text-sm font-semibold text-primary">
                      {location.latitude.toFixed(5)},{" "}
                      {location.longitude.toFixed(5)}
                    </p>
                    <p className="mt-1 text-xs text-primary/50">
                      The map capture already carries the exact coordinates — no
                      need to set the location again.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex items-center gap-3">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleUseMyLocation}
                        loading={locating}
                      >
                        <FaRoute /> Use my current location
                      </Button>
                      {location && (
                        <span className="text-xs text-primary/60">
                          {location.latitude.toFixed(5)},{" "}
                          {location.longitude.toFixed(5)}
                          {geocoding && " · resolving address…"}
                        </span>
                      )}
                    </div>
                    <LocationPicker
                      value={location}
                      onChange={(ll) => void handleLocationSet(ll)}
                    />
                  </>
                )}
              </section>
            </Card>

            <Card className="space-y-5 p-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary-light">
                <FaExclamationTriangle />
                <span>4 · Details</span>
              </div>

              <Field label="Title" error={errors.title?.message}>
                <TextInput
                  placeholder="e.g. Deep pothole on Ring Road"
                  readOnly={source === "map"}
                  {...register("title")}
                />
              </Field>

              <Field label="Description" error={errors.description?.message}>
                <TextArea
                  rows={4}
                  placeholder="Size, depth, how long it has been there, risks to commuters…"
                  {...register("description")}
                />
              </Field>

              <Field
                label="Suggested severity"
                error={errors.severity?.message}
              >
                <p className="mb-1.5 text-[11px] leading-snug text-primary/45">
                  Your estimate — the CNN's classification overrides it when the
                  photo is analyzed.
                </p>
                <Select {...register("severity")}>
                  {SEVERITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Road name" error={errors.roadName?.message}>
                  <div className="relative">
                    <input
                      value={roadQuery}
                      onChange={(e) => {
                        const q = e.target.value;
                        setRoadQuery(q);
                        setValue("roadName", q, { shouldDirty: true });
                        setShowSuggestions(true);
                        if (searchTimerRef.current)
                          window.clearTimeout(searchTimerRef.current);
                        if (q.trim().length < 2) {
                          setSuggestions([]);
                          return;
                        }
                        searchTimerRef.current = window.setTimeout(async () => {
                          if (searchAbortRef.current)
                            searchAbortRef.current.abort();
                          const ac = new AbortController();
                          searchAbortRef.current = ac;
                          try {
                            const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`;
                            const res = await fetch(url, {
                              headers: { Accept: "application/json" },
                              signal: ac.signal,
                            });
                            if (!res.ok) {
                              setSuggestions([]);
                              return;
                            }
                            const data = await res.json();
                            setSuggestions(data || []);
                          } catch {
                            setSuggestions([]);
                          }
                        }, 300);
                      }}
                      placeholder="Road / street"
                      readOnly={source === "map"}
                      className="w-full rounded-md border px-3 py-2"
                    />

                    {showSuggestions && suggestions.length > 0 && (
                      <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-white shadow-lg">
                        {suggestions.map((s: any, idx: number) => {
                          const addr = s.address ?? {};
                          const roadLabel =
                            addr.road ||
                            addr.path ||
                            addr.pedestrian ||
                            addr.cycleway ||
                            addr.footway ||
                            addr.residential ||
                            (s.display_name
                              ? s.display_name.split(",")[0]
                              : "");
                          const districtLabel =
                            addr.city ||
                            addr.town ||
                            addr.municipality ||
                            addr.village ||
                            addr.county ||
                            addr.state_district ||
                            addr.suburb ||
                            addr.neighbourhood ||
                            addr.postcode ||
                            "";

                          return (
                            <li
                              key={s.place_id ?? idx}
                              className="cursor-pointer border-b border-primary/5 px-3 py-2 last:border-b-0 hover:bg-primary/5"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                const ll = {
                                  latitude: parseFloat(s.lat),
                                  longitude: parseFloat(s.lon),
                                };
                                const road = roadLabel;

                                setValue("roadName", road, {
                                  shouldDirty: true,
                                });
                                setValue("municipality", districtLabel, {
                                  shouldDirty: true,
                                });
                                setValue(
                                  "ward",
                                  addr.city_district ||
                                  addr.suburb ||
                                  addr.neighbourhood ||
                                  addr.postcode ||
                                  "",
                                  { shouldDirty: true },
                                );
                                setValue(
                                  "landmark",
                                  addr.amenity || addr.neighbourhood || "",
                                  { shouldDirty: true },
                                );

                                setLocation(ll);
                                void handleLocationSet(ll);

                                setShowSuggestions(false);
                                setSuggestions([]);
                                setRoadQuery(road);
                              }}
                            >
                              <div className="text-sm font-semibold text-primary">
                                {roadLabel}
                              </div>
                              {districtLabel && (
                                <div className="text-xs text-primary/60">
                                  {districtLabel}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </Field>
                <Field label="Ward" error={errors.ward?.message}>
                  <TextInput
                    placeholder="e.g. 10"
                    readOnly={source === "map"}
                    {...register("ward")}
                  />
                </Field>
                <Field
                  label="Municipality"
                  error={errors.municipality?.message}
                >
                  <TextInput
                    placeholder="e.g. Kathmandu"
                    readOnly={source === "map"}
                    {...register("municipality")}
                  />
                </Field>
                <Field
                  label={
                    source === "map"
                      ? "Additional notes (optional)"
                      : "Landmark (optional)"
                  }
                  error={errors.landmark?.message}
                >
                  <TextInput
                    placeholder="Near the old gate…"
                    {...register("landmark")}
                  />
                </Field>
              </div>

              <p className="rounded-3xl bg-primary/5 p-3 text-xs text-primary/60">
                {source === "map"
                  ? "Address details were filled from your map capture — edit them only if you need to correct them."
                  : "Road, municipality and ward auto-fill from the map when a location is selected — adjust them if needed."}
              </p>
            </Card>

            <div className="flex flex-col items-end gap-2">
              <Button
                type="submit"
                size="lg"
                loading={submitting}
                disabled={
                  detecting || (detection !== null && !detection.isPothole && !overrideAi)
                }
              >
                Submit report
              </Button>
              {detecting && (
                <p className="text-xs text-primary/50">
                  AI is checking the photo…
                </p>
              )}
            </div>
          </div>

          <div className="hidden lg:block">
            <Sidebar />
          </div>
        </form>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-primary/50">
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold text-primary">{value}</dd>
    </div>
  );
}
type Step = 1 | 2 | 3 | 4;
function ReportStepper({
  current,
  completed,

}: {
  current: Step;
  completed: Set<number>;
}) {
  const steps = [
    { id: 1, label: "Photo" },
    { id: 2, label: "AI check" },
    { id: 3, label: "Location" },
    { id: 4, label: "Details" },
  ] as const;

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {steps.map((step) => {
        const done = completed.has(step.id);
        const active = step.id === current;
        return (
          <div
            key={step.id}
            className="rounded-3xl border p-4 text-center transition-all"
            style={{
              borderColor: done || active ? "#2563EB" : "#E2E8F0",
              background: done ? "#EFF6FF" : active ? "#EEF2FF" : "#fff",
            }}
            aria-current={active ? "step" : undefined}
          >
            <div
              className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
              style={{
                background: done ? "#16A34A" : active ? "#2563EB" : "#E2E8F0",
                color: done || active ? "#fff" : "#475569",
              }}
            >
              {done ? "✓" : step.id}
            </div>
            <p
              className="text-xs font-semibold"
              style={{ color: active ? "#1D4ED8" : "#64748B" }}
            >
              {step.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="space-y-5 sticky top-6">
      <div
        className="rounded-3xl bg-white p-5"
        style={{ boxShadow: "0 20px 60px rgba(15,23,42,0.08)" }}
      >
        <h3 className="text-sm font-semibold text-slate-900">Photo Tips</h3>
        <ul className="mt-4 space-y-3 text-xs text-slate-500">
          <li className="flex items-center gap-2">
            <Ruler className="h-4 w-4" /> Stand 1–2 m away for context
          </li>
          <li className="flex items-center gap-2">
            <Footprints className="h-4 w-4" /> Include a reference object for scale
          </li>
          <li className="flex items-center gap-2">
            <Sun className="h-4 w-4" /> Daylight photos are sharpest
          </li>
          <li className="flex items-center gap-2">
            <RefreshCcw className="h-4 w-4" /> Capture multiple angles when possible
          </li>
        </ul>
      </div>

      <div className="rounded-3xl bg-[#FEF2F2] border border-[#FECACA] p-5">
        <div className="flex items-center gap-3 text-sm font-semibold text-[#991B1B]">
          <span className="w-5 h-5 flex items-center justify-center rounded-full bg-[#FEE2E2] text-[#DC2626]">
            !
          </span>
          Safety first
        </div>
        <ul className="mt-3 space-y-2 text-xs text-[#7F1D1D]">
          <li>• Never stop on a busy road to report</li>
          <li>• Use a safe vantage point for photos</li>
          <li>• For critical hazards, contact emergency services</li>
        </ul>
      </div>

      <div className="rounded-3xl bg-[#ECFDF5] border border-[#BBF7D0] p-5">
        <h3 className="text-sm font-semibold text-[#14532D]">
          Reporting guidelines
        </h3>
        <ul className="mt-3 space-y-2 text-xs text-[#166534]">
          <li>• One report per pothole location</li>
          <li>• Include GPS coordinates when possible</li>
          <li>• Add severity honestly — it affects priority</li>
        </ul>
      </div>
    </aside>
  );
}

function DuplicateWarning({
  nearby,
  onContinue,
  onCancel,
  loading,
}: {
  nearby: NearbyReport;
  onContinue: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const statusMeta = STATUS_META[nearby.status];
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="mb-6 border-2 border-warning/50 bg-warning/5">
        <div className="flex items-start gap-4">
          <FaExclamationTriangle className="mt-1 text-2xl text-warning" />
          <div className="flex-1">
            <h3 className="font-bold text-primary">
              A similar report exists within {nearby.distance}m of this spot
            </h3>
            <div className="mt-3 flex gap-4">
              {nearby.imageUrl && (
                <img
                  src={nearby.imageUrl}
                  alt="Existing report"
                  className="h-20 w-28 rounded-lg object-cover"
                />
              )}
              <div className="text-sm">
                <p className="font-semibold text-primary">{nearby.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-primary/60">
                  <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                  <span>{SEVERITY_META[nearby.severity].label} severity</span>
                </p>
                <p className="mt-1 text-xs text-primary/50">
                  Reported {new Date(nearby.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="primary" onClick={onContinue} loading={loading}>
                It&apos;s a different hazard — submit anyway
              </Button>
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

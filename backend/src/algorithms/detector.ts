/** Normalized bounding box — 0..1 coordinates as fractions of the image. */
export interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionResult {
  isPothole: boolean;
  confidence: number; // 0..1
  boundingBox: DetectionBox | null; // null when nothing was detected
  /** CNN severity classification (LOW/MEDIUM/HIGH/CRITICAL) — set when detected. */
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  /** Softmax probabilities over [NONE, LOW, MEDIUM, HIGH, CRITICAL]. */
  classProbs?: number[];
}

/**
 * Image → pothole detection.
 *
 * Services depend on this interface rather than a concrete detector, so a real
 * YOLO/ONNX model can be dropped in later behind the same contract without
 * touching the report workflow.
 */
export interface PotholeDetector {
  detect(imageBuffer: Buffer): Promise<DetectionResult>;
}

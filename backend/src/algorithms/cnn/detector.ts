/**
 * The CNN pothole detector — a `PotholeDetector` implementation backed by the
 * from-scratch CNN. It downscales the uploaded photo to 64×64 grayscale, runs
 * the real forward pass, and turns the softmax distribution over
 * [NONE, LOW, MEDIUM, HIGH, CRITICAL] into a detection verdict + severity +
 * confidence. The bounding box comes from the CNN's own class activation map.
 */
import sharp from 'sharp';
import type { Severity } from '@prisma/client';
import type { DetectionBox, DetectionResult, PotholeDetector } from '../detector.js';
import { runInference } from './forward.js';
import { CnnModel, CLASSES, INPUT_SIZE } from './model.js';
import type { Cache } from './model.js';
import { loadCnnWeights } from './weights.js';

/** Class indices that mean "pothole" (0 is NONE). */
const POTHOLES = [1, 2, 3, 4];
/** Minimum softmax mass on the winning class before we call it a pothole. */
const CONFIDENCE_THRESHOLD = 0.5;

let modelPromise: Promise<CnnModel> | null = null;

/** Lazily load (and cache) the trained network — one model per process. */
function getModel(): Promise<CnnModel> {
  modelPromise ??= loadCnnWeights().then((json) => CnnModel.fromJSON(json));
  return modelPromise;
}

/** 32×32×1, normalized to [0,1] — the CNN's expected input. */
async function toGrayscaleInput(buffer: Buffer): Promise<Float32Array> {
  const { data } = await sharp(buffer)
    .greyscale()
    .resize(INPUT_SIZE, INPUT_SIZE, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const input = new Float32Array(INPUT_SIZE * INPUT_SIZE);
  for (let i = 0; i < input.length; i++) input[i] = (data[i] ?? 0) / 255;
  return input;
}

/** Bounding box from the class activation map (threshold at 50% of peak). */
function boxFromCam(model: CnnModel, cache: Cache, cls: number): DetectionBox | null {
  const size = INPUT_SIZE / 4; // 8
  const cam = model.classActivation(cache, cls);
  let peak = -Infinity;
  for (let i = 0; i < cam.length; i++) peak = Math.max(peak, cam[i] ?? 0);
  if (!(peak > 1e-6)) return null;

  const threshold = peak * 0.5;
  let minY = size, maxY = -1, minX = size, maxX = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((cam[y * size + x] ?? 0) >= threshold) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  if (maxY < minY) return null;
  return {
    x: minX / size,
    y: minY / size,
    width: (maxX - minX + 1) / size,
    height: (maxY - minY + 1) / size,
  };
}

export const cnnDetector: PotholeDetector = {
  async detect(imageBuffer: Buffer): Promise<DetectionResult> {
    const model = await getModel();
    const input = await toGrayscaleInput(imageBuffer);
    const { probs, predictedClass, cache } = runInference(model, input);

    const classProbs = Array.from(probs);
    const potholeProb = POTHOLES.reduce((m, c) => Math.max(m, probs[c] ?? 0), 0);
    const isPothole = predictedClass !== 0 && potholeProb >= CONFIDENCE_THRESHOLD;

    if (!isPothole) {
      return { isPothole: false, confidence: potholeProb, boundingBox: null, classProbs };
    }

    const severity = CLASSES[predictedClass] as Severity;
    return {
      isPothole: true,
      confidence: probs[predictedClass] ?? potholeProb,
      boundingBox: boxFromCam(model, cache, predictedClass),
      severity,
      classProbs,
    };
  },
};

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
import { meanOfSmallest } from './tensor.js';
import { loadCnnWeights } from './weights.js';

/** Class indices that mean "pothole" (0 is NONE). */
const POTHOLES = [1, 2, 3, 4];
/** Minimum softmax mass on the winning pothole class. */
const CONFIDENCE_THRESHOLD = 0.55;
/** Winning pothole class must beat NONE by at least this margin. */
const NONE_MARGIN = 0.12;
/**
 * Darkest pixels must be this much darker than the road baseline (0..255).
 * Training keeps smooth shadows below ~10 and LOW potholes at 60+.
 */
const MIN_DEPTH_DELTA = 40;
/** Reject frames that are too dark/bright to read as road surface. */
const MIN_ROAD_LUMINANCE = 90;
const MAX_ROAD_LUMINANCE = 220;

const NO_POTHOLE_MESSAGE =
  'No pothole detected in this image. Please upload a clear, close-up photo of the road hazard.';

let modelPromise: Promise<CnnModel> | null = null;

/** Lazily load (and cache) the trained network — one model per process. */
function getModel(): Promise<CnnModel> {
  modelPromise ??= loadCnnWeights().then((json) => CnnModel.fromJSON(json));
  return modelPromise;
}

/** 32×32 grayscale — normalized CNN input plus raw 0..255 pixels for depth checks. */
async function toGrayscaleInput(buffer: Buffer): Promise<{ input: Float32Array; pixels255: Uint8Array }> {
  const { data } = await sharp(buffer)
    .greyscale()
    .resize(INPUT_SIZE, INPUT_SIZE, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels255 = new Uint8Array(data.buffer, data.byteOffset, data.length);
  const input = new Float32Array(pixels255.length);
  for (let i = 0; i < input.length; i++) input[i] = (pixels255[i] ?? 0) / 255;
  return { input, pixels255 };
}

function medianUint8(values: Uint8Array): number {
  const sorted = Array.from(values).sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** How much darker the deepest pixels are than the typical road tone. */
export function potholeDepthDelta(pixels255: Uint8Array): number {
  const baseline = medianUint8(pixels255);
  const floor = meanOfSmallest(pixels255, 3);
  return baseline - floor;
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

/** Shared verdict logic — exported for unit tests. */
export function evaluateCnnVerdict(
  probs: ArrayLike<number>,
  predictedClass: number,
  depthDelta: number,
  roadBaseline: number,
  boundingBox: DetectionBox | null
): { isPothole: boolean; confidence: number; message?: string } {
  const classProbs = Array.from(probs);
  const noneProb = classProbs[0] ?? 0;
  const potholeProb = POTHOLES.reduce((m, c) => Math.max(m, classProbs[c] ?? 0), 0);
  const winnerProb = classProbs[predictedClass] ?? 0;

  const cnnHit =
    predictedClass !== 0 &&
    winnerProb >= CONFIDENCE_THRESHOLD &&
    winnerProb >= noneProb + NONE_MARGIN;

  if (!cnnHit) {
    return {
      isPothole: false,
      confidence: potholeProb,
      message: noneProb >= 0.5
        ? `${NO_POTHOLE_MESSAGE} The image looks like plain road (${Math.round(noneProb * 100)}% confidence).`
        : NO_POTHOLE_MESSAGE,
    };
  }

  if (roadBaseline < MIN_ROAD_LUMINANCE || roadBaseline > MAX_ROAD_LUMINANCE) {
    return {
      isPothole: false,
      confidence: winnerProb,
      message: `${NO_POTHOLE_MESSAGE} The photo is too dark or overexposed to analyze reliably.`,
    };
  }

  if (depthDelta < MIN_DEPTH_DELTA) {
    return {
      isPothole: false,
      confidence: winnerProb,
      message: `${NO_POTHOLE_MESSAGE} No deep road defect was found — shadows or cracks alone are not enough.`,
    };
  }

  if (!boundingBox) {
    return {
      isPothole: false,
      confidence: winnerProb,
      message: NO_POTHOLE_MESSAGE,
    };
  }

  return { isPothole: true, confidence: winnerProb };
}

export const cnnDetector: PotholeDetector = {
  async detect(imageBuffer: Buffer): Promise<DetectionResult> {
    const model = await getModel();
    const { input, pixels255 } = await toGrayscaleInput(imageBuffer);
    const { probs, predictedClass, cache } = runInference(model, input);

    const classProbs = Array.from(probs);
    const roadBaseline = medianUint8(pixels255);
    const depthDelta = potholeDepthDelta(pixels255);
    const boundingBox =
      predictedClass !== 0 ? boxFromCam(model, cache, predictedClass) : null;
    const verdict = evaluateCnnVerdict(probs, predictedClass, depthDelta, roadBaseline, boundingBox);

    if (!verdict.isPothole) {
      return {
        isPothole: false,
        confidence: verdict.confidence,
        boundingBox: null,
        classProbs,
        message: verdict.message,
      };
    }

    const severity = CLASSES[predictedClass] as Severity;
    return {
      isPothole: true,
      confidence: verdict.confidence,
      boundingBox,
      severity,
      classProbs,
    };
  },
};

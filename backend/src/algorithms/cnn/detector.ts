/**
 * The CNN pothole detector — a `PotholeDetector` implementation backed by the
 * from-scratch CNN. It downscales the uploaded photo to 32×32 grayscale, runs
 * the real forward pass, and turns the softmax distribution over
 * [NONE, LOW, MEDIUM, HIGH, CRITICAL] into a detection verdict + severity +
 * confidence. The bounding box comes from the CNN's own class activation map.
 *
 * A geometry gate (`potholeStructure`) must also pass before a hit is returned.
 */
import sharp from 'sharp';
import type { Severity } from '@prisma/client';
import type { DetectionBox, DetectionResult, PotholeDetector } from '../detector.js';
import { analyzePotholeStructure, boxArea, MAX_BOX_AREA, STRUCTURE_GRID } from '../potholeStructure.js';
import { runInference } from './forward.js';
import { CnnModel, CLASSES, INPUT_SIZE } from './model.js';
import type { Cache } from './model.js';
import { meanOfSmallest } from './tensor.js';
import { loadCnnWeights } from './weights.js';

/** Class indices that mean "pothole" (0 is NONE). */
const POTHOLES = [1, 2, 3, 4];
/** Minimum softmax mass on the winning pothole class. */
const CONFIDENCE_THRESHOLD = 0.52;
/** Winning pothole class must beat NONE by at least this margin. */
const NONE_MARGIN = 0.12;
/** NONE probability above this always rejects — even if a pothole class peaks. */
const MAX_NONE_PROB = 0.32;

const NO_POTHOLE_MESSAGE =
  'No pothole detected in this image. Please upload a clear, close-up photo of the road hazard.';

let modelPromise: Promise<CnnModel> | null = null;

/** Lazily load (and cache) the trained network — one model per process. */
function getModel(): Promise<CnnModel> {
  modelPromise ??= loadCnnWeights().then((json) => CnnModel.fromJSON(json));
  return modelPromise;
}

/** CNN input (32×32) plus a higher-res grid for geometry checks (64×64). */
async function toGrayscaleInputs(buffer: Buffer): Promise<{
  input: Float32Array;
  structurePixels: Uint8Array;
}> {
  const [cnnRaw, structureRaw] = await Promise.all([
    sharp(buffer).greyscale().resize(INPUT_SIZE, INPUT_SIZE, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true }),
    sharp(buffer)
      .greyscale()
      .resize(STRUCTURE_GRID, STRUCTURE_GRID, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true }),
  ]);

  const cnnPixels = new Uint8Array(cnnRaw.data.buffer, cnnRaw.data.byteOffset, cnnRaw.data.length);
  const input = new Float32Array(cnnPixels.length);
  for (let i = 0; i < input.length; i++) input[i] = (cnnPixels[i] ?? 0) / 255;

  const structurePixels = new Uint8Array(structureRaw.data.buffer, structureRaw.data.byteOffset, structureRaw.data.length);
  return { input, structurePixels };
}

/** How much darker the deepest pixels are than the typical road tone (32×32). */
export function potholeDepthDelta(pixels255: Uint8Array): number {
  const sorted = Array.from(pixels255).sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const baseline =
    sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
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
  boundingBox: DetectionBox | null,
  structureOk: boolean,
  structureMessage?: string
): { isPothole: boolean; confidence: number; message?: string } {
  const classProbs = Array.from(probs);
  const noneProb = classProbs[0] ?? 0;
  const potholeProb = POTHOLES.reduce((m, c) => Math.max(m, classProbs[c] ?? 0), 0);
  const winnerProb = classProbs[predictedClass] ?? 0;

  if (noneProb > MAX_NONE_PROB) {
    return {
      isPothole: false,
      confidence: potholeProb,
      message: `${NO_POTHOLE_MESSAGE} The image looks like plain road (${Math.round(noneProb * 100)}% confidence).`,
    };
  }

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

  if (!boundingBox || boxArea(boundingBox) > MAX_BOX_AREA) {
    return {
      isPothole: false,
      confidence: winnerProb,
      message: NO_POTHOLE_MESSAGE,
    };
  }

  if (!structureOk) {
    return {
      isPothole: false,
      confidence: winnerProb,
      message: structureMessage ?? NO_POTHOLE_MESSAGE,
    };
  }

  return { isPothole: true, confidence: winnerProb };
}

export const cnnDetector: PotholeDetector = {
  async detect(imageBuffer: Buffer): Promise<DetectionResult> {
    const model = await getModel();
    const { input, structurePixels } = await toGrayscaleInputs(imageBuffer);
    const { probs, predictedClass, cache } = runInference(model, input);

    const classProbs = Array.from(probs);
    const boundingBox =
      predictedClass !== 0 ? boxFromCam(model, cache, predictedClass) : null;
    const structure = analyzePotholeStructure(structurePixels);
    const verdict = evaluateCnnVerdict(
      probs,
      predictedClass,
      boundingBox,
      structure.ok,
      structure.message
    );

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

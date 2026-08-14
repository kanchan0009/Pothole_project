
import sharp from 'sharp';
import type { Severity } from '@prisma/client';
import type { DetectionBox, DetectionResult, PotholeDetector } from '../detector.js';
import {
  analyzePotholeStructure,
  isStrongPotholeStructure,
  STRUCTURE_GRID,
  type StructureResult,
} from '../potholeStructure.js';
import { analyzeRoadScenePixels, isPortraitScene, SCENE_SAMPLE_SIZE, type SceneAnalysis } from '../roadScene.js';
import { runInference } from './forward.js';
import { CnnModel, CLASSES, INPUT_SIZE } from './model.js';
import type { Cache } from './model.js';
import { loadCnnWeights } from './weights.js';

const POTHOLES = [1, 2, 3, 4];
const CONFIDENCE_THRESHOLD = 0.5;
const NONE_MARGIN = 0.08;

const HARD_NONE_PROB = 0.55;

const NO_POTHOLE_MESSAGE =
  'No pothole detected in this image. Please upload a clear, close-up photo of the road hazard.';

let modelPromise: Promise<CnnModel> | null = null;

function getModel(): Promise<CnnModel> {
  modelPromise ??= loadCnnWeights().then((json) => CnnModel.fromJSON(json));
  return modelPromise;
}

async function toGrayscaleInputs(buffer: Buffer): Promise<{
  input: Float32Array;
  structurePixels: Uint8Array;
  scenePixels: Uint8Array;
}> {
  const [cnnRaw, structureRaw, sceneRaw] = await Promise.all([
    sharp(buffer).greyscale().resize(INPUT_SIZE, INPUT_SIZE, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true }),
    sharp(buffer)
      .greyscale()
      .resize(STRUCTURE_GRID, STRUCTURE_GRID, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true }),
    sharp(buffer)
      .resize(SCENE_SAMPLE_SIZE, SCENE_SAMPLE_SIZE, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
  ]);

  const cnnPixels = new Uint8Array(cnnRaw.data.buffer, cnnRaw.data.byteOffset, cnnRaw.data.length);
  const input = new Float32Array(cnnPixels.length);
  for (let i = 0; i < input.length; i++) input[i] = (cnnPixels[i] ?? 0) / 255;

  const structurePixels = new Uint8Array(structureRaw.data.buffer, structureRaw.data.byteOffset, structureRaw.data.length);
  const scenePixels = new Uint8Array(sceneRaw.data.buffer, sceneRaw.data.byteOffset, sceneRaw.data.length);
  return { input, structurePixels, scenePixels };
}

function boxFromCam(model: CnnModel, cache: Cache, cls: number): DetectionBox | null {
  const size = INPUT_SIZE / 4;
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

function maxPotholeProb(probs: ArrayLike<number>): number {
  return POTHOLES.reduce((m, c) => Math.max(m, probs[c] ?? 0), 0);
}


export function evaluateCnnVerdict(
  probs: ArrayLike<number>,
  predictedClass: number,
  structure: StructureResult,
  scene: SceneAnalysis
): { isPothole: boolean; confidence: number; severityClass?: number; message?: string } {
  const classProbs = Array.from(probs);
  const noneProb = classProbs[0] ?? 0;
  const potholeProb = maxPotholeProb(classProbs);
  const winnerProb = classProbs[predictedClass] ?? 0;

  if (!scene.isRoadLike || isPortraitScene(scene)) {
    return {
      isPothole: false,
      confidence: potholeProb,
      message: scene.message ?? NO_POTHOLE_MESSAGE,
    };
  }

  if (predictedClass === 0 && noneProb >= HARD_NONE_PROB) {
    return {
      isPothole: false,
      confidence: potholeProb,
      message: `${NO_POTHOLE_MESSAGE} The image looks like plain road (${Math.round(noneProb * 100)}% confidence).`,
    };
  }

  const cnnPothole =
    predictedClass !== 0 &&
    winnerProb >= CONFIDENCE_THRESHOLD &&
    winnerProb >= noneProb + NONE_MARGIN;

  const strongStructure = isStrongPotholeStructure(structure);

  
  if (cnnPothole && structure.ok && !isPortraitScene(scene)) {
    return { isPothole: true, confidence: winnerProb, severityClass: predictedClass };
  }

  
  if (cnnPothole && winnerProb >= 0.62 && strongStructure && !isPortraitScene(scene)) {
    return { isPothole: true, confidence: winnerProb, severityClass: predictedClass };
  }

  
  if (
    strongStructure &&
    predictedClass !== 0 &&
    potholeProb >= 0.45 &&
    noneProb <= 0.35 &&
    structure.ok &&
    !isPortraitScene(scene)
  ) {
    const severityClass = POTHOLES.reduce(
      (best, c) => ((classProbs[c] ?? 0) > (classProbs[best] ?? 0) ? c : best),
      POTHOLES[0]!
    );
    return {
      isPothole: true,
      confidence: Math.max(winnerProb, potholeProb),
      severityClass,
    };
  }

  if (!structure.ok && !cnnPothole) {
    return {
      isPothole: false,
      confidence: potholeProb,
      message: structure.message ?? NO_POTHOLE_MESSAGE,
    };
  }

  return {
    isPothole: false,
    confidence: potholeProb,
    message: cnnPothole
      ? `${NO_POTHOLE_MESSAGE} No pothole-shaped defect was found on the road surface.`
      : noneProb >= 0.4
        ? `${NO_POTHOLE_MESSAGE} The image looks like plain road (${Math.round(noneProb * 100)}% confidence).`
        : structure.message ?? NO_POTHOLE_MESSAGE,
  };
}

export const cnnDetector: PotholeDetector = {
  async detect(imageBuffer: Buffer): Promise<DetectionResult> {
    const model = await getModel();
    const { input, structurePixels, scenePixels } = await toGrayscaleInputs(imageBuffer);
    const { probs, predictedClass, cache } = runInference(model, input);

    const classProbs = Array.from(probs);
    const structure = analyzePotholeStructure(structurePixels);
    const scene = analyzeRoadScenePixels(scenePixels, SCENE_SAMPLE_SIZE * SCENE_SAMPLE_SIZE);
    const verdict = evaluateCnnVerdict(probs, predictedClass, structure, scene);

    if (!verdict.isPothole) {
      return {
        isPothole: false,
        confidence: verdict.confidence,
        boundingBox: null,
        classProbs,
        message: verdict.message,
      };
    }

    const severityClass = verdict.severityClass ?? predictedClass;
    const boundingBox = boxFromCam(model, cache, severityClass);
    const severity = CLASSES[severityClass] as Severity;

    return {
      isPothole: true,
      confidence: verdict.confidence,
      boundingBox,
      severity,
      classProbs,
    };
  },
};

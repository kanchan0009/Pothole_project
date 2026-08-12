/**
 * Quick scene classification on a downscaled RGB sample.
 * Rejects faces, portraits, sky/grass-dominated frames before pothole logic runs.
 */

export interface SceneAnalysis {
  /** True when the photo plausibly shows asphalt / concrete road. */
  isRoadLike: boolean;
  skinRatio: number;
  roadRatio: number;
  greenRatio: number;
  message?: string;
}

export const SCENE_SAMPLE_SIZE = 64;

const NOT_ROAD =
  'No pothole detected in this image. Please upload a clear photo of the pothole on the road surface — not a portrait, selfie, or indoor scene.';

/** RGB + YCbCr skin rules — camera JPEGs often wash out RGB-only checks. */
function isSkinPixel(r: number, g: number, b: number): boolean {
  if (r < 60 || g < 40 || b < 20) return false;
  if (r > 250 && g > 250 && b > 250) return false;

  const sum = r + g + b;
  if (sum > 0) {
    const nr = r / sum;
    const ng = g / sum;
    const nb = b / sum;
    if (
      nr / ng > 1.185 &&
      nr / nb > 1.28 &&
      nr < 0.68 &&
      ng > 0.23 &&
      ng < 0.42 &&
      nb > 0.18 &&
      nb < 0.38
    ) {
      return true;
    }
  }

  // YCbCr skin cluster — more reliable on webcam / phone JPEG captures.
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return y > 80 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
}

/** Gray, low-saturation tone — typical asphalt / concrete. */
function isRoadPixel(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;
  if (sat > 38) return false;
  const lum = (r + g + b) / 3;
  if (lum < 55 || lum > 210) return false;
  const rg = Math.abs(r - g);
  const rb = Math.abs(r - b);
  const gb = Math.abs(g - b);
  if (rg > 26 || rb > 30 || gb > 26) return false;
  if (r - b > 20 && r > g) return false;
  return true;
}

function isGreenPixel(r: number, g: number, b: number): boolean {
  return g > 95 && g > r + 18 && g > b + 18;
}

/** Classifies whether an RGB buffer (64×64×3) looks like a road photo. */
export function analyzeRoadScenePixels(data: Uint8Array, pixels: number): SceneAnalysis {
  let skin = 0;
  let road = 0;
  let green = 0;

  for (let i = 0; i < pixels; i++) {
    const o = i * 3;
    const r = data[o] ?? 0;
    const g = data[o + 1] ?? 0;
    const b = data[o + 2] ?? 0;
    if (isSkinPixel(r, g, b)) skin++;
    if (isRoadPixel(r, g, b)) road++;
    if (isGreenPixel(r, g, b)) green++;
  }

  const skinRatio = skin / pixels;
  const roadRatio = road / pixels;
  const greenRatio = green / pixels;

  if (skinRatio >= 0.05) {
    return { isRoadLike: false, skinRatio, roadRatio, greenRatio, message: NOT_ROAD };
  }

  if (greenRatio >= 0.35) {
    return { isRoadLike: false, skinRatio, roadRatio, greenRatio, message: NOT_ROAD };
  }

  // Road close-ups are mostly asphalt; portraits have skin but little neutral gray road.
  if (roadRatio < 0.18 && skinRatio >= 0.02) {
    return { isRoadLike: false, skinRatio, roadRatio, greenRatio, message: NOT_ROAD };
  }

  if (roadRatio < 0.12 && skinRatio < 0.02) {
    return { isRoadLike: false, skinRatio, roadRatio, greenRatio, message: NOT_ROAD };
  }

  if (roadRatio < 0.08 && skinRatio >= 0.03) {
    return { isRoadLike: false, skinRatio, roadRatio, greenRatio, message: NOT_ROAD };
  }

  return { isRoadLike: true, skinRatio, roadRatio, greenRatio };
}

export function isPortraitScene(scene: SceneAnalysis): boolean {
  return scene.skinRatio >= 0.05;
}

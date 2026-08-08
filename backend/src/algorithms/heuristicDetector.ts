import sharp from 'sharp';
import type { DetectionBox, DetectionResult, PotholeDetector } from './detector.js';

const GRID = 32; // downscale to GRID×GRID grayscale for the analysis
const DARK_RATIO = 0.75; // a cell counts as dark when luminance < median × DARK_RATIO
const MIN_CLUSTER_RATIO = 0.01; // the dark patch must cover ≥1% of the frame
const NEAR_BLACK_MEDIAN = 40; // frames this dark have no readable road baseline

/**
 * Heuristic pothole detector.
 *
 * Potholes are dark, roughly-contiguous patches against a lighter road surface.
 * The photo is downscaled to a GRID×GRID grayscale map, the median luminance is
 * taken as the "road" baseline, the largest connected cluster of cells notably
 * darker than that baseline is found, and it is scored on size + contrast.
 *
 * This is deliberately a stand-in for a real model: it needs no weights or
 * native dependencies, and it refuses to call a near-black frame a pothole.
 * Swap in a YOLO implementation of {@link PotholeDetector} when one is ready.
 */
export const heuristicDetector: PotholeDetector = {
  async detect(imageBuffer: Buffer): Promise<DetectionResult> {
    const grid = await toGrayGrid(imageBuffer);
    const median = medianValue(grid);

    // A frame this dark carries no usable road baseline — treat as unreadable.
    if (median < NEAR_BLACK_MEDIAN) {
      return { isPothole: false, confidence: 0.05, boundingBox: null };
    }

    const threshold = median * DARK_RATIO;
    const mask = new Uint8Array(grid.length);
    for (let i = 0; i < grid.length; i++) mask[i] = (grid[i] ?? 0) < threshold ? 1 : 0;

    const cluster = largestCluster(mask);
    const ratio = cluster.length / grid.length;

    if (ratio < MIN_CLUSTER_RATIO) {
      // Close but not quite — scale the near-miss into a low confidence.
      return { isPothole: false, confidence: 0.05 + Math.min(0.4, ratio * 10), boundingBox: null };
    }

    // Contrast: how much darker the patch is than the road baseline (0..~1).
    let clusterSum = 0;
    for (const idx of cluster) clusterSum += grid[idx] ?? 0;
    const clusterMean = clusterSum / cluster.length;
    const darkness = Math.min(1, Math.max(0, 1 - clusterMean / median));

    // Size: saturate at ~2.5% frame coverage so one patch cannot overshoot.
    const sizeScore = Math.min(1, ratio * 40);

    const confidence = Math.min(0.99, Math.max(0.5, 0.35 + 0.3 * darkness + 0.35 * sizeScore));

    return { isPothole: true, confidence, boundingBox: clusterBox(cluster) };
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Downscales to a GRID×GRID grayscale luminance map (stretch-fit → linear mapping). */
async function toGrayGrid(buffer: Buffer): Promise<Uint8Array> {
  const { data, info } = await sharp(buffer)
    .greyscale()
    .resize(GRID, GRID, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return new Uint8Array(data.buffer, data.byteOffset, info.width * info.height);
}

function medianValue(values: Uint8Array): number {
  const sorted = Array.from(values).sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Largest 4-connected cluster of set cells (flood fill), as a list of indices. */
function largestCluster(mask: Uint8Array): number[] {
  const visited = new Uint8Array(mask.length);
  const stack: number[] = [];
  let best: number[] = [];

  const tryPush = (n: number) => {
    if (mask[n] && !visited[n]) {
      visited[n] = 1;
      stack.push(n);
    }
  };

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;
    visited[start] = 1;
    stack.push(start);
    const component: number[] = [];
    while (stack.length) {
      const idx = stack.pop()!;
      component.push(idx);
      const row = (idx / GRID) | 0;
      const col = idx % GRID;
      if (col > 0) tryPush(idx - 1);
      if (col < GRID - 1) tryPush(idx + 1);
      if (row > 0) tryPush(idx - GRID);
      if (row < GRID - 1) tryPush(idx + GRID);
    }
    if (component.length > best.length) best = component;
  }
  return best;
}

/** Normalized bounding rectangle of the cluster cells. */
function clusterBox(cells: number[]): DetectionBox {
  let minRow = Infinity;
  let maxRow = -1;
  let minCol = Infinity;
  let maxCol = -1;
  for (const idx of cells) {
    const row = (idx / GRID) | 0;
    const col = idx % GRID;
    if (row < minRow) minRow = row;
    if (row > maxRow) maxRow = row;
    if (col < minCol) minCol = col;
    if (col > maxCol) maxCol = col;
  }
  return {
    x: minCol / GRID,
    y: minRow / GRID,
    width: (maxCol - minCol + 1) / GRID,
    height: (maxRow - minRow + 1) / GRID,
  };
}

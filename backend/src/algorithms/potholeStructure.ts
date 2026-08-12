/**
 * Geometry-based pothole validation on a downscaled grayscale grid.
 *
 * Real potholes are compact, sharp-edged dark holes on a lighter road surface.
 * This gate runs alongside the CNN so random photos, broad shadows, and thin
 * cracks cannot pass as detections when the network misfires.
 */
import type { DetectionBox } from './detector.js';

export const STRUCTURE_GRID = 64;
const DARK_RATIO = 0.72;
/** Dark patch must cover at least this fraction of the frame. */
const MIN_CLUSTER_RATIO = 0.005;
/** Broad shadows / whole-frame darkness must not qualify. */
const MAX_CLUSTER_RATIO = 0.22;
/** Cluster mean must be at least this many levels below the road median. */
const MIN_CLUSTER_DEPTH = 48;
const MIN_ROAD_MEDIAN = 90;
const MAX_ROAD_MEDIAN = 220;
/** Reject thin cracks / scattered noise — blob pixels vs bounding-box area. */
const MIN_BLOB_FILL = 0.38;
/** CNN activation boxes covering most of the frame are not localized potholes. */
export const MAX_BOX_AREA = 0.38;

export interface StructureResult {
  ok: boolean;
  median: number;
  depth: number;
  clusterRatio: number;
  message?: string;
}

function medianValue(values: Uint8Array): number {
  const sorted = Array.from(values).sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Largest 4-connected cluster of set cells (flood fill), as a list of indices. */
function largestCluster(mask: Uint8Array, grid: number): number[] {
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
      const row = (idx / grid) | 0;
      const col = idx % grid;
      if (col > 0) tryPush(idx - 1);
      if (col < grid - 1) tryPush(idx + 1);
      if (row > 0) tryPush(idx - grid);
      if (row < grid - 1) tryPush(idx + grid);
    }
    if (component.length > best.length) best = component;
  }
  return best;
}

function clusterBox(cells: number[], grid: number): DetectionBox {
  let minRow = Infinity;
  let maxRow = -1;
  let minCol = Infinity;
  let maxCol = -1;
  for (const idx of cells) {
    const row = (idx / grid) | 0;
    const col = idx % grid;
    if (row < minRow) minRow = row;
    if (row > maxRow) maxRow = row;
    if (col < minCol) minCol = col;
    if (col > maxCol) maxCol = col;
  }
  return {
    x: minCol / grid,
    y: minRow / grid,
    width: (maxCol - minCol + 1) / grid,
    height: (maxRow - minRow + 1) / grid,
  };
}

export function boxArea(box: DetectionBox): number {
  return box.width * box.height;
}

/** Validates that the image contains a pothole-shaped dark blob on road-like asphalt. */
export function analyzePotholeStructure(pixels255: Uint8Array, grid = STRUCTURE_GRID): StructureResult {
  const median = medianValue(pixels255);

  if (median < MIN_ROAD_MEDIAN || median > MAX_ROAD_MEDIAN) {
    return {
      ok: false,
      median,
      depth: 0,
      clusterRatio: 0,
      message:
        'No pothole detected in this image. Please upload a clear, close-up photo of the road hazard. The photo is too dark or overexposed to analyze reliably.',
    };
  }

  const threshold = median * DARK_RATIO;
  const mask = new Uint8Array(pixels255.length);
  for (let i = 0; i < pixels255.length; i++) mask[i] = (pixels255[i] ?? 0) < threshold ? 1 : 0;

  const cluster = largestCluster(mask, grid);
  const clusterRatio = cluster.length / pixels255.length;

  if (clusterRatio < MIN_CLUSTER_RATIO) {
    return {
      ok: false,
      median,
      depth: 0,
      clusterRatio,
      message:
        'No pothole detected in this image. Please upload a clear, close-up photo showing the pothole on the road surface.',
    };
  }

  if (clusterRatio > MAX_CLUSTER_RATIO) {
    return {
      ok: false,
      median,
      depth: 0,
      clusterRatio,
      message:
        'No pothole detected in this image. The dark area looks like a shadow or lighting effect, not a pothole.',
    };
  }

  let clusterSum = 0;
  for (const idx of cluster) clusterSum += pixels255[idx] ?? 0;
  const clusterMean = clusterSum / cluster.length;
  const depth = median - clusterMean;

  if (depth < MIN_CLUSTER_DEPTH) {
    return {
      ok: false,
      median,
      depth,
      clusterRatio,
      message:
        'No pothole detected in this image. No deep road defect was found — shadows or cracks alone are not enough.',
    };
  }

  const box = clusterBox(cluster, grid);
  const fill = clusterRatio / Math.max(box.width * box.height, 1e-6);
  if (fill < MIN_BLOB_FILL) {
    return {
      ok: false,
      median,
      depth,
      clusterRatio,
      message:
        'No pothole detected in this image. The dark features look like cracks or marks, not a pothole.',
    };
  }

  return { ok: true, median, depth, clusterRatio };
}

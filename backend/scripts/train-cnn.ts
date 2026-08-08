/**
 * Trains the from-scratch CNN and writes `backend/data/cnn-weights.json`.
 *
 * There is no labeled pothole dataset bundled with this repo, so training uses
 * an auto-generated synthetic dataset that captures the discriminative visual
 * cues of a pothole: compact, sharp-edged, dark blobs against a lighter road
 * surface. Severity is encoded by blob depth + size. Negatives are clean road,
 * broad *smooth* shadows, thin low-contrast cracks, and painted lane markings.
 *
 * Run:  npx tsx scripts/train-cnn.ts        (from backend/)
 *
 * The same script can retrain on a real dataset: write your images as 64×64
 * grayscale (values 0..255) with labels 0..4 (NONE/LOW/MEDIUM/HIGH/CRITICAL)
 * and swap the data source.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CnnModel, CLASSES, INPUT_SIZE } from '../src/algorithms/cnn/model.js';
import { trainOnBatch } from '../src/algorithms/cnn/backward.js';
import { argmax, mulberry32 } from '../src/algorithms/cnn/tensor.js';

const OUT_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/cnn-weights.json');
const S = INPUT_SIZE; // square input size

const clamp = (v: number) => Math.max(0, Math.min(255, v));

interface BlobSpec {
  count: [number, number];
  radius: [number, number];
  depth: [number, number]; // how much darker than the road (0..255)
}

/**
 * Blob parameters per severity class (1..4 = LOW..CRITICAL), tuned for a 32×32
 * frame. The bands are NON-OVERLAPPING in both radius and depth, with a clear
 * gap between adjacent classes, so the CNN can separate severity reliably:
 *
 *   class  blob radius ×count  depth    ≈ dark pixels   discriminant
 *   LOW    5–6 ×1             60–75     ~60             small pothole
 *   MEDIUM 8–10 ×1            105–120   ~260            bigger, clearly deeper
 *   HIGH   11–13 ×2           140–155   ~900            two large, very deep
 *   CRIT   15–17 ×3           185–215   ~1800           three huge, near-black
 *
 * Counts are fixed (not random) so a "big LOW" can never look like a "small
 * CRITICAL" — the class is ambiguous only in the exact image sense, not in a
 * feature sense. Every class starts at radius ≥4 so a pothole spans several
 * post-pooling cells (a 2–3 px blob is sub-pixel noise after two max-pools and
 * is what made the old LOW/MEDIUM indistinguishable from a shadow). Depth gaps
 * between adjacent bands are 25–30, well above the NONE shadow ceiling, so the
 * peak-darkness branch separates the mid classes while the mean branch
 * separates NONE/LOW by dark area.
 */
const BLOBS: Record<number, BlobSpec> = {
  1: { count: [1, 1], radius: [5, 6], depth: [60, 75] },
  2: { count: [1, 1], radius: [8, 10], depth: [105, 120] },
  3: { count: [2, 2], radius: [11, 13], depth: [140, 155] },
  4: { count: [3, 3], radius: [15, 17], depth: [185, 215] },
};

function drawRoadBase(rand: () => number): Float32Array {
  const img = new Float32Array(S * S);
  // Tight base (150–158) so a blob's darkness is an ABSOLUTE depth signal rather
  // than being confounded by how bright the road happened to be.
  const base = 150 + rand() * 8; // road gray
  for (let i = 0; i < S * S; i++) img[i] = clamp(base + (rand() - 0.5) * 18);
  // faint horizontal asphalt streaks
  for (let y = 0; y < S; y += 2) {
    for (let x = 0; x < S; x++) img[y * S + x] = clamp((img[y * S + x] ?? 0) + (rand() - 0.5) * 9);
  }
  return img;
}

/** A crisp-edged dark ellipse with a depth gradient toward its center. */
function drawBlob(img: Float32Array, cx: number, cy: number, r: number, depth: number, rand: () => number): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    if (y < 0 || y >= S) continue;
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || x >= S) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r) {
        const t = d / r; // 0 = center, 1 = rim
        const darkening = depth * (1 - t * t * 0.7) + (t > 0.8 ? depth * 0.25 : 0);
        img[y * S + x] = clamp((img[y * S + x] ?? 0) - darkening + (rand() - 0.5) * 13);
      }
    }
  }
}

function renderPothole(rand: () => number, label: number): Float32Array {
  const img = drawRoadBase(rand);
  const spec = BLOBS[label]!;
  const count = spec.count[0] + Math.floor(rand() * (spec.count[1] - spec.count[0] + 1));
  // Margin of 5 keeps large blobs away from the frame edge so a CRITICAL never
  // loses most of its area to clipping (that was collapsing HIGH↔CRITICAL).
  for (let b = 0; b < count; b++) {
    const cx = 5 + rand() * (S - 10);
    const cy = 5 + rand() * (S - 10);
    const r = spec.radius[0] + rand() * (spec.radius[1] - spec.radius[0]);
    const depth = spec.depth[0] + rand() * (spec.depth[1] - spec.depth[0]);
    drawBlob(img, cx, cy, r, depth, rand);
  }
  return img;
}

/** A thin, low-contrast crack polyline — should be classified NONE. */
function drawCrack(img: Float32Array, rand: () => number): void {
  let x = 3 + rand() * (S - 6);
  let y = 3 + rand() * (S - 6);
  const steps = 8 + Math.floor(rand() * 10);
  const contrast = 4 + rand() * 4; // max 8 — a curled crack can't stack to a LOW-depth dark pixel
  for (let s = 0; s < steps; s++) {
    const xi = Math.round(x), yi = Math.round(y);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const px = xi + dx, py = yi + dy;
        if (px >= 0 && px < S && py >= 0 && py < S) {
          img[py * S + px] = clamp((img[py * S + px] ?? 0) - contrast);
        }
      }
    }
    x += (rand() - 0.5) * 5;
    y += (rand() - 0.5) * 5;
  }
}

function renderNone(rand: () => number): Float32Array {
  const img = drawRoadBase(rand);
  const kind = rand();
  if (kind < 0.5) {
    // Broad, SMOOTH shadow — mild radial gradient (the pothole discriminator:
    // shadows are gentle, potholes are sharp-edged dark holes). Strength is kept
    // well below LOW's 55+ depth so the peak-darkness feature can separate them.
    const cx = 6 + rand() * (S - 12);
    const cy = 6 + rand() * (S - 12);
    const r = 8 + rand() * 10;
    const strength = 4 + rand() * 6; // max 10 — stays well below LOW's 55+ depth
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r) {
          const t = d / r;
          img[y * S + x] = clamp((img[y * S + x] ?? 0) - strength * (1 - t * t));
        }
      }
    }
  } else if (kind < 0.78) {
    drawCrack(img, rand);
  } else {
    // Painted lane marking — bright rectangle.
    const px = 3 + rand() * (S - 14);
    const py = 3 + rand() * (S - 8);
    const pw = 4 + rand() * 7;
    const ph = 2 + rand() * 3;
    for (let y = Math.floor(py); y < py + ph; y++) {
      for (let x = Math.floor(px); x < px + pw; x++) {
        if (x < 0 || x >= S || y < 0 || y >= S) continue;
        img[y * S + x] = clamp((img[y * S + x] ?? 0) + 28 + rand() * 26);
      }
    }
  }
  return img;
}

interface Sample {
  input: Float32Array;
  label: number;
}

function generateSet(n: number, seed: number, augment = false): Sample[] {
  const rand = mulberry32(seed);
  const samples: Sample[] = [];
  for (let i = 0; i < n; i++) {
    const label = Math.floor(rand() * CLASSES.length); // 0..4
    let raw = label === 0 ? renderNone(rand) : renderPothole(rand, label);
    // Horizontal flip — roads are symmetric, so this is a safe augmentation.
    if (augment && rand() < 0.5) {
      const flipped = new Float32Array(raw.length);
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) flipped[y * S + x] = raw[y * S + (S - 1 - x)] ?? 0;
      }
      raw = flipped;
    }
    const input = new Float32Array(S * S);
    for (let j = 0; j < raw.length; j++) input[j] = (raw[j] ?? 0) / 255;
    samples.push({ input, label });
  }
  return samples;
}

function evaluate(model: CnnModel, samples: Sample[]): { accuracy: number; loss: number } {
  let correct = 0;
  let lossSum = 0;
  for (const s of samples) {
    const cache = model.forward(s.input);
    const probs = cache.probs;
    if (argmax(probs) === s.label) correct++;
    lossSum += -Math.log(Math.max(probs[s.label] ?? 1e-9, 1e-9));
  }
  return { accuracy: correct / samples.length, loss: lossSum / samples.length };
}

/** Prints a per-class confusion matrix so a low accuracy is diagnosable. */
function printConfusion(model: CnnModel, samples: Sample[]): void {
  const n = CLASSES.length;
  const cm: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (const s of samples) {
    const predicted = argmax(model.forward(s.input).probs);
    cm[s.label]![predicted] = (cm[s.label]![predicted] ?? 0) + 1;
  }
  const pad = (s: string, w: number) => s.padStart(w);
  const header = pad('true\\pred', 12) + CLASSES.map((c) => pad(c, 8)).join('');
  const rows = cm.map((row, i) => {
    const total = row.reduce((a, b) => a + b, 0);
    const correctPct = total ? ((row[i] ?? 0) / total) * 100 : 0;
    return pad(CLASSES[i] ?? '', 12) + row.map((v) => pad(String(v), 8)).join('') + pad(`${correctPct.toFixed(0)}%`, 8);
  });
  console.log(header);
  console.log(rows.join('\n'));
}

function shuffle<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

async function main(): Promise<void> {
  const TRAIN_N = 2000;
  const VAL_N = 500;
  const BATCH = 48;
  const EPOCHS = 80;
  const LR = 0.01;
  const TARGET_ACC = 0.95;

  console.log(`Training CNN on synthetic dataset (${TRAIN_N} train / ${VAL_N} val, input ${S}×${S})`);
  const train = generateSet(TRAIN_N, 1, true);
  const val = generateSet(VAL_N, 2);

  const model = new CnnModel(1234);
  const indices = Array.from({ length: TRAIN_N }, (_, i) => i);
  const rand = mulberry32(99);

  let bestAcc = 0;
  let bestJson: ReturnType<CnnModel['toJSON']> | null = null;
  const startedAt = Date.now();

  for (let epoch = 1; epoch <= EPOCHS; epoch++) {
    shuffle(indices, rand);
    let lossSum = 0;
    let batches = 0;
    for (let s = 0; s < TRAIN_N; s += BATCH) {
      const ids = indices.slice(s, Math.min(s + BATCH, TRAIN_N));
      const inputs = ids.map((i) => train[i]!.input);
      const labels = ids.map((i) => train[i]!.label);
      lossSum += trainOnBatch(model, inputs, labels, LR);
      batches++;
    }
    const { accuracy, loss } = evaluate(model, val);
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
    console.log(
      `epoch ${epoch}/${EPOCHS}  trainLoss=${(lossSum / batches).toFixed(4)}  ` +
        `valLoss=${loss.toFixed(4)}  valAcc=${(accuracy * 100).toFixed(1)}%  (${elapsed}s)`
    );
    if (accuracy > bestAcc) {
      bestAcc = accuracy;
      bestJson = model.toJSON();
    }
    if (accuracy >= TARGET_ACC) break;
  }

  if (!bestJson) throw new Error('Training produced no weights — this should never happen');
  console.log(`\nBest validation accuracy: ${(bestAcc * 100).toFixed(1)}%`);
  printConfusion(model, val);

  if (bestAcc < 0.9) {
    console.warn('WARNING: validation accuracy below 90% — the dataset is harder than expected. Saving anyway.');
  }

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(bestJson, null, 2), 'utf8');
  console.log(`Wrote weights to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

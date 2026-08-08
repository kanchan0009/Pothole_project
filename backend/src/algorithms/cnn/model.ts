/**
 * The CNN model itself — fixed architecture, real parameters, real training.
 *
 * Architecture (input 32×32 grayscale, values normalized to [0,1]):
 *
 *   conv1  (32 filters, 3×3, SAME) + ReLU  → 32×32×32
 *   maxpool 2×2                            → 16×16×32
 *   conv2  (48 filters, 3×3, SAME) + ReLU  → 16×16×48
 *   maxpool 2×2                            → 8×8×48
 *   global avg pool ⊕ global top-3 pool    → 96  (extent ⊕ peak)
 *   ⊕ input depth-floor (mean of darkest 3)→ 1   (deepest point)
 *   dense 96→64 + ReLU                     → 64
 *   dense 64→5                             → logits
 *   softmax                                → [NONE, LOW, MEDIUM, HIGH, CRITICAL]
 *
 * The pooling head concatenates the per-channel MEAN and MAX of the conv2
 * output. Average pooling measures how much of the image is "hole"; max
 * pooling captures the peak darkness (a pothole's deepest point). A small dark
 * pothole and a broad light shadow are confounded under mean alone — the max
 * branch is what separates depth levels, so the severity classes are actually
 * separable.
 *
 * The input depth-floor branch exists because ReLU + max-pooling structurally
 * erases darkness: dark pixels produce LOW post-ReLU activations, so every
 * max-pool surfaces a brighter cell and a small blob never reaches the conv2
 * peak branch. Reading the darkest pixels straight off the input recovers the
 * one signal pooling destroys — a broad soft shadow is only ~9/255 dark, any
 * pothole is 60+ darker. This is what separates a small deep hole from clean
 * road, which GAP alone cannot.
 *
 * ~21k parameters total — CPU inference is instant. Weights are trained with
 * Adam (backprop) by `scripts/train-cnn.ts` and shipped in
 * `backend/data/cnn-weights.json`, so runtime inference is fully offline.
 */
import { argmax, heInit, meanOfSmallest, mulberry32 } from './tensor.js';
import {
  conv2dRelu,
  conv2dReluBackward,
  crossEntropyLoss,
  dense,
  denseBackward,
  globalAvgPool,
  globalAvgPoolBackward,
  globalTopKPool,
  globalTopKPoolBackward,
  maxPool2d,
  maxPool2dBackward,
  softmax,
  softTarget,
  softmaxGrad,
} from './ops.js';

export const CLASSES = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type CnnClass = (typeof CLASSES)[number];

export const INPUT_SIZE = 32;
export const CONV1_OUT = 32;
export const CONV2_OUT = 48;
export const KERNEL = 3;
export const HIDDEN = 64;
export const NUM_CLASSES = CLASSES.length;
/** How many peak cells each channel's "max" branch averages over. */
export const TOP_K = 3;
/** How many darkest input pixels the depth-floor branch averages over. */
export const DEPTH_FLOOR_K = 3;
/**
 * Feature vector length = GAP (per-channel mean) ⊕ peak (per-channel top-k
 * mean) ⊕ input depth-floor (mean of the k darkest pixels).
 */
export const FEATURES = CONV2_OUT * 2 + 1;

/** Every tensor the forward pass produces, cached so backward can reuse it. */
export interface Cache {
  input: Float32Array; // 32×32
  y1m: Uint8Array; // conv1 ReLU mask
  p1: Float32Array; // 16×16×12 post-pool
  p1a: Int32Array; // pool1 argmax
  y2m: Uint8Array; // conv2 ReLU mask
  p2: Float32Array; // 8×8×24 post-pool
  p2a: Int32Array; // pool2 argmax
  p2Peak: Int32Array; // top-k peak-pool indices (TOP_K per conv2 channel)
  features: Float32Array; // 97 = [GAP(48), peak(48), depth-floor(1)]
  h1: Float32Array; // hidden activations (24)
  h1m: Uint8Array; // hidden ReLU mask
  logits: Float32Array; // 5
  probs: Float32Array; // 5
}

export interface CnnWeightsJson {
  version: 1;
  conv1: { w: number[]; b: number[] };
  conv2: { w: number[]; b: number[] };
  fc1: { w: number[]; b: number[] };
  fc2: { w: number[]; b: number[] };
}

export class CnnModel {
  conv1w: Float32Array = new Float32Array(0);
  conv1b: Float32Array = new Float32Array(0);
  conv2w: Float32Array = new Float32Array(0);
  conv2b: Float32Array = new Float32Array(0);
  fc1w: Float32Array = new Float32Array(0);
  fc1b: Float32Array = new Float32Array(0);
  fc2w: Float32Array = new Float32Array(0);
  fc2b: Float32Array = new Float32Array(0);

  /** Adam state, parallel to {@link params}. */
  private m: Float32Array[] = [];
  private v: Float32Array[] = [];
  private stepCount = 0;
  /** Accumulated gradients over the current batch, parallel to {@link params}. */
  private grads: Float32Array[] = [];

  constructor(seed = 42) {
    const rand = mulberry32(seed);
    // conv1: [outC=32][inC=1][3][3]
    this.conv1w = heInit(CONV1_OUT * 1 * KERNEL * KERNEL, 1 * KERNEL * KERNEL, rand);
    this.conv1b = new Float32Array(CONV1_OUT);
    // conv2: [outC=24][inC=12][3][3]
    this.conv2w = heInit(CONV2_OUT * CONV1_OUT * KERNEL * KERNEL, CONV1_OUT * KERNEL * KERNEL, rand);
    this.conv2b = new Float32Array(CONV2_OUT);
    // fc1: [HIDDEN=64][FEATURES=97]
    this.fc1w = heInit(HIDDEN * FEATURES, FEATURES, rand);
    this.fc1b = new Float32Array(HIDDEN);
    // fc2: [5][24]
    this.fc2w = heInit(NUM_CLASSES * HIDDEN, HIDDEN, rand);
    this.fc2b = new Float32Array(NUM_CLASSES);
    this.initOptimizer();
  }

  /** All trainable parameter arrays, in a fixed order (0..7). */
  params(): Float32Array[] {
    return [this.conv1w, this.conv1b, this.conv2w, this.conv2b, this.fc1w, this.fc1b, this.fc2w, this.fc2b];
  }

  private initOptimizer(): void {
    const ps = this.params();
    this.m = ps.map((p) => new Float32Array(p.length));
    this.v = ps.map((p) => new Float32Array(p.length));
    this.grads = ps.map((p) => new Float32Array(p.length));
  }

  // -------------------------------------------------------------------------
  // Forward
  // -------------------------------------------------------------------------

  forward(input: Float32Array): Cache {
    const c1 = conv2dRelu(input, 1, INPUT_SIZE, INPUT_SIZE, this.conv1w, this.conv1b, CONV1_OUT, KERNEL);
    const p1 = maxPool2d(c1.output, INPUT_SIZE, INPUT_SIZE, CONV1_OUT);
    const c2 = conv2dRelu(p1.output, CONV1_OUT, INPUT_SIZE / 2, INPUT_SIZE / 2, this.conv2w, this.conv2b, CONV2_OUT, KERNEL);
    const p2 = maxPool2d(c2.output, INPUT_SIZE / 4, INPUT_SIZE / 4, CONV2_OUT);
    // Pooling head: concat per-channel mean (GAP) and per-channel top-k mean
    // (the "peak" branch — extent ⊕ peak darkness separates a small deep hole
    // from a broad shallow shadow).
    const gap = globalAvgPool(p2.output, INPUT_SIZE / 4, INPUT_SIZE / 4, CONV2_OUT);
    const peak = globalTopKPool(p2.output, INPUT_SIZE / 4, INPUT_SIZE / 4, CONV2_OUT, TOP_K);
    const features = new Float32Array(FEATURES);
    features.set(gap, 0);
    features.set(peak.output, CONV2_OUT);
    // Depth floor: mean of the darkest input pixels. ReLU + max-pooling erase
    // darkness (see header), so a small blob never survives to the peak branch.
    // This recovers that signal straight off the source — a shallow shadow is
    // only ~9/255 dark, any pothole is 60+ darker.
    features[FEATURES - 1] = meanOfSmallest(input, DEPTH_FLOOR_K);
    const preH = dense(features, this.fc1w, this.fc1b);
    const h1 = new Float32Array(preH.length);
    const h1m = new Uint8Array(preH.length);
    for (let i = 0; i < preH.length; i++) {
      h1[i] = preH[i]! > 0 ? preH[i]! : 0;
      h1m[i] = preH[i]! > 0 ? 1 : 0;
    }
    const logits = dense(h1, this.fc2w, this.fc2b);
    const probs = softmax(logits);

    return {
      input,
      y1m: c1.mask,
      p1: p1.output,
      p1a: p1.argmax,
      y2m: c2.mask,
      p2: p2.output,
      p2a: p2.argmax,
      p2Peak: peak.indices,
      features,
      h1,
      h1m,
      logits,
      probs,
    };
  }

  /** Convenience wrapper — full forward pass → class probabilities. */
  predict(input: Float32Array): { probs: Float32Array; predictedClass: number } {
    const cache = this.forward(input);
    return { probs: cache.probs, predictedClass: argmax(cache.probs) };
  }

  // -------------------------------------------------------------------------
  // Backward (backprop through the whole net) + Adam step
  // -------------------------------------------------------------------------

  /**
   * Backpropagates cross-entropy loss for one sample against an ordinal
   * (Gaussian) soft target for `label`. With `accumulate` (the default)
   * gradients sum into the batch buffer; call {@link zeroGrad} first, then
   * {@link step} with the batch size. Returns the sample loss.
   */
  backward(cache: Cache, label: number, accumulate = true): number {
    const target = softTarget(label, NUM_CLASSES);
    const loss = crossEntropyLoss(cache.probs, target);
    const dLogits = softmaxGrad(cache.probs, target);

    const g2 = denseBackward(cache.h1, dLogits, this.fc2w);
    const dH = new Float32Array(cache.h1.length);
    for (let i = 0; i < dH.length; i++) dH[i] = cache.h1m[i] ? (g2.dInput[i] ?? 0) : 0;
    const g1 = denseBackward(cache.features, dH, this.fc1w);

    // Split the FC1 gradient back through the two pooling branches and add.
    // The depth-floor feature (index CONV2_OUT*2) is read straight off the
    // input — no learned parameters — so its gradient is intentionally dropped.
    const dGap = g1.dInput.subarray(0, CONV2_OUT);
    const dPeak = g1.dInput.subarray(CONV2_OUT, CONV2_OUT * 2);
    const dp2Gap = globalAvgPoolBackward(dGap, INPUT_SIZE / 4, INPUT_SIZE / 4, CONV2_OUT);
    const dp2Peak = globalTopKPoolBackward(dPeak, cache.p2Peak, TOP_K, cache.p2.length);
    const dp2 = new Float32Array(cache.p2.length);
    for (let i = 0; i < dp2.length; i++) dp2[i] = (dp2Gap[i] ?? 0) + (dp2Peak[i] ?? 0);
    const da2 = maxPool2dBackward(dp2, cache.p2a, (INPUT_SIZE / 2) * (INPUT_SIZE / 2) * CONV2_OUT);
    const gConv2 = conv2dReluBackward(cache.p1, CONV1_OUT, INPUT_SIZE / 2, INPUT_SIZE / 2, this.conv2w, CONV2_OUT, KERNEL, da2, cache.y2m);

    const da1 = maxPool2dBackward(gConv2.dInput, cache.p1a, INPUT_SIZE * INPUT_SIZE * CONV1_OUT);
    const gConv1 = conv2dReluBackward(cache.input, 1, INPUT_SIZE, INPUT_SIZE, this.conv1w, CONV1_OUT, KERNEL, da1, cache.y1m);

    const grads = [gConv1.dW, gConv1.dB, gConv2.dW, gConv2.dB, g1.dW, g1.dB, g2.dW, g2.dB];
    const ps = this.params();
    for (let p = 0; p < ps.length; p++) {
      const g = grads[p]!;
      const target = this.grads[p]!;
      if (accumulate) {
        for (let i = 0; i < g.length; i++) target[i] = (target[i] ?? 0) + (g[i] ?? 0);
      } else {
        target.set(g);
      }
    }
    return loss;
  }

  zeroGrad(): void {
    for (const g of this.grads) g.fill(0);
  }

  /** Adam update on the accumulated gradients (averaged by `batchSize`), then clears them. */
  step(learningRate: number, batchSize: number): void {
    this.stepCount++;
    const beta1 = 0.9;
    const beta2 = 0.999;
    const eps = 1e-8;
    const b1t = 1 - Math.pow(beta1, this.stepCount);
    const b2t = 1 - Math.pow(beta2, this.stepCount);
    const ps = this.params();
    for (let p = 0; p < ps.length; p++) {
      const data = ps[p]!;
      const grad = this.grads[p]!;
      const m = this.m[p]!;
      const v = this.v[p]!;
      for (let i = 0; i < data.length; i++) {
        const g = (grad[i] ?? 0) / batchSize;
        m[i] = beta1 * (m[i] ?? 0) + (1 - beta1) * g;
        v[i] = beta2 * (v[i] ?? 0) + (1 - beta2) * g * g;
        const mHat = (m[i] ?? 0) / b1t;
        const vHat = (v[i] ?? 0) / b2t;
        data[i] = (data[i] ?? 0) - learningRate * (mHat / (Math.sqrt(vHat) + eps));
      }
    }
    this.zeroGrad();
  }

  // -------------------------------------------------------------------------
  // Class activation map (CNN-based localization)
  // -------------------------------------------------------------------------

  /**
   * Gradient-free class activation for class `cls`: the 8×8 map
   *   CAM(y,x) = Σ_f classWeight[cls][f] · conv2_out(y,x,f)
   * where `classWeight` is the FC1→FC2 path projected back onto the conv2
   * features via the GAP half of the pooling head (a linear approximation of
   * the two dense layers — standard CAM practice). Only the GAP half has a
   * spatial map; the peak half is a handful of cells per channel, so it is excluded.
   * Used to derive a normalized bounding box for the annotated preview.
   */
  classActivation(cache: Cache, cls: number): Float32Array {
    const size = INPUT_SIZE / 4; // 8
    const classWeight = new Float32Array(CONV2_OUT);
    for (let f = 0; f < CONV2_OUT; f++) {
      let s = 0;
      for (let h = 0; h < HIDDEN; h++) {
        s += (this.fc2w[cls * HIDDEN + h] ?? 0) * (this.fc1w[h * FEATURES + f] ?? 0);
      }
      classWeight[f] = s;
    }
    const cam = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let s = 0;
        for (let f = 0; f < CONV2_OUT; f++) {
          s += (cache.p2[(y * size + x) * CONV2_OUT + f] ?? 0) * (classWeight[f] ?? 0);
        }
        cam[y * size + x] = s;
      }
    }
    return cam;
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  toJSON(): CnnWeightsJson {
    return {
      version: 1,
      conv1: { w: Array.from(this.conv1w), b: Array.from(this.conv1b) },
      conv2: { w: Array.from(this.conv2w), b: Array.from(this.conv2b) },
      fc1: { w: Array.from(this.fc1w), b: Array.from(this.fc1b) },
      fc2: { w: Array.from(this.fc2w), b: Array.from(this.fc2b) },
    };
  }

  static fromJSON(json: CnnWeightsJson): CnnModel {
    const model = new CnnModel();
    model.conv1w = Float32Array.from(json.conv1.w);
    model.conv1b = Float32Array.from(json.conv1.b);
    model.conv2w = Float32Array.from(json.conv2.w);
    model.conv2b = Float32Array.from(json.conv2.b);
    model.fc1w = Float32Array.from(json.fc1.w);
    model.fc1b = Float32Array.from(json.fc1.b);
    model.fc2w = Float32Array.from(json.fc2.w);
    model.fc2b = Float32Array.from(json.fc2.b);
    model.initOptimizer();
    return model;
  }
}

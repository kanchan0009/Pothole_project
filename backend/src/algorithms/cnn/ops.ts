/**
 * The CNN's primitive kernels — convolution, max-pooling, global average
 * pooling, dense, softmax — each with its forward pass and exact backward
 * (gradient) pass. These are real, from-scratch implementations: no library,
 * no native dependency. Backprop uses the standard chain rule; correctness is
 * pinned by finite-difference gradient checks in `tests/unit/cnn/backward.test.ts`.
 */
import { id3 } from './tensor.js';

const relu = (x: number): number => (x > 0 ? x : 0);

// ---------------------------------------------------------------------------
// Convolution (3×3, stride 1, SAME padding) + ReLU
// ---------------------------------------------------------------------------

export interface ConvForward {
  /** Activated (post-ReLU) output, shape [inH, inW, outC]. */
  output: Float32Array;
  /** 1 where the pre-activation was > 0 — the ReLU mask used by backward. */
  mask: Uint8Array;
}

/**
 * Forward: `output = relu(input ⊛ W + b)` with SAME padding and stride 1.
 * `weights` is `[outC][inC][k][k]`, `bias` is `[outC]`.
 */
export function conv2dRelu(
  input: Float32Array,
  inC: number,
  inH: number,
  inW: number,
  weights: Float32Array,
  bias: Float32Array,
  outC: number,
  k: number
): ConvForward {
  const outH = inH;
  const outW = inW;
  const output = new Float32Array(outH * outW * outC);
  const mask = new Uint8Array(outH * outW * outC);
  const pad = (k - 1) >> 1;

  for (let oc = 0; oc < outC; oc++) {
    const b = bias[oc] ?? 0;
    for (let oh = 0; oh < outH; oh++) {
      for (let ow = 0; ow < outW; ow++) {
        let sum = b;
        for (let ic = 0; ic < inC; ic++) {
          for (let kh = 0; kh < k; kh++) {
            const ih = oh + kh - pad;
            if (ih < 0 || ih >= inH) continue;
            for (let kw = 0; kw < k; kw++) {
              const iw = ow + kw - pad;
              if (iw < 0 || iw >= inW) continue;
              const wIdx = ((oc * inC + ic) * k + kh) * k + kw;
              sum += (input[id3(ih, iw, ic, inW, inC)] ?? 0) * (weights[wIdx] ?? 0);
            }
          }
        }
        const oIdx = id3(oh, ow, oc, outW, outC);
        output[oIdx] = relu(sum);
        mask[oIdx] = sum > 0 ? 1 : 0;
      }
    }
  }
  return { output, mask };
}

export interface ConvGrads {
  dW: Float32Array;
  dB: Float32Array;
  dInput: Float32Array;
}

/**
 * Backward through the conv+ReLU pair.
 * `dOutput` is the gradient w.r.t. the *activated* output; the ReLU mask is
 * applied here, so the returned gradients are exactly ∂loss/∂W, ∂loss/∂b and
 * ∂loss/∂input for the full conv+ReLU block.
 */
export function conv2dReluBackward(
  input: Float32Array,
  inC: number,
  inH: number,
  inW: number,
  weights: Float32Array,
  outC: number,
  k: number,
  dOutput: Float32Array,
  mask: Uint8Array
): ConvGrads {
  const outH = inH;
  const outW = inW;
  const dW = new Float32Array(weights.length);
  const dB = new Float32Array(outC);
  const dInput = new Float32Array(input.length);
  const pad = (k - 1) >> 1;

  for (let oc = 0; oc < outC; oc++) {
    let dBsum = 0;
    for (let oh = 0; oh < outH; oh++) {
      for (let ow = 0; ow < outW; ow++) {
        const oIdx = id3(oh, ow, oc, outW, outC);
        const dY = mask[oIdx] ? (dOutput[oIdx] ?? 0) : 0;
        if (dY === 0) continue;
        dBsum += dY;
        for (let ic = 0; ic < inC; ic++) {
          for (let kh = 0; kh < k; kh++) {
            const ih = oh + kh - pad;
            if (ih < 0 || ih >= inH) continue;
            for (let kw = 0; kw < k; kw++) {
              const iw = ow + kw - pad;
              if (iw < 0 || iw >= inW) continue;
              const iIdx = id3(ih, iw, ic, inW, inC);
              const wIdx = ((oc * inC + ic) * k + kh) * k + kw;
              dW[wIdx] = (dW[wIdx] ?? 0) + dY * (input[iIdx] ?? 0);
              dInput[iIdx] = (dInput[iIdx] ?? 0) + dY * (weights[wIdx] ?? 0);
            }
          }
        }
      }
    }
    dB[oc] = dBsum;
  }
  return { dW, dB, dInput };
}

// ---------------------------------------------------------------------------
// Max pooling (2×2, stride 2)
// ---------------------------------------------------------------------------

export interface PoolForward {
  output: Float32Array;
  /** Flat index (into the input volume) of the max element per output cell. */
  argmax: Int32Array;
}

/** Forward 2×2 max pool. `input` is [H, W, C]; output is [H/2, W/2, C]. */
export function maxPool2d(
  input: Float32Array,
  H: number,
  W: number,
  C: number,
  pool = 2
): PoolForward {
  const outH = H / pool;
  const outW = W / pool;
  const output = new Float32Array(outH * outW * C);
  const argmax = new Int32Array(outH * outW * C);
  for (let c = 0; c < C; c++) {
    for (let oh = 0; oh < outH; oh++) {
      for (let ow = 0; ow < outW; ow++) {
        let best = -Infinity;
        let bestIdx = 0;
        for (let dy = 0; dy < pool; dy++) {
          for (let dx = 0; dx < pool; dx++) {
            const iIdx = id3(oh * pool + dy, ow * pool + dx, c, W, C);
            const v = input[iIdx] ?? 0;
            if (v > best) {
              best = v;
              bestIdx = iIdx;
            }
          }
        }
        const oIdx = id3(oh, ow, c, outW, C);
        output[oIdx] = best;
        argmax[oIdx] = bestIdx;
      }
    }
  }
  return { output, argmax };
}

/** Scatter each output gradient to the argmax input cell. */
export function maxPool2dBackward(
  dOutput: Float32Array,
  argmax: Int32Array,
  inputLen: number
): Float32Array {
  const dInput = new Float32Array(inputLen);
  for (let i = 0; i < argmax.length; i++) {
    dInput[argmax[i]!] = (dInput[argmax[i]!] ?? 0) + (dOutput[i] ?? 0);
  }
  return dInput;
}

// ---------------------------------------------------------------------------
// Global average pooling — [H, W, C] → [C]
// ---------------------------------------------------------------------------

/** Mean-pool over the spatial dimensions. */
export function globalAvgPool(input: Float32Array, H: number, W: number, C: number): Float32Array {
  const features = new Float32Array(C);
  const n = H * W;
  for (let c = 0; c < C; c++) {
    let s = 0;
    for (let h = 0; h < H; h++) {
      for (let w = 0; w < W; w++) s += input[id3(h, w, c, W, C)] ?? 0;
    }
    features[c] = s / n;
  }
  return features;
}

/** Spread each feature gradient evenly back over its spatial cells. */
export function globalAvgPoolBackward(
  dFeatures: Float32Array,
  H: number,
  W: number,
  C: number
): Float32Array {
  const dInput = new Float32Array(H * W * C);
  const n = H * W;
  for (let c = 0; c < C; c++) {
    const d = (dFeatures[c] ?? 0) / n;
    for (let h = 0; h < H; h++) {
      for (let w = 0; w < W; w++) dInput[id3(h, w, c, W, C)] = d;
    }
  }
  return dInput;
}

// ---------------------------------------------------------------------------
// Global max pooling — the "peak" partner of average pooling
// ---------------------------------------------------------------------------

export interface GlobalMaxPoolForward {
  output: Float32Array;
  /** Flat index into the input volume of the max cell per channel. */
  argmax: Int32Array;
}

/** Per-channel spatial max. `input` is [H, W, C]; output is [C]. */
export function globalMaxPool(input: Float32Array, H: number, W: number, C: number): GlobalMaxPoolForward {
  const output = new Float32Array(C);
  const argmax = new Int32Array(C);
  for (let c = 0; c < C; c++) {
    let best = -Infinity;
    let bestIdx = 0;
    for (let h = 0; h < H; h++) {
      for (let w = 0; w < W; w++) {
        const idx = id3(h, w, c, W, C);
        const v = input[idx] ?? 0;
        if (v > best) {
          best = v;
          bestIdx = idx;
        }
      }
    }
    output[c] = best;
    argmax[c] = bestIdx;
  }
  return { output, argmax };
}

/** Routes each channel's gradient to the argmax cell. */
export function globalMaxPoolBackward(
  dOutput: Float32Array,
  argmax: Int32Array,
  inputLen: number
): Float32Array {
  const dInput = new Float32Array(inputLen);
  for (let c = 0; c < dOutput.length; c++) {
    dInput[argmax[c]!] = (dInput[argmax[c]!] ?? 0) + (dOutput[c] ?? 0);
  }
  return dInput;
}

// ---------------------------------------------------------------------------
// Global top-k mean pooling — a "peak" branch with a dense gradient.
//
// Plain max pooling routes each channel's gradient to a single pixel. On a
// noisy 8×8 map that is dangerously sparse (and if the argmax lands on a
// bright road pixel, the pothole gets no gradient at all that step). Averaging
// the top-k activations keeps the peak emphasis but spreads gradient over k
// cells per channel, so training signal reaches the blob reliably.
// ---------------------------------------------------------------------------

export interface GlobalTopKForward {
  output: Float32Array;
  /** Per-channel indices of the top-k cells (row-major, sorted by value desc). */
  indices: Int32Array;
  k: number;
}

/** Per-channel mean of the top-`k` spatial activations. */
export function globalTopKPool(
  input: Float32Array,
  H: number,
  W: number,
  C: number,
  k = 3
): GlobalTopKForward {
  const output = new Float32Array(C);
  const indices = new Int32Array(C * k);
  for (let c = 0; c < C; c++) {
    // Collect (value, flatIndex) pairs for this channel and take the top-k.
    const cells: Array<[number, number]> = [];
    for (let h = 0; h < H; h++) {
      for (let w = 0; w < W; w++) {
        // Full flat index into the [H, W, C] volume (channel-stride aware).
        cells.push([input[id3(h, w, c, W, C)] ?? 0, id3(h, w, c, W, C)]);
      }
    }
    cells.sort((a, b) => b[0]! - a[0]!);
    let sum = 0;
    for (let j = 0; j < k; j++) {
      const cell = cells[j]!;
      sum += cell[0]!;
      indices[c * k + j] = cell[1]!;
    }
    output[c] = sum / k;
  }
  return { output, indices, k };
}

/** Splits each channel's gradient evenly across its top-k cells. */
export function globalTopKPoolBackward(
  dOutput: Float32Array,
  indices: Int32Array,
  k: number,
  inputLen: number
): Float32Array {
  const dInput = new Float32Array(inputLen);
  for (let c = 0; c < dOutput.length; c++) {
    const d = (dOutput[c] ?? 0) / k;
    for (let j = 0; j < k; j++) {
      const idx = indices[c * k + j]!;
      dInput[idx] = (dInput[idx] ?? 0) + d;
    }
  }
  return dInput;
}

// ---------------------------------------------------------------------------
// Dense layer
// ---------------------------------------------------------------------------

/** `logits = input · W^T + b`. `weights` is [outC, inC], `bias` is [outC]. */
export function dense(
  input: Float32Array,
  weights: Float32Array,
  bias: Float32Array
): Float32Array {
  const inC = input.length;
  const outC = bias.length;
  const logits = new Float32Array(outC);
  for (let o = 0; o < outC; o++) {
    let s = bias[o] ?? 0;
    for (let i = 0; i < inC; i++) s += (input[i] ?? 0) * (weights[o * inC + i] ?? 0);
    logits[o] = s;
  }
  return logits;
}

export interface DenseGrads {
  dW: Float32Array;
  dB: Float32Array;
  dInput: Float32Array;
}

export function denseBackward(
  input: Float32Array,
  dLogits: Float32Array,
  weights: Float32Array
): DenseGrads {
  const inC = input.length;
  const outC = dLogits.length;
  const dW = new Float32Array(weights.length);
  const dB = new Float32Array(outC);
  const dInput = new Float32Array(inC);
  for (let o = 0; o < outC; o++) {
    const d = dLogits[o] ?? 0;
    dB[o] = d;
    for (let i = 0; i < inC; i++) {
      dW[o * inC + i] = d * (input[i] ?? 0);
      dInput[i] = (dInput[i] ?? 0) + d * (weights[o * inC + i] ?? 0);
    }
  }
  return { dW, dB, dInput };
}

// ---------------------------------------------------------------------------
// Softmax + cross entropy
// ---------------------------------------------------------------------------

/** Numerically-stable softmax. */
export function softmax(logits: Float32Array): Float32Array {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) max = Math.max(max, logits[i] ?? 0);
  let sum = 0;
  const out = new Float32Array(logits.length);
  for (let i = 0; i < logits.length; i++) {
    const e = Math.exp((logits[i] ?? 0) - max);
    out[i] = e;
    sum += e;
  }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) / sum;
  return out;
}

/**
 * Gaussian soft target for a class label. Severity is ordinal — a HIGH pothole
 * is "closer" to CRITICAL than to NONE — so the target spreads probability mass
 * onto adjacent classes (plus a small floor so no log(0)). Training against
 * these targets teaches the network the severity ordering instead of treating
 * every wrong class as equally wrong.
 */
export function softTarget(label: number, n: number, sigma = 0.5): Float32Array {
  const target = new Float32Array(n);
  let sum = 0;
  for (let j = 0; j < n; j++) {
    const d = j - label;
    target[j] = Math.exp(-(d * d) / (2 * sigma * sigma)) + 0.02;
    sum += target[j]!;
  }
  for (let j = 0; j < n; j++) target[j] = (target[j] ?? 0) / sum;
  return target;
}

/** Cross-entropy between the predicted distribution and a (soft) target. */
export function crossEntropyLoss(probs: Float32Array, target: Float32Array): number {
  let s = 0;
  for (let j = 0; j < probs.length; j++) {
    s -= (target[j] ?? 0) * Math.log(Math.max(probs[j] ?? 1e-9, 1e-9));
  }
  return s;
}

/** dLoss/dLogits for softmax + cross-entropy = probs − target. */
export function softmaxGrad(probs: Float32Array, target: Float32Array): Float32Array {
  const grad = new Float32Array(probs.length);
  for (let j = 0; j < probs.length; j++) grad[j] = (probs[j] ?? 0) - (target[j] ?? 0);
  return grad;
}

import { describe, expect, it } from 'vitest';
import { CnnModel, INPUT_SIZE, NUM_CLASSES } from '../../../src/algorithms/cnn/model.js';
import {
  conv2dRelu,
  conv2dReluBackward,
  dense,
  denseBackward,
  globalAvgPoolBackward,
  maxPool2dBackward,
} from '../../../src/algorithms/cnn/ops.js';
import { mulberry32 } from '../../../src/algorithms/cnn/tensor.js';

/** Scalar loss 0.5·Σ(output−target)² — its gradient is exactly output − target. */
function mseLoss(output: Float32Array, target: Float32Array): number {
  let s = 0;
  for (let i = 0; i < output.length; i++) {
    const d = (output[i] ?? 0) - (target[i] ?? 0);
    s += d * d;
  }
  return 0.5 * s;
}

function centeredDiff(f: (w: Float32Array) => number, base: Float32Array, idx: number, eps: number): number {
  const up = Float32Array.from(base);
  up[idx] = (up[idx] ?? 0) + eps;
  const down = Float32Array.from(base);
  down[idx] = (down[idx] ?? 0) - eps;
  return (f(up) - f(down)) / (2 * eps);
}

describe('denseBackward — finite-difference gradient check', () => {
  it('matches numeric gradients for dW, dB and dInput', () => {
    const rand = mulberry32(1);
    const input = new Float32Array([0.5, 1.5, -0.25]);
    const weights = new Float32Array(2 * 3).map(() => rand() - 0.5);
    const bias = new Float32Array(2);
    const target = new Float32Array([0.3, 0.9]);

    const logits = dense(input, weights, bias);
    const dLogits = new Float32Array(logits.length).map((_, i) => (logits[i] ?? 0) - (target[i] ?? 0));
    const g = denseBackward(input, dLogits, weights);

    const loss = (w: Float32Array, b: Float32Array) => mseLoss(dense(input, w, b), target);
    const eps = 1e-4;

    for (let i = 0; i < weights.length; i++) {
      expect(g.dW[i]).toBeCloseTo(centeredDiff((w) => loss(w, bias), weights, i, eps), 3);
    }
    for (let i = 0; i < bias.length; i++) {
      expect(g.dB[i]).toBeCloseTo(centeredDiff((b) => loss(weights, b), bias, i, eps), 3);
    }
    for (let i = 0; i < input.length; i++) {
      const num = centeredDiff((x) => mseLoss(dense(x, weights, bias), target), input, i, eps);
      expect(g.dInput[i]).toBeCloseTo(num, 3);
    }
  });
});

describe('conv2dReluBackward — finite-difference gradient check', () => {
  it('matches numeric gradients through conv+ReLU on a fully-active block', () => {
    const rand = mulberry32(2);
    const inC = 1;
    const H = 4;
    const W = 4;
    const outC = 2;
    const k = 3;
    const input = new Float32Array(H * W * inC).fill(1);
    const weights = new Float32Array(outC * inC * k * k).map(() => 0.05 + rand() * 0.1);
    const bias = new Float32Array(outC).fill(1.0);
    const target = new Float32Array(H * W * outC).map(() => rand());

    const fwd = conv2dRelu(input, inC, H, W, weights, bias, outC, k);
    // Every pre-activation is ≥ 1.2 > 0, so the ReLU is linear across the finite-diff
    // perturbation window and the gradient check is exact.
    expect(Array.from(fwd.mask).every((m) => m === 1)).toBe(true);

    const dOutput = new Float32Array(fwd.output.length).map((_, i) => (fwd.output[i] ?? 0) - (target[i] ?? 0));
    const g = conv2dReluBackward(input, inC, H, W, weights, outC, k, dOutput, fwd.mask);

    const loss = (w: Float32Array) =>
      mseLoss(conv2dRelu(input, inC, H, W, w, bias, outC, k).output, target);
    const eps = 1e-4;

    // Float32 rounding through the nested conv means gradients agree to ~1e-4
    // absolute (≈1e-5 relative at magnitude ~11) — precision 2 is a fair check.
    for (let i = 0; i < 10; i++) {
      expect(g.dW[i]).toBeCloseTo(centeredDiff(loss, weights, i, eps), 2);
    }
    for (let i = 0; i < outC; i++) {
      const num = centeredDiff((b) => mseLoss(conv2dRelu(input, inC, H, W, weights, b, outC, k).output, target), bias, i, eps);
      expect(g.dB[i]).toBeCloseTo(num, 2);
    }
  });
});

describe('pooling backward', () => {
  it('globalAvgPoolBackward spreads each channel gradient evenly', () => {
    const dOut = new Float32Array([2, 4]); // C=2, H=W=4
    const dIn = globalAvgPoolBackward(dOut, 4, 4, 2);
    expect(dIn[0]).toBeCloseTo(2 / 16, 6); // channel 0, cell (0,0)
    expect(dIn[8]).toBeCloseTo(2 / 16, 6); // channel 0, cell (1,0)
    expect(dIn[1]).toBeCloseTo(4 / 16, 6); // channel 1, cell (0,0)
    expect(dIn[9]).toBeCloseTo(4 / 16, 6); // channel 1, cell (1,0)
  });

  it('maxPool2dBackward routes gradient only to the argmax cells', () => {
    const dOut = new Float32Array([5, 7, 13, 15]);
    const argmax = new Int32Array([4, 6, 12, 14]);
    const dIn = maxPool2dBackward(dOut, argmax, 16);
    expect(dIn[4]).toBe(5);
    expect(dIn[6]).toBe(7);
    expect(dIn[12]).toBe(13);
    expect(dIn[14]).toBe(15);
    expect(dIn[0]).toBe(0);
    expect(dIn[2]).toBe(0);
  });
});

describe('model training — end-to-end backprop + Adam', () => {
  it('reduces cross-entropy loss over a few steps and keeps parameters finite', () => {
    const model = new CnnModel(11);
    const rand = mulberry32(99);
    // One 32×32 sample per class, fixed (seeded).
    const samples = Array.from({ length: NUM_CLASSES }, (_, cls) => ({
      cls,
      input: new Float32Array(INPUT_SIZE * INPUT_SIZE).map(() => rand()),
    }));

    const runEpoch = () => {
      model.zeroGrad();
      let loss = 0;
      for (const { input, cls } of samples) {
        loss += model.backward(model.forward(input), cls, true);
      }
      model.step(0.02, samples.length);
      return loss;
    };

    const before = runEpoch();
    expect(Number.isFinite(before)).toBe(true);

    let after = before;
    for (let i = 0; i < 30; i++) after = runEpoch();

    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);
    for (const p of model.params()) {
      expect(Array.from(p).every((v) => Number.isFinite(v))).toBe(true);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { CnnModel, HIDDEN, INPUT_SIZE, NUM_CLASSES } from '../../../src/algorithms/cnn/model.js';
import {
  conv2dRelu,
  crossEntropyLoss,
  dense,
  globalAvgPool,
  globalTopKPool,
  maxPool2d,
  softmax,
  softTarget,
} from '../../../src/algorithms/cnn/ops.js';

describe('dense', () => {
  it('computes logits = input · Wᵀ + b by hand', () => {
    // weights [outC=3][inC=2]: row0=[1,0], row1=[0,1], row2=[2,3]; bias=[0,0,1]
    const w = new Float32Array([1, 0, 0, 1, 2, 3]);
    const b = new Float32Array([0, 0, 1]);
    const logits = dense(new Float32Array([1, 2]), w, b);
    expect(Array.from(logits)).toEqual([1, 2, 9]);
  });
});

describe('softmax', () => {
  it('uniform logits give a uniform distribution', () => {
    const p = softmax(new Float32Array([0, 0, 0]));
    for (let i = 0; i < p.length; i++) expect(p[i]).toBeCloseTo(1 / 3, 6); // float32 vs float64
  });

  it('is monotone, sums to 1, and matches a hand-computed value', () => {
    const p = softmax(new Float32Array([2, 1, 0]));
    expect(p[0]!).toBeGreaterThan(p[1]!);
    expect(p[1]!).toBeGreaterThan(p[2]!);
    expect(p.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 6);
    expect(p[0]).toBeCloseTo(0.6652, 3); // e^2 / (e^2+e+e^0)
  });
});

describe('softTarget', () => {
  it('is a normalized Gaussian spread centred on the ordinal label', () => {
    const t = softTarget(2, 5);
    expect(t.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 6);
    expect(t[2]).toBe(Math.max(...t));
    expect(t[1]).toBeGreaterThan(t[0]); // adjacent class gets more mass than a distant one
    expect(t[3]).toBeGreaterThan(t[4]);
  });
});

describe('crossEntropyLoss', () => {
  it('for a uniform prediction against a normalized target equals ln(n)', () => {
    const uniform = new Float32Array(NUM_CLASSES).fill(1 / NUM_CLASSES);
    expect(crossEntropyLoss(uniform, softTarget(1, NUM_CLASSES))).toBeCloseTo(Math.log(NUM_CLASSES), 6);
  });

  it('is lower for a confident correct prediction', () => {
    const oneHot = new Float32Array(NUM_CLASSES);
    oneHot[2] = 1;
    const confident = new Float32Array(NUM_CLASSES);
    confident[2] = 0.99;
    confident[1] = 0.01;
    expect(crossEntropyLoss(confident, oneHot)).toBeLessThan(crossEntropyLoss(uniformLike(), oneHot));
    function uniformLike(): Float32Array {
      return new Float32Array(NUM_CLASSES).fill(1 / NUM_CLASSES);
    }
  });
});

describe('pooling kernels', () => {
  it('globalAvgPool means over the spatial dimensions per channel', () => {
    const input = new Float32Array([1, 2, 3, 4]); // 2×2×1
    expect(globalAvgPool(input, 2, 2, 1)[0]).toBe(2.5);
  });

  it('globalTopKPool returns the per-channel mean of the top-k cells', () => {
    const input = new Float32Array([1, 2, 3, 4]); // 2×2×1, top-2 = {4,3}
    const r = globalTopKPool(input, 2, 2, 1, 2);
    expect(r.output[0]).toBe(3.5);
    expect(Array.from(r.indices)).toEqual([3, 2]); // flat ids of 4 then 3
  });

  it('maxPool2d keeps the per-window max with its argmax flat index', () => {
    const input = new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]); // 4×4×1
    const r = maxPool2d(input, 4, 4, 1);
    // Cell (h,w) sits at flat index h*4+w and holds that same value, so the max
    // cell and its argmax index coincide.
    expect(Array.from(r.output)).toEqual([5, 7, 13, 15]);
    expect(Array.from(r.argmax)).toEqual([5, 7, 13, 15]);
  });
});

describe('conv2dRelu', () => {
  it('applies a SAME-padded convolution plus ReLU', () => {
    // 3×3 input of 1s, one 3×3 filter of 1s, bias 0.
    const input = new Float32Array(9).fill(1);
    const w = new Float32Array(9).fill(1);
    const b = new Float32Array([0]);
    const r = conv2dRelu(input, 1, 3, 3, w, b, 1, 3);
    expect(r.output[0]).toBe(4); // corner: 2×2 valid taps
    expect(r.output[1]).toBe(6); // edge: 2×3 valid taps
    expect(r.output[4]).toBe(9); // centre: 3×3 valid taps
    expect(Array.from(r.mask).every((m) => m === 1)).toBe(true);
  });

  it('masks negative pre-activations to zero', () => {
    const input = new Float32Array(9).fill(1);
    const w = new Float32Array([-2, -2, -2, -2, -2, -2, -2, -2, -2]);
    const b = new Float32Array([0]);
    const r = conv2dRelu(input, 1, 3, 3, w, b, 1, 3);
    expect(r.output[0]).toBe(0);
    expect(r.mask[0]).toBe(0);
    expect(r.output[4]).toBe(0);
  });
});

describe('CnnModel', () => {
  it('predicts a class with normalized probabilities on a zero image', () => {
    const model = new CnnModel(42);
    const { probs, predictedClass } = model.predict(new Float32Array(INPUT_SIZE * INPUT_SIZE));
    expect(predictedClass).toBeGreaterThanOrEqual(0);
    expect(predictedClass).toBeLessThan(NUM_CLASSES);
    expect(probs.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 6);
    expect(Array.from(probs).every((p) => p >= 0)).toBe(true);
  });

  it('round-trips weights through JSON', () => {
    const a = new CnnModel(7);
    const b = CnnModel.fromJSON(a.toJSON());
    const input = new Float32Array(INPUT_SIZE * INPUT_SIZE).fill(0.5);
    expect(Array.from(b.predict(input).probs)).toEqual(Array.from(a.predict(input).probs));
  });

  it('honours the class prior stored in the fc2 bias', () => {
    const json = new CnnModel(5).toJSON();
    json.fc2.w = Array.from({ length: NUM_CLASSES * HIDDEN }, () => 0);
    json.fc2.b = Array.from({ length: NUM_CLASSES }, (_, i) => (i === 3 ? 5 : 0));
    const model = CnnModel.fromJSON(json);
    const { predictedClass } = model.predict(new Float32Array(INPUT_SIZE * INPUT_SIZE));
    expect(predictedClass).toBe(3);
  });
});


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

export const TOP_K = 3;

export const DEPTH_FLOOR_K = 3;

export const FEATURES = CONV2_OUT * 2 + 1;


export interface Cache {
  input: Float32Array; 
  y1m: Uint8Array; 
  p1: Float32Array; 
  p1a: Int32Array; 
  y2m: Uint8Array; 
  p2: Float32Array; 
  p2a: Int32Array; 
  p2Peak: Int32Array; 
  features: Float32Array; 
  h1: Float32Array; 
  h1m: Uint8Array; 
  logits: Float32Array; 
  probs: Float32Array; 
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

  
  private m: Float32Array[] = [];
  private v: Float32Array[] = [];
  private stepCount = 0;
  
  private grads: Float32Array[] = [];

  constructor(seed = 42) {
    const rand = mulberry32(seed);
    
    this.conv1w = heInit(CONV1_OUT * 1 * KERNEL * KERNEL, 1 * KERNEL * KERNEL, rand);
    this.conv1b = new Float32Array(CONV1_OUT);
    
    this.conv2w = heInit(CONV2_OUT * CONV1_OUT * KERNEL * KERNEL, CONV1_OUT * KERNEL * KERNEL, rand);
    this.conv2b = new Float32Array(CONV2_OUT);
    
    this.fc1w = heInit(HIDDEN * FEATURES, FEATURES, rand);
    this.fc1b = new Float32Array(HIDDEN);
    
    this.fc2w = heInit(NUM_CLASSES * HIDDEN, HIDDEN, rand);
    this.fc2b = new Float32Array(NUM_CLASSES);
    this.initOptimizer();
  }

  
  params(): Float32Array[] {
    return [this.conv1w, this.conv1b, this.conv2w, this.conv2b, this.fc1w, this.fc1b, this.fc2w, this.fc2b];
  }

  private initOptimizer(): void {
    const ps = this.params();
    this.m = ps.map((p) => new Float32Array(p.length));
    this.v = ps.map((p) => new Float32Array(p.length));
    this.grads = ps.map((p) => new Float32Array(p.length));
  }

  
  
  

  forward(input: Float32Array): Cache {
    const c1 = conv2dRelu(input, 1, INPUT_SIZE, INPUT_SIZE, this.conv1w, this.conv1b, CONV1_OUT, KERNEL);
    const p1 = maxPool2d(c1.output, INPUT_SIZE, INPUT_SIZE, CONV1_OUT);
    const c2 = conv2dRelu(p1.output, CONV1_OUT, INPUT_SIZE / 2, INPUT_SIZE / 2, this.conv2w, this.conv2b, CONV2_OUT, KERNEL);
    const p2 = maxPool2d(c2.output, INPUT_SIZE / 4, INPUT_SIZE / 4, CONV2_OUT);
    
    
    
    const gap = globalAvgPool(p2.output, INPUT_SIZE / 4, INPUT_SIZE / 4, CONV2_OUT);
    const peak = globalTopKPool(p2.output, INPUT_SIZE / 4, INPUT_SIZE / 4, CONV2_OUT, TOP_K);
    const features = new Float32Array(FEATURES);
    features.set(gap, 0);
    features.set(peak.output, CONV2_OUT);
    
    
    
    
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

  
  predict(input: Float32Array): { probs: Float32Array; predictedClass: number } {
    const cache = this.forward(input);
    return { probs: cache.probs, predictedClass: argmax(cache.probs) };
  }

  
  
  

  
  backward(cache: Cache, label: number, accumulate = true): number {
    const target = softTarget(label, NUM_CLASSES);
    const loss = crossEntropyLoss(cache.probs, target);
    const dLogits = softmaxGrad(cache.probs, target);

    const g2 = denseBackward(cache.h1, dLogits, this.fc2w);
    const dH = new Float32Array(cache.h1.length);
    for (let i = 0; i < dH.length; i++) dH[i] = cache.h1m[i] ? (g2.dInput[i] ?? 0) : 0;
    const g1 = denseBackward(cache.features, dH, this.fc1w);

    
    
    
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

  
  
  

  
  classActivation(cache: Cache, cls: number): Float32Array {
    const size = INPUT_SIZE / 4; 
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

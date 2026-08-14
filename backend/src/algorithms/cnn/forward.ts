
import { argmax } from './tensor.js';
import type { CnnModel, Cache } from './model.js';

export interface InferenceOutput {
  
  probs: Float32Array;
  
  predictedClass: number;
  
  cache: Cache;
}

export function runInference(model: CnnModel, input: Float32Array): InferenceOutput {
  const cache = model.forward(input);
  return { probs: cache.probs, predictedClass: argmax(cache.probs), cache };
}

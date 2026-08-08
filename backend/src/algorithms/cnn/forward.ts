/**
 * Inference entry points over the CNN — the forward pass only, plus the cache
 * the detector needs for its class-activation bounding box.
 */
import { argmax } from './tensor.js';
import type { CnnModel, Cache } from './model.js';

export interface InferenceOutput {
  /** Softmax probabilities over [NONE, LOW, MEDIUM, HIGH, CRITICAL]. */
  probs: Float32Array;
  /** Index of the argmax class. */
  predictedClass: number;
  /** Full forward cache (kept so callers can compute a class activation map). */
  cache: Cache;
}

export function runInference(model: CnnModel, input: Float32Array): InferenceOutput {
  const cache = model.forward(input);
  return { probs: cache.probs, predictedClass: argmax(cache.probs), cache };
}

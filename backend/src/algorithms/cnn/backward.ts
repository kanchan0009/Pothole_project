
import type { CnnModel } from './model.js';

export function trainOnBatch(
  model: CnnModel,
  inputs: Float32Array[],
  labels: number[],
  learningRate: number
): number {
  if (inputs.length === 0 || inputs.length !== labels.length) {
    throw new Error('trainOnBatch: inputs and labels must be non-empty and equal length');
  }
  model.zeroGrad();
  let lossSum = 0;
  for (let i = 0; i < inputs.length; i++) {
    const cache = model.forward(inputs[i]!);
    lossSum += model.backward(cache, labels[i]!, true);
  }
  model.step(learningRate, inputs.length);
  return lossSum / inputs.length;
}

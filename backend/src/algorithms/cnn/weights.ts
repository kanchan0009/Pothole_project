/**
 * Loads the trained CNN weights. Weights are produced by
 * `scripts/train-cnn.ts` and committed to `backend/data/cnn-weights.json`, so
 * inference needs no model download and works fully offline.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CnnWeightsJson } from './model.js';

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../data');
const WEIGHTS_PATH = path.join(DATA_DIR, 'cnn-weights.json');

let cached: CnnWeightsJson | null = null;

export async function loadCnnWeights(): Promise<CnnWeightsJson> {
  if (cached) return cached;
  const raw = await fs.readFile(WEIGHTS_PATH, 'utf8');
  cached = JSON.parse(raw) as CnnWeightsJson;
  return cached;
}

export const CNN_WEIGHTS_PATH = WEIGHTS_PATH;

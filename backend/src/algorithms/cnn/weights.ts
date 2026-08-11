/**
 * Loads the trained CNN weights. Weights are produced by
 * `scripts/train-cnn.ts` and committed to `backend/data/cnn-weights.json`, so
 * inference needs no model download and works fully offline.
 */
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CnnWeightsJson } from './model.js';

let DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../data');
let WEIGHTS_PATH = path.join(DATA_DIR, 'cnn-weights.json');

// If running from compiled dist/ and data/ wasn't copied, fallback to the root data/ folder
if (!fsSync.existsSync(WEIGHTS_PATH)) {
  WEIGHTS_PATH = path.join(process.cwd(), 'data', 'cnn-weights.json');
}

let cached: CnnWeightsJson | null = null;

export async function loadCnnWeights(): Promise<CnnWeightsJson> {
  if (cached) return cached;
  const raw = await fs.readFile(WEIGHTS_PATH, 'utf8');
  cached = JSON.parse(raw) as CnnWeightsJson;
  return cached;
}

export const CNN_WEIGHTS_PATH = WEIGHTS_PATH;

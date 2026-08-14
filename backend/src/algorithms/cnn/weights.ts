
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CnnWeightsJson } from './model.js';

let DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../data');
let WEIGHTS_PATH = path.join(DATA_DIR, 'cnn-weights.json');


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

import { describe, expect, it } from 'vitest';
import { cnnDetector } from '../../src/algorithms/cnn/detector.js';
import { analyzePotholeStructure, isStrongPotholeStructure } from '../../src/algorithms/potholeStructure.js';
import { makeImage, makeNoPotholeImage, POOL_SEEDS } from '../helpers/images.js';
import sharp from 'sharp';

async function grid(buf: Buffer, size = 64) {
  const raw = await sharp(buf).greyscale().resize(size, size, { fit: 'fill' }).raw().toBuffer();
  return new Uint8Array(raw);
}

async function makeRoadOnly(seed: number): Promise<Buffer> {
  const W = 120;
  const H = 120;
  const buf = Buffer.alloc(W * H * 3);
  let x = seed + 1;
  const rnd = () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x / 0x7fffffff;
  };
  const base = 140 + ((seed * 7) % 30);
  for (let y = 0; y < H; y++) {
    for (let xPos = 0; xPos < W; xPos++) {
      const g = base + Math.round((rnd() - 0.5) * 22);
      const v = Math.max(0, Math.min(255, g));
      const o = (y * W + xPos) * 3;
      buf[o] = v;
      buf[o + 1] = v;
      buf[o + 2] = v;
    }
  }
  return sharp(buf, { raw: { width: W, height: H, channels: 3 } }).jpeg().toBuffer();
}

describe('cnnDetector', () => {
  it('detects synthetic pothole images', async () => {
    const result = await cnnDetector.detect(await makeImage(0));
    expect(result.isPothole).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.severity).toBeTruthy();
  });

  it('detects all training-pool pothole seeds through the API pipeline', async () => {
    for (const seed of POOL_SEEDS) {
      const result = await cnnDetector.detect(await makeImage(seed));
      expect(result.isPothole, `seed ${seed} should detect`).toBe(true);
    }
  });

  it('rejects pothole-free road photos with a message', async () => {
    const result = await cnnDetector.detect(await makeNoPotholeImage());
    expect(result.isPothole).toBe(false);
    expect(result.message).toMatch(/No pothole detected/i);
  });

  it('rejects textured road without a pothole blob', async () => {
    const result = await cnnDetector.detect(await makeRoadOnly(0));
    expect(result.isPothole).toBe(false);
  });

  it('accepts pothole structure on synthetic pothole photos', async () => {
    const st = analyzePotholeStructure(await grid(await makeImage(0)));
    expect(st.ok).toBe(true);
    expect(isStrongPotholeStructure(st)).toBe(true);
  });
});

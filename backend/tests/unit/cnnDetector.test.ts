import { describe, expect, it } from 'vitest';
import { cnnDetector } from '../../src/algorithms/cnn/detector.js';
import { analyzePotholeStructure } from '../../src/algorithms/potholeStructure.js';
import { makeImage, makeNoPotholeImage } from '../helpers/images.js';
import sharp from 'sharp';

/** Road texture without a pothole blob. */
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

async function grayGrid(buf: Buffer, size: number) {
  const raw = await sharp(buf).greyscale().resize(size, size, { fit: 'fill' }).raw().toBuffer();
  return new Uint8Array(raw);
}

describe('cnnDetector', () => {
  it('detects synthetic pothole images', async () => {
    const result = await cnnDetector.detect(await makeImage(0));
    expect(result.isPothole).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.52);
    expect(result.boundingBox).not.toBeNull();
    expect(result.severity).toBeTruthy();
  });

  it('rejects pothole-free road photos with a message', async () => {
    const result = await cnnDetector.detect(await makeNoPotholeImage());
    expect(result.isPothole).toBe(false);
    expect(result.boundingBox).toBeNull();
    expect(result.message).toMatch(/No pothole detected/i);
  });

  it('rejects textured road without a pothole blob', async () => {
    const result = await cnnDetector.detect(await makeRoadOnly(0));
    expect(result.isPothole).toBe(false);
    expect(result.boundingBox).toBeNull();
  });

  it('rejects plain asphalt structure even when CNN leans positive', async () => {
    const road = await grayGrid(await makeRoadOnly(3), 64);
    expect(analyzePotholeStructure(road).ok).toBe(false);
  });

  it('accepts pothole structure on synthetic pothole photos', async () => {
    const pothole = await grayGrid(await makeImage(0), 64);
    expect(analyzePotholeStructure(pothole).ok).toBe(true);
  });
});

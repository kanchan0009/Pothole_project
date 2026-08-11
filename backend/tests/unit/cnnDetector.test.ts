import { describe, expect, it } from 'vitest';
import { cnnDetector, potholeDepthDelta } from '../../src/algorithms/cnn/detector.js';
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
  const lines = new Set([8 + ((seed * 11) % 6), 58 + ((seed * 13) % 6), 100 + ((seed * 7) % 8)]);
  for (let y = 0; y < H; y++) {
    for (let xPos = 0; xPos < W; xPos++) {
      let g = base + Math.round((rnd() - 0.5) * 22);
      if (lines.has(y)) g += 34;
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
    expect(result.confidence).toBeGreaterThanOrEqual(0.55);
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

  it('reports meaningful depth on pothole vs clean road', async () => {
    const pothole = await sharp(await makeImage(0))
      .greyscale()
      .resize(32, 32, { fit: 'fill' })
      .raw()
      .toBuffer();
    const clean = await sharp(await makeRoadOnly(0))
      .greyscale()
      .resize(32, 32, { fit: 'fill' })
      .raw()
      .toBuffer();
    expect(potholeDepthDelta(new Uint8Array(pothole))).toBeGreaterThan(40);
    expect(potholeDepthDelta(new Uint8Array(clean))).toBeLessThan(40);
  });
});

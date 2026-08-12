import { describe, expect, it } from 'vitest';
import { analyzePotholeStructure } from '../../src/algorithms/potholeStructure.js';
import { makeImage, makeNoPotholeImage } from '../helpers/images.js';
import sharp from 'sharp';

async function grid(buf: Buffer, size = 64) {
  const raw = await sharp(buf).greyscale().resize(size, size, { fit: 'fill' }).raw().toBuffer();
  return new Uint8Array(raw);
}

describe('analyzePotholeStructure', () => {
  it('accepts a synthetic pothole blob', async () => {
    expect(analyzePotholeStructure(await grid(await makeImage(0))).ok).toBe(true);
  });

  it('rejects plain road without a dark hole', async () => {
    expect(analyzePotholeStructure(await grid(await makeNoPotholeImage())).ok).toBe(false);
  });

  it('rejects a large phone-sized plain asphalt photo', async () => {
    const W = 400;
    const H = 300;
    const buf = Buffer.alloc(W * H * 3);
    let s = 42;
    const rnd = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const g = 145 + Math.round((rnd() - 0.5) * 18);
        const o = (y * W + x) * 3;
        buf[o] = buf[o + 1] = buf[o + 2] = g;
      }
    }
    const jpeg = await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).jpeg().toBuffer();
    expect(analyzePotholeStructure(await grid(jpeg)).ok).toBe(false);
  });
});

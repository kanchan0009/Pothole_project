import { describe, expect, it } from 'vitest';
import { analyzeRoadScenePixels } from '../../src/algorithms/roadScene.js';
import { makeImage } from '../helpers/images.js';
import sharp from 'sharp';

async function faceLikeJpeg(): Promise<Buffer> {
  // Peach background + brown oval (face-like tones — should NOT read as asphalt).
  return sharp({
    create: { width: 320, height: 320, channels: 3, background: { r: 220, g: 180, b: 150 } },
  })
    .composite([
      {
        input: await sharp({
          create: { width: 180, height: 220, channels: 3, background: { r: 190, g: 140, b: 110 } },
        })
          .png()
          .toBuffer(),
        top: 50,
        left: 70,
      },
      {
        input: await sharp({
          create: { width: 24, height: 16, channels: 3, background: { r: 40, g: 30, b: 25 } },
        })
          .png()
          .toBuffer(),
        top: 120,
        left: 110,
      },
      {
        input: await sharp({
          create: { width: 24, height: 16, channels: 3, background: { r: 40, g: 30, b: 25 } },
        })
          .png()
          .toBuffer(),
        top: 120,
        left: 170,
      },
    ])
    .jpeg()
    .toBuffer();
}

async function sceneGrid(buf: Buffer) {
  const raw = await sharp(buf).resize(64, 64, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  return new Uint8Array(raw);
}

describe('analyzeRoadScenePixels', () => {
  it('marks synthetic pothole images as road-like', async () => {
    const scene = analyzeRoadScenePixels(await sceneGrid(await makeImage(0)), 64 * 64);
    expect(scene.isRoadLike).toBe(true);
    expect(scene.skinRatio).toBeLessThan(0.1);
  });

  it('rejects a face-like portrait', async () => {
    const scene = analyzeRoadScenePixels(await sceneGrid(await faceLikeJpeg()), 64 * 64);
    expect(scene.isRoadLike).toBe(false);
    expect(scene.skinRatio).toBeGreaterThan(0.05);
  });
});

describe('cnnDetector non-road rejection', () => {
  it('rejects a face-like photo', async () => {
    const { cnnDetector } = await import('../../src/algorithms/cnn/detector.js');
    const result = await cnnDetector.detect(await faceLikeJpeg());
    expect(result.isPothole).toBe(false);
    expect(result.message).toMatch(/road surface|pothole/i);
  });
});

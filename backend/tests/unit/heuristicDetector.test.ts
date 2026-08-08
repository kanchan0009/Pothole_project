import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { heuristicDetector } from '../../src/algorithms/heuristicDetector.js';

/** Light road surface with a centred dark pothole patch (mirrors the API fixtures). */
async function potholeImage(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
    <rect width="120" height="120" fill="#c8c8c8"/>
    <ellipse cx="60" cy="60" rx="22" ry="16" fill="#2a2a2a"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg().toBuffer();
}

async function uniformImage(luminance: number): Promise<Buffer> {
  const v = Math.round(Math.min(255, Math.max(0, luminance)));
  return sharp({ create: { width: 64, height: 64, channels: 3, background: { r: v, g: v, b: v } } })
    .jpeg()
    .toBuffer();
}

describe('heuristicDetector', () => {
  it('detects a dark pothole patch on a light road', async () => {
    const result = await heuristicDetector.detect(await potholeImage());
    expect(result.isPothole).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.confidence).toBeLessThanOrEqual(0.99);
    expect(result.boundingBox).not.toBeNull();
  });

  it('returns a normalized bounding box spanning the centre of the frame', async () => {
    const box = (await heuristicDetector.detect(await potholeImage())).boundingBox!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1.001);
    expect(box.y + box.height).toBeLessThanOrEqual(1.001);
    // The patch is centred — the box must straddle the frame's middle.
    expect(box.x).toBeLessThan(0.5);
    expect(box.y).toBeLessThan(0.5);
    expect(box.x + box.width).toBeGreaterThan(0.5);
    expect(box.y + box.height).toBeGreaterThan(0.5);
  });

  it('rejects a uniform road with no pothole', async () => {
    const result = await heuristicDetector.detect(await uniformImage(160));
    expect(result.isPothole).toBe(false);
    expect(result.boundingBox).toBeNull();
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('refuses to call a near-black frame a pothole', async () => {
    const result = await heuristicDetector.detect(await uniformImage(12));
    expect(result.isPothole).toBe(false);
    expect(result.boundingBox).toBeNull();
    expect(result.confidence).toBeLessThan(0.5);
  });
});

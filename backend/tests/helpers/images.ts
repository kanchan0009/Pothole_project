import sharp from 'sharp';

/** Seeded LCG — deterministic per-image pixel noise. */
function lcg(seed: number): () => number {
  let x = seed + 1;
  return () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x / 0x7fffffff;
  };
}

/**
 * An asphalt-textured road photo with a pothole patch. Every pixel gets seeded
 * noise, so each 16×16 perceptual-hash cell has a distinct luminance and the
 * mean-threshold bitmap is unique per seed.
 *
 * The seeds in POOL_SEEDS were selected so that (a) the CNN detects a pothole
 * (isPothole + confidence ≥ 0.5) and (b) every pair of processed-webp hashes is
 * at Hamming distance > 25 — i.e. the duplicate-image check never fires between
 * two reports created from this pool.
 */
export async function makeImage(seed: number): Promise<Buffer> {
  const W = 120;
  const H = 120;
  const buf = Buffer.alloc(W * H * 3);
  const rnd = lcg(seed);
  const base = 140 + ((seed * 7) % 30); // 140..169
  const cx = 24 + ((seed * 19) % 72); // 24..95
  const cy = 22 + ((seed * 23) % 76); // 22..97
  const rx = 16 + (seed % 10); // 16..25
  const ry = 12 + (seed % 9); // 12..20
  const lines = new Set([8 + ((seed * 11) % 6), 58 + ((seed * 13) % 6), 100 + ((seed * 7) % 8)]);

  for (let y = 0; y < H; y++) {
    const dx = y - cy;
    for (let x = 0; x < W; x++) {
      let g = base + Math.round((rnd() - 0.5) * 22); // ±11 pixel noise
      const dy = x - cx;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < rx) g -= 130; // dark pothole body
      else if (d < rx + 4) g -= 60; // ragged edge
      if (lines.has(y)) g += 34; // faint road marking
      const v = Math.max(0, Math.min(255, g));
      const o = (y * W + x) * 3;
      buf[o] = v;
      buf[o + 1] = v;
      buf[o + 2] = v;
    }
  }
  return sharp(buf, { raw: { width: W, height: H, channels: 3 } }).jpeg().toBuffer();
}

/** Seeds verified pairwise-unique (>25) on the processed-webp perceptual hash. */
export const POOL_SEEDS = [0, 1, 2, 3, 6, 9, 10, 11, 12, 14, 15, 16, 18, 21, 27, 30, 38, 43, 66, 72];

/**
 * A textured but pothole-free photo — passes the blank-image check, yet the CNN
 * reports no pothole. Used wherever a submission must fail the AI gate or a
 * detect call must return a no-hit.
 */
export async function makeNoPotholeImage(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
    <rect width="64" height="64" fill="#b8b8b8"/>
    <rect x="0" y="12" width="64" height="5" fill="#e0e0e0"/>
    <rect x="0" y="30" width="64" height="5" fill="#8c8c8c"/>
    <rect x="0" y="46" width="64" height="5" fill="#d4d4d4"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg().toBuffer();
}

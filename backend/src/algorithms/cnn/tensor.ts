/**
 * Tiny numeric helpers for the CNN. All volumes are contiguous `Float32Array`s
 * in a channels-last layout `[y, x, channel]`, so a 64×64×16 tensor has length
 * 64*64*16 and index `(y*W + x)*C + c`.
 */

/** Deterministic PRNG (mulberry32) — weight init and data generation stay reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Index into a channels-last `[h][w][c]` volume of width `W`, channels `C`. */
export function id3(h: number, w: number, c: number, W: number, C: number): number {
  return (h * W + w) * C + c;
}

/** Index of the largest element (first wins on ties). */
export function argmax(arr: ArrayLike<number>): number {
  let best = 0;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i]! > arr[best]!) best = i;
  }
  return best;
}

/**
 * Mean of the `k` smallest values — the "darkest pixels" floor of an image.
 * Unlike every max-based pooling op, this survives the ReLU/maxpool cascade,
 * which erases darkness (dark pixels → low post-ReLU activations → a max-pool
 * always surfaces a brighter cell). Used as the CNN's third pooling branch.
 * O(n log n) over a small 32×32 input; the input is never mutated.
 */
export function meanOfSmallest(arr: ArrayLike<number>, k: number): number {
  const n = Math.min(k, arr.length);
  const values = Array.from(arr);
  values.sort((a, b) => a - b);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += values[i] ?? 0;
  return sum / n;
}

/** Standard Gaussian sample via Box–Muller on a uniform RNG. */
function gauss(rand: () => number): number {
  const u = Math.max(rand(), 1e-9);
  const v = Math.max(rand(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** He/ReLU-aware init drawn from a seeded normal distribution. */
export function heInit(size: number, fanIn: number, rand: () => number): Float32Array {
  const out = new Float32Array(size);
  const std = Math.sqrt(2 / fanIn);
  for (let i = 0; i < size; i++) out[i] = gauss(rand) * std;
  return out;
}

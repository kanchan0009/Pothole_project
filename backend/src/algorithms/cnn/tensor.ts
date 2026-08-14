


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


export function id3(h: number, w: number, c: number, W: number, C: number): number {
  return (h * W + w) * C + c;
}


export function argmax(arr: ArrayLike<number>): number {
  let best = 0;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i]! > arr[best]!) best = i;
  }
  return best;
}


export function meanOfSmallest(arr: ArrayLike<number>, k: number): number {
  const n = Math.min(k, arr.length);
  const values = Array.from(arr);
  values.sort((a, b) => a - b);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += values[i] ?? 0;
  return sum / n;
}


function gauss(rand: () => number): number {
  const u = Math.max(rand(), 1e-9);
  const v = Math.max(rand(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}


export function heInit(size: number, fanIn: number, rand: () => number): Float32Array {
  const out = new Float32Array(size);
  const std = Math.sqrt(2 / fanIn);
  for (let i = 0; i < size; i++) out[i] = gauss(rand) * std;
  return out;
}

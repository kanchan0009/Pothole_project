import { describe, expect, it } from 'vitest';
import { BinaryHeap } from '../../src/algorithms/heap.js';

/** Reference: a plain sort on the same values (used to cross-check random input). */
function referenceSort(values: number[]): number[] {
  return [...values].sort((a, b) => b - a);
}

describe('BinaryHeap (MAX-heap — the priority queue)', () => {
  it('pops in descending priority order', () => {
    const heap = new BinaryHeap<number>((a, b) => b - a);
    for (const v of [5, 3, 8, 1, 9, 2]) heap.push(v);
    expect(heap.toSortedArray()).toEqual([9, 8, 5, 3, 2, 1]);
  });

  it('peek returns the root without removing it', () => {
    const heap = new BinaryHeap<number>((a, b) => b - a);
    heap.push(4);
    heap.push(10);
    heap.push(1);
    expect(heap.peek()).toBe(10);
    expect(heap.size).toBe(3);
  });

  it('buildFrom heapifies an existing collection in-place', () => {
    const heap = new BinaryHeap<number>((a, b) => b - a).buildFrom([3, 1, 4, 1, 5, 9, 2, 6]);
    expect(heap.size).toBe(8);
    expect(heap.peek()).toBe(9);
    expect(heap.toSortedArray()).toEqual([9, 6, 5, 4, 3, 2, 1, 1]);
  });

  it('keeps both elements of a priority tie', () => {
    const heap = new BinaryHeap<number>((a, b) => b - a);
    for (const v of [2, 2, 1, 3]) heap.push(v);
    expect(heap.toSortedArray()).toEqual([3, 2, 2, 1]);
  });

  it('removeBy extracts the first matching element and restores order', () => {
    const heap = new BinaryHeap<{ score: number; id: string }>((a, b) => b.score - a.score);
    for (const item of [
      { score: 50, id: 'a' },
      { score: 90, id: 'b' },
      { score: 20, id: 'c' },
    ]) {
      heap.push(item);
    }
    const removed = heap.removeBy((x) => x.id === 'c');
    expect(removed?.id).toBe('c');
    expect(heap.size).toBe(2);
    expect(heap.toSortedArray().map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('returns undefined when removing from an empty heap', () => {
    const heap = new BinaryHeap<number>((a, b) => b - a);
    expect(heap.pop()).toBeUndefined();
    expect(heap.peek()).toBeUndefined();
    expect(heap.removeBy(() => true)).toBeUndefined();
  });

  it('matches a reference sort on randomized input', () => {
    const values = Array.from({ length: 200 }, (_, i) => (i * 37) % 101);
    const heap = new BinaryHeap<number>((a, b) => b - a).buildFrom(values);
    expect(heap.toSortedArray()).toEqual(referenceSort(values));
  });
});

describe('BinaryHeap (MIN-heap — Dijkstra frontier)', () => {
  it('pops in ascending order when the comparator is reversed', () => {
    const heap = new BinaryHeap<number>((a, b) => a - b);
    for (const v of [9, 1, 5, 3, 8]) heap.push(v);
    const popped: number[] = [];
    while (!heap.isEmpty) popped.push(heap.pop()!);
    expect(popped).toEqual([1, 3, 5, 8, 9]);
  });

  it('pops the nearest frontier node first (distances)', () => {
    const heap = new BinaryHeap<{ index: number; d: number }>((a, b) => a.d - b.d);
    for (const n of [
      { index: 0, d: 120 },
      { index: 1, d: 45 },
      { index: 2, d: 90 },
    ]) {
      heap.push(n);
    }
    expect(heap.pop()?.index).toBe(1); // d=45 first
    expect(heap.pop()?.index).toBe(2); // then d=90
    expect(heap.pop()?.index).toBe(0); // then d=120
  });
});

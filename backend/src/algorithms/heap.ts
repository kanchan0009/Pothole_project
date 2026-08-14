
export type HeapComparator<T> = (a: T, b: T) => number;

export class BinaryHeap<T> {
  private items: T[] = [];

  constructor(private readonly compare: HeapComparator<T>) {}

  get size(): number {
    return this.items.length;
  }

  get isEmpty(): boolean {
    return this.items.length === 0;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  push(item: T): void {
    this.items.push(item);
    this.siftUp(this.items.length - 1);
  }

  pop(): T | undefined {
    const items = this.items;
    if (items.length === 0) return undefined;
    const root = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      this.siftDown(0);
    }
    return root;
  }

  
  buildFrom(values: Iterable<T>): this {
    this.items = Array.from(values);
    for (let i = Math.floor(this.items.length / 2) - 1; i >= 0; i--) this.siftDown(i);
    return this;
  }

  
  removeBy(predicate: (item: T) => boolean): T | undefined {
    const items = this.items;
    const index = items.findIndex(predicate);
    if (index === -1) return undefined;
    const removed = items[index];
    const last = items.pop()!;
    if (index < items.length) {
      items[index] = last;
      
      this.siftUp(index);
      this.siftDown(index);
    }
    return removed;
  }

  
  toArray(): T[] {
    return this.items.slice();
  }

  
  toSortedArray(): T[] {
    const copy = new BinaryHeap(this.compare);
    copy.items = this.items.slice();
    const out: T[] = [];
    while (copy.items.length > 0) {
      const top = copy.pop();
      if (top !== undefined) out.push(top);
    }
    return out;
  }

  clear(): void {
    this.items = [];
  }

  

  private siftUp(index: number): void {
    const items = this.items;
    const item = items[index]!;
    while (index > 0) {
      const parentIndex = (index - 1) >> 1;
      const parent = items[parentIndex]!;
      if (this.compare(item, parent) >= 0) break;
      items[index] = parent;
      index = parentIndex;
    }
    items[index] = item;
  }

  private siftDown(index: number): void {
    const items = this.items;
    const n = items.length;
    const item = items[index]!;
    for (;;) {
      const left = 2 * index + 1;
      if (left >= n) break;
      const right = left + 1;
      let child = left;
      if (right < n && this.compare(items[right]!, items[left]!) < 0) child = right;
      if (this.compare(item, items[child]!) <= 0) break;
      items[index] = items[child]!;
      index = child;
    }
    items[index] = item;
  }
}

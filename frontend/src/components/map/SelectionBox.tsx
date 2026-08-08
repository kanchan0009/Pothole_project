import type { PointerEvent as ReactPointerEvent } from 'react';
import { useRef } from 'react';
import type { BoxRect } from '../../lib/mapCapture';

const MIN_W = 120;
const MIN_H = 90;

type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface SelectionBoxProps {
  rect: BoxRect;
  container: { width: number; height: number } | null;
  onChange: (rect: BoxRect) => void;
}

/** Drag handle metadata: position + cursor. */
const HANDLES: { id: Handle; className: string; cursor: string }[] = [
  { id: 'nw', className: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'nwse-resize' },
  { id: 'n', className: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'ns-resize' },
  { id: 'ne', className: 'right-0 top-0 translate-x-1/2 -translate-y-1/2', cursor: 'nesw-resize' },
  { id: 'e', className: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2', cursor: 'ew-resize' },
  { id: 'se', className: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2', cursor: 'nwse-resize' },
  { id: 's', className: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2', cursor: 'ns-resize' },
  { id: 'sw', className: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2', cursor: 'nesw-resize' },
  { id: 'w', className: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2', cursor: 'ew-resize' },
];

/**
 * Movable + resizable rectangular selection overlay for map capture. Uses
 * pointer events with window-level listeners so the drag keeps tracking even
 * when the cursor leaves the box. Rendered ABOVE the map but BELOW the search
 * bar / camera button (z-30 vs z-40).
 */
export function SelectionBox({ rect, container, onChange }: SelectionBoxProps) {
  // startRect is captured at pointerdown so mid-drag renders stay consistent.
  const dragRef = useRef<{ handle: Handle; startX: number; startY: number; startRect: BoxRect } | null>(null);

  function clamp(v: number, min: number, max: number): number {
    return Math.min(Math.max(v, min), max);
  }

  /** Resize a rectangle from a fixed handle; returns the new rect un-clamped. */
  function resize(start: BoxRect, dx: number, dy: number, handle: Handle): BoxRect {
    let { x, y, width, height } = start;
    const left = handle.includes('w');
    const right = handle.includes('e');
    const top = handle.includes('n');
    const bottom = handle.includes('s');
    if (right) width = Math.max(MIN_W, start.width + dx);
    if (left) {
      width = Math.max(MIN_W, start.width - dx);
      x = start.x + start.width - width;
    }
    if (bottom) height = Math.max(MIN_H, start.height + dy);
    if (top) {
      height = Math.max(MIN_H, start.height - dy);
      y = start.y + start.height - height;
    }
    return { x, y, width, height };
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const handle = (e.target as HTMLElement).dataset.handle as Handle | undefined;
    const mode = handle ?? 'move';
    dragRef.current = { handle: mode, startX: e.clientX, startY: e.clientY, startRect: rect };

    function move(ev: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;
      const maxW = container?.width ?? Number.MAX_SAFE_INTEGER;
      const maxH = container?.height ?? Number.MAX_SAFE_INTEGER;
      let next: BoxRect;
      if (drag.handle === 'move') {
        next = {
          x: clamp(drag.startRect.x + dx, 0, Math.max(0, maxW - drag.startRect.width)),
          y: clamp(drag.startRect.y + dy, 0, Math.max(0, maxH - drag.startRect.height)),
          width: drag.startRect.width,
          height: drag.startRect.height,
        };
      } else {
        next = resize(drag.startRect, dx, dy, drag.handle);
        // Keep the box fully inside the container.
        next.x = clamp(next.x, 0, Math.max(0, maxW - next.width));
        next.y = clamp(next.y, 0, Math.max(0, maxH - next.height));
      }
      onChange({ x: Math.round(next.x), y: Math.round(next.y), width: Math.round(next.width), height: Math.round(next.height) });
    }

    function up() {
      dragRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    }

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  return (
    <div
      onPointerDown={onPointerDown}
      className="absolute z-30 touch-none pointer-events-auto"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        cursor: 'move',
      }}
      role="application"
      aria-label="Map capture area"
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-md border-2 border-dashed border-accent bg-accent/10"
        style={{ boxShadow: '0 0 0 9999px rgba(11,31,58,0.15)' }}
      />
      {/* Move hint — only visible on the body so it is not on the handles. */}
      <span className="pointer-events-none absolute left-2 top-2 rounded bg-primary/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
        Capture area
      </span>

      {HANDLES.map((h) => (
        <div
          key={h.id}
          data-handle={h.id}
          className={`absolute h-3.5 w-3.5 rounded-full border-2 border-accent bg-white shadow-card ${h.className}`}
          style={{ cursor: h.cursor, touchAction: 'none' }}
        />
      ))}
    </div>
  );
}

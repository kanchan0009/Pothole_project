import '@testing-library/jest-dom/vitest';


(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;



if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  if (!window.ResizeObserver) {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (window as unknown as Record<string, unknown>).ResizeObserver = ResizeObserverMock;
  }

  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (cb: FrameRequestCallback) => window.setTimeout(() => cb(Date.now()), 16);
    window.cancelAnimationFrame = (id: number) => window.clearTimeout(id);
  }
}

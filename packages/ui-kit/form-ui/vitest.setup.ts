class ResizeObserverStub {
  disconnect() {}
  observe() {}
  unobserve() {}
}

if (!('ResizeObserver' in globalThis)) {
  (globalThis as Record<string, any>).ResizeObserver = ResizeObserverStub;
}

if (!window.matchMedia) {
  (window as any).matchMedia = (query: string) => ({
    addEventListener() {},
    addListener() {},
    dispatchEvent: () => false,
    matches: false,
    media: query,
    removeEventListener() {},
    removeListener() {},
  });
}

if (!(globalThis as any).CSS) {
  (globalThis as any).CSS = {
    escape: (s: string) =>
      String(s).replace(/[^\w-]/g, (c) => `\${c}`),
  };
}

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

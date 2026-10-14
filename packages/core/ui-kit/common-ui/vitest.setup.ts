// jsdom 缺的三件浏览器能力，reka 的定位/滚动逻辑与 useLoading 的过渡都会用到
if (!(globalThis as any).CSS) {
  (globalThis as any).CSS = {
    escape: (s: string) => String(s).replace(/[^\w-]/g, (c) => `\\${c}`),
  };
}

if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    disconnect() {}
    observe() {}
    unobserve() {}
  }
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

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

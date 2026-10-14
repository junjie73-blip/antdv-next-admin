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

// jsdom 没有 CSS.escape，reka 的定位逻辑会用到
if (!(globalThis as any).CSS) {
  (globalThis as any).CSS = {
    escape: (s: string) => String(s).replace(/[^\w-]/g, (c) => `\$1`),
  };
}

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom 里元素没有布局盒，scrollIntoView 定位与溢出判定要有一个可读的假尺寸
if (!HTMLElement.prototype.getBoundingClientRect) {
  (HTMLElement.prototype as any).getBoundingClientRect = () => ({
    bottom: 100,
    height: 20,
    left: 0,
    right: 100,
    top: 0,
    width: 100,
    x: 0,
    y: 0,
  });
}

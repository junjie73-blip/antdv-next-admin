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

// jsdom 没有 CSS.escape，reka / TanStack 的定位逻辑会用到
if (!(globalThis as any).CSS) {
  (globalThis as any).CSS = {
    escape: (s: string) => String(s).replaceAll(/[^\w-]/g, (c) => `\${c}`),
  };
}

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// reka 的 Select/Popover 触发器按下时会调这三个指针捕获 API，jsdom 没实现
if (typeof Element !== 'undefined') {
  const proto = Element.prototype as any;
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
}

// jsdom 的布局尺寸恒为 0，列宽拖拽 / 滚动定位要有一个可读的假尺寸
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

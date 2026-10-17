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
    escape: (s: string) => String(s).replaceAll(/[^\w-]/g, (c) => `\${c}`),
  };
}

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

/**
 * jsdom 没有布局引擎：`Range` / `Element` 上根本没有 `getClientRects`，
 * 而 FMarkdown 里的 tiptap（ProseMirror）每次 dispatch 后都会 `scrollToSelection()`
 * → `coordsAtPos()` 去量光标位置。不补空实现就抛 TypeError，
 * 变成"用例全绿但 vitest 记一条 unhandled error"的假通过。
 */
const emptyRects = () => [];
for (const target of [Range.prototype, Element.prototype] as any[]) {
  if (typeof target.getClientRects !== 'function') {
    target.getClientRects = emptyRects;
  }
  if (typeof target.getBoundingClientRect !== 'function') {
    target.getBoundingClientRect = () =>
      ({
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
      }) as DOMRect;
  }
}

// jsdom 没有 CSS.escape，Vue 的 Transition / 选择器工具会用到
if (!(globalThis as any).CSS) {
  (globalThis as any).CSS = {
    escape: (s: string) => String(s).replace(/[^\w-]/g, (c) => `\\${c}`),
  };
}

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

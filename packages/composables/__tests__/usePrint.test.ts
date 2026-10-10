import type { PrintOptions } from '../src/usePrint';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { messageError } = vi.hoisted(() => ({ messageError: vi.fn() }));

vi.mock('antdv-next', () => ({
  message: { error: (...args: unknown[]) => messageError(...args) },
}));

import { usePrint } from '../src/usePrint';

/**
 * 原生 createElement 必须在这里抓一次：测试里会对 document.createElement 反复
 * spyOn，若用 `document.createElement.bind(document)` 抓到的是上一层 mock，
 * 第二次建 harness 就会自己调自己，直接 RangeError 爆栈。
 */
const nativeCreateElement = (tag: string): HTMLElement =>
  Document.prototype.createElement.call(document, tag) as HTMLElement;

interface Harness {
  /** 触发 afterprint（用户关掉打印预览） */
  fireAfterPrint: () => void;
  /** 触发 contentWindow.onload，模拟打印文档渲染完成 */
  fireLoad: () => void;
  /** 写进打印 iframe 的完整 HTML */
  html: () => string;
  /** 最近一次创建的 iframe */
  iframe: () => HTMLElement | null;
  print: ReturnType<typeof vi.fn>;
}

/**
 * 打印的真实出口（系统打印对话框）在测试环境里不存在，
 * 所以把 iframe 的 contentWindow 换成可控的假窗口：
 * 断言只看「写进去了什么 HTML」和「收尾回调跑了几次」。
 */
function createHarness(): Harness {
  const chunks: string[] = [];
  const listeners = new Map<string, Array<() => void>>();
  const print = vi.fn();

  const fakeWindow = {
    addEventListener: (type: string, handler: () => void) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(handler);
    },
    document: {
      close: vi.fn(),
      open: vi.fn(),
      write: (html: string) => chunks.push(html),
    },
    focus: vi.fn(),
    onload: null as (() => void) | null,
    print,
  };

  let lastIframe: HTMLElement | null = null;

  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = nativeCreateElement(tag);
    if (tag === 'iframe') {
      lastIframe = el;
      Object.defineProperty(el, 'contentWindow', {
        configurable: true,
        value: fakeWindow,
      });
    }
    return el;
  });

  return {
    fireAfterPrint: () =>
      listeners.get('afterprint')?.forEach((handler) => handler()),
    fireLoad: () => fakeWindow.onload?.(),
    html: () => chunks.join('\n'),
    iframe: () => lastIframe,
    print,
  };
}

function mountTarget(id: string, innerHTML = '<p>正文</p>') {
  const el = document.createElement('div');
  el.id = id;
  el.innerHTML = innerHTML;
  document.body.append(el);
}

describe('usePrint', () => {
  let harness: Harness;

  beforeEach(() => {
    document.body.replaceChildren();
    messageError.mockClear();
    harness = createHarness();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  const call = (options: Partial<PrintOptions> = {}) =>
    usePrint({
      target: '#print-area',
      title: '月度报表',
      ...options,
    } as PrintOptions);

  it('找不到目标元素时给出提示，不创建 iframe 也不写文档', () => {
    call({ target: '#not-exist' });
    expect(messageError).toHaveBeenCalledWith('未找到打印目标元素');
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
    expect(harness.html()).toBe('');
  });

  it('打印内容取自目标元素的 innerHTML', () => {
    mountTarget('print-area');
    call();
    expect(harness.html()).toContain('<div class="print-content"><p>正文</p></div>');
  });

  it('标题做 HTML 转义，避免把用户数据拼成标签', () => {
    mountTarget('print-area');
    call({ title: '<img src=x onerror=alert(1)>' });
    const html = harness.html();
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });

  it('自定义样式只拦 </style，不整体转义（否则 CSS 选择器会被写坏）', () => {
    mountTarget('print-area');
    call({ styles: 'td > b { color: red } </style><script>alert(1)</script>' });
    const html = harness.html();
    expect(html).toContain('td > b { color: red }');
    expect(html).toContain('&lt;/style>');
    expect(html).not.toContain('</style><script>alert(1)');
  });

  it('页眉页脚可关', () => {
    // 只判断标记，不判断类名：默认打印样式表里本来就有 .print-header / .print-footer
    mountTarget('print-area');
    call();
    expect(harness.html()).toContain('<div class="print-header">');
    expect(harness.html()).toContain('<div class="print-footer">');

    harness = createHarness();
    call({ showFooter: false, showHeader: false });
    expect(harness.html()).not.toContain('<div class="print-header">');
    expect(harness.html()).not.toContain('<div class="print-footer">');
  });

  it('onBeforePrint 先跑，收尾回调只跑一次且 iframe 被移除', () => {
    vi.useFakeTimers();
    mountTarget('print-area');
    const onAfterPrint = vi.fn();
    const onBeforePrint = vi.fn();
    call({ onAfterPrint, onBeforePrint });

    expect(onBeforePrint).toHaveBeenCalledTimes(1);
    expect(onAfterPrint).not.toHaveBeenCalled();

    harness.fireLoad();
    expect(harness.print).toHaveBeenCalledTimes(1);

    // onload 的兜底定时器和 afterprint 事件在同一次打印里都会到达。
    // 早期实现让 onAfterPrint 跑了两遍，第二遍还会因为 iframe 已经摘掉而抛 NotFoundError。
    harness.fireAfterPrint();
    vi.advanceTimersByTime(2000);

    expect(onAfterPrint).toHaveBeenCalledTimes(1);
    expect(harness.iframe()?.parentNode ?? null).toBeNull();
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
  });

  it('contentWindow 不可用时提示并清掉 iframe', () => {
    mountTarget('print-area');
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = nativeCreateElement(tag);
      if (tag === 'iframe') {
        Object.defineProperty(el, 'contentWindow', {
          configurable: true,
          value: null,
        });
      }
      return el;
    });

    call();
    expect(messageError).toHaveBeenCalledWith('创建打印窗口失败');
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
  });

  it('传入元素对象与传入选择器等价', () => {
    const el = document.createElement('div');
    el.innerHTML = '<span>by ref</span>';
    document.body.append(el);

    usePrint({ target: el, title: 'T' });
    expect(harness.html()).toContain('<span>by ref</span>');
  });
});

import type { MarkdownEditorInstance } from '../types';

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { safeHtmlDirective } from '@antdv/shared/xss';

import MarkdownEditor from '../MarkdownEditor.vue';

/**
 * `MarkdownEditor` 与外部 `value` 的同步契约。
 *
 * 这个组件是"编辑器 ↔ 表单"的唯一接缝，两条最容易踩的规则都在这里：
 *
 * 1. **初值要看得见**：tiptap 不会因为初始 `content` 抛 `onUpdate`，
 *    所以字数统计得在挂载时补一次，否则带初值打开永远显示"0 字"。
 * 2. **屏蔽期只挡回声**：组件抛 `update:value` 后有 200ms 的屏蔽期，
 *    用来挡住父组件把同一个值原样传回来导致的多余重解析（光标跳回文首）。
 *    早先是无条件 return，于是"挂载后立刻换一整篇内容"也被一起吞掉 ——
 *    富文本示例页就是这么打开成空白的。现在按文本判定：等价才挡。
 */

type Instance = MarkdownEditorInstance;

function vm(wrapper: ReturnType<typeof mount>): Instance {
  return wrapper.vm as unknown as Instance;
}

async function mountEditor(value = '', props: Record<string, unknown> = {}) {
  const wrapper = mount(MarkdownEditor, {
    attachTo: document.body,
    global: {
      // `v-safe-html` 由 main.ts 全局注册，测试里没有 app 实例，手动挂上
      directives: { 'safe-html': safeHtmlDirective },
    },
    props: { height: 200, value, ...props },
  });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  // vueuse 的 useResizeObserver / useElementSize 在无 ResizeObserver 的环境里直接抛
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as any).ResizeObserver = class {
      disconnect() {}
      observe() {}
      unobserve() {}
    };
  }
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addListener: vi.fn(),
      matches: false,
      media: query,
      removeListener: vi.fn(),
    }));
  }
  /**
   * jsdom 没有布局引擎：`Range`/`Element` 上根本没有 `getClientRects`，
   * 而 ProseMirror 每次 dispatch 后都会 `scrollToSelection()` → `coordsAtPos()`
   * 去量光标位置。不补这两个空实现，量不到就抛 `TypeError`，
   * 变成"用例全绿但 vitest 记一条 unhandled error"的假通过。
   */
  const emptyRects = () => [];
  for (const target of [Range.prototype, Element.prototype] as any[]) {
    if (typeof target.getClientRects !== 'function') {
      target.getClientRects = emptyRects;
    }
    if (typeof target.getBoundingClientRect !== 'function') {
      target.getBoundingClientRect = () =>
        ({ bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0 }) as DOMRect;
    }
  }
});

describe('MarkdownEditor 与外部 value 的同步', () => {
  it('初始 value 会渲染进编辑器，并且字数统计立刻反映初值', async () => {
    const wrapper = await mountEditor('<p>富文本示例内容</p>');

    expect(vm(wrapper).getHtml()).toContain('富文本示例内容');
    // 回归点：初值不触发 onUpdate，统计必须挂载时补一次
    expect(vm(wrapper).getStats().textLength).toBeGreaterThan(0);

    wrapper.unmount();
  });

  it('空初值时统计为 0，且不会凭空产生内容', async () => {
    const wrapper = await mountEditor('');

    expect(vm(wrapper).getStats().textLength).toBe(0);
    expect(vm(wrapper).getText()).toBe('');

    wrapper.unmount();
  });

  it('屏蔽期内的真·外部改写必须落地（回归：曾被回声守卫一起吞掉）', async () => {
    const wrapper = await mountEditor('');

    // 先制造一次内部更新，把组件推进 200ms 屏蔽期
    vm(wrapper).insertHtml('<p>内部输入</p>');
    await flushPromises();

    // 紧接着外部换一整篇 —— 旧实现会静默丢弃
    await wrapper.setProps({ value: '<h1>外部换掉的一整篇</h1>' });
    await flushPromises();

    expect(vm(wrapper).getHtml()).toContain('外部换掉的一整篇');

    wrapper.unmount();
  });

  it('屏蔽期内的回声（等价文本、字符串不同）不重解析、不再抛 update:value', async () => {
    const wrapper = await mountEditor('');

    vm(wrapper).insertHtml('<p>回声内容</p>');
    await flushPromises();

    const emitted = wrapper.emitted('update:value') ?? [];
    const lastHtml = String(emitted.at(-1)?.[0] ?? '');
    expect(lastHtml).toContain('回声内容');

    // 父组件把同一个值加了空白再传回来：文本等价，属于回声
    await wrapper.setProps({ value: `  ${lastHtml}\n` });
    await flushPromises();

    expect(vm(wrapper).getHtml()).toContain('回声内容');
    expect(wrapper.emitted('update:value')?.length).toBe(emitted.length);

    wrapper.unmount();
  });

  it('clear() 会同时清空内容与外部模型', async () => {
    const wrapper = await mountEditor('<p>要被清掉的内容</p>');

    vm(wrapper).clear();
    await flushPromises();

    expect(vm(wrapper).getText()).toBe('');
    const emitted = wrapper.emitted('update:value') ?? [];
    expect(String(emitted.at(-1)?.[0] ?? 'x')).not.toContain('要被清掉的内容');

    wrapper.unmount();
  });

  /**
   * `mode="split"` 在类型里声明了却没有任何实现：切过去只是"编辑态换个名字"，
   * 预览栏根本不存在。现在补上实时渲染的预览栏，用例锁住三件事：
   * 有预览栏、跟随输入更新、编辑/预览模式各自的数量。
   */
  it('mode="split" 渲染实时预览栏，并随输入更新', async () => {
    const wrapper = await mountEditor('<p>分屏初始内容</p>', { mode: 'split' });

    const panes = () => wrapper.findAll('[data-preview-scroll]');
    expect(panes()).toHaveLength(1);
    expect(panes()[0]!.text()).toContain('分屏初始内容');

    vm(wrapper).insertHtml('<p>新追加的一段</p>');
    await flushPromises();
    expect(panes()[0]!.text()).toContain('新追加的一段');

    wrapper.unmount();
  });

  it('编辑模式不渲染预览栏，预览模式锁住编辑', async () => {
    const edit = await mountEditor('<p>编辑态</p>', { mode: 'edit' });
    expect(edit.findAll('[data-preview-scroll]')).toHaveLength(0);
    expect(edit.find('[data-editor-scroll]').exists()).toBe(true);
    edit.unmount();

    const preview = await mountEditor('<p>预览态</p>', { mode: 'preview' });
    expect(preview.findAll('[data-preview-scroll]')).toHaveLength(0);
    // 预览态不显示工具栏
    expect(preview.find('.markdown-editor button').exists()).toBe(false);
    preview.unmount();
  });
});

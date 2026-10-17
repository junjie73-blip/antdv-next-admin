import type { MarkdownEditorInstance } from '../src/components/markdown-editor/types';

import { flushPromises, mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import MarkdownEditor from '../src/components/markdown-editor/MarkdownEditor.vue';

/**
 * Markdown ↔ 文档的往返（`contentType="markdown"`）。
 *
 * `getMarkdown()` 以前返回的是 `getHTML()`、`setMarkdown()` 以前把 HTML 整篇塞进去 ——
 * 名字与内容不符，表单侧存下来的其实是 HTML。现在两侧各自诚实：
 * Markdown 走 `docToMarkdown` / `markdownToDoc`，HTML 只在 `getHTML` / `setHTML` 上出现。
 *
 * 断言都过一遍真实 schema（挂载编辑器 + ProseMirror 归一化），而不是拿纯函数自说自话：
 * 解析结果要能被扩展集合接住，序列化才能被视为"这条语法确实支持"。
 *
 * 每条夹具都是**规范化后的形态**（序列化器的输出），因此 `md → 文档 → md` 必须逐字相等。
 */

const FIXTURES: Array<{ name: string; md: string; html: string }> = [
  {
    html: '<h1>',
    md: '# 一级标题\n\n## 二级标题',
    name: '标题',
  },
  {
    html: '<strong>粗体</strong>',
    md: '**粗体** 与 *斜体* 与 ~~删除~~ 与 `行内代码`',
    name: '行内标记',
  },
  {
    html: '<pre>',
    md: '```js\nconst a = 1;\n```',
    name: '代码块',
  },
  {
    html: '<blockquote>',
    md: '> 引用的一行',
    name: '引用',
  },
  {
    html: '<ul>',
    md: '- 甲\n- 乙',
    name: '无序列表',
  },
  {
    html: '<ol>',
    md: '1. 一\n2. 二',
    name: '有序列表',
  },
  {
    html: 'type="checkbox"',
    md: '- [x] 已完成\n- [ ] 待办',
    name: '任务列表',
  },
  {
    html: 'href="https://antdv.dev"',
    md: '[官网](https://antdv.dev)',
    name: '链接',
  },
  {
    html: '<img',
    md: '![配图](https://example.com/a.png)',
    name: '图片',
  },
  {
    html: '<table',
    md: '| 名称 | 数量 |\n| --- | --- |\n| 苹果 | 3 |',
    name: '表格',
  },
  {
    html: 'text-align: center',
    md: '<p style="text-align: center">居中的一段</p>',
    name: '对齐',
  },
];

async function mountMarkdown(value: string) {
  const wrapper = mount(MarkdownEditor, {
    attachTo: document.body,
    props: { contentType: 'markdown', height: 240, value },
  });
  await flushPromises();
  return wrapper;
}

function inst(wrapper: ReturnType<typeof mount>): MarkdownEditorInstance {
  return wrapper.vm as unknown as MarkdownEditorInstance;
}

describe('markdownEditor 的 Markdown 往返', () => {
  it.each(FIXTURES)(
    '$name：解析 → 渲染 → 序列化回原样',
    async ({ html, md }) => {
      const wrapper = await mountMarkdown(md);
      const editor = wrapper.find('.tiptap');

      // 解析方向：真的渲染成了对应结构，而不是一坨纯文本
      expect(editor.html()).toContain(html);
      // 序列化方向：回到逐字相同的 Markdown
      expect(inst(wrapper).getMarkdown()).toBe(md);
      // HTML 与 Markdown 是两个口径，getMarkdown 不能等于 getHTML
      expect(inst(wrapper).getMarkdown()).not.toBe(inst(wrapper).getHTML());

      wrapper.unmount();
    },
  );

  it('markdown 反复往返稳定（第二次序列化不再变化）', async () => {
    const source =
      '# 标题\n\n正文含 **粗体** 与 [链接](https://antdv.dev)\n\n- [x] 任务\n- [ ] 任务\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n<p style="text-align: right">靠右</p>';
    const wrapper = await mountMarkdown(source);

    const first = inst(wrapper).getMarkdown();
    inst(wrapper).setMarkdown(first);
    await flushPromises();
    const second = inst(wrapper).getMarkdown();

    expect(second).toBe(first);
    expect(first).toContain('# 标题');
    expect(first).toContain('- [x] 任务');
    expect(first).toContain('<p style="text-align: right">靠右</p>');

    wrapper.unmount();
  });

  it('setMarkdown 写的是 Markdown，getHTML 才是 HTML', async () => {
    const wrapper = await mountMarkdown('');

    inst(wrapper).setMarkdown('## 小标题\n\n- 项目一');
    await flushPromises();

    expect(wrapper.find('.tiptap').html()).toContain('<h2>小标题</h2>');
    expect(inst(wrapper).getMarkdown()).toBe('## 小标题\n\n- 项目一');
    expect(inst(wrapper).getHTML()).toContain('<h2>小标题</h2>');
    // update:value 抛给表单的同样是 Markdown 源码
    const emitted = wrapper.emitted('update:value') ?? [];
    expect(String(emitted.at(-1)?.[0] ?? '')).toBe('## 小标题\n\n- 项目一');

    wrapper.unmount();
  });

  it('外部 Markdown 变化会重解析，等价回声不会重复抛', async () => {
    const wrapper = await mountMarkdown('# 初值');

    await wrapper.setProps({ value: '# 外部换掉' });
    await flushPromises();
    expect(wrapper.find('.tiptap').html()).toContain('外部换掉');
    expect(inst(wrapper).getMarkdown()).toBe('# 外部换掉');

    const before = (wrapper.emitted('update:value') ?? []).length;
    // 父组件原样回传：等价，不该再触发一次
    await wrapper.setProps({ value: '# 外部换掉' });
    await flushPromises();
    expect((wrapper.emitted('update:value') ?? []).length).toBe(before);

    wrapper.unmount();
  });

  it('用户编辑（工具栏加粗）后 update:value 抛 Markdown', async () => {
    const wrapper = await mountMarkdown('要加粗的文字');
    const editor = inst(wrapper).getEditor();
    expect(editor).toBeTruthy();

    editor?.chain().focus().selectAll().toggleBold().run();
    await flushPromises();

    expect(inst(wrapper).getMarkdown()).toBe('**要加粗的文字**');
    const emitted = wrapper.emitted('update:value') ?? [];
    expect(String(emitted.at(-1)?.[0] ?? '')).toBe('**要加粗的文字**');

    wrapper.unmount();
  });

  it('默认 contentType 仍是 html，旧调用方不受影响', async () => {
    const wrapper = mount(MarkdownEditor, {
      attachTo: document.body,
      props: { value: '<p>纯 HTML</p>' },
    });
    await flushPromises();

    const emitted = wrapper.emitted('update:value') ?? [];
    expect(inst(wrapper).getHTML()).toContain('<p>纯 HTML</p>');
    // 未开 markdown 时模型值就是 HTML 本身
    expect(emitted.length).toBe(0);

    wrapper.unmount();
  });

  it('空 Markdown 不会解析出幽灵段落内容', async () => {
    const wrapper = await mountMarkdown('');
    expect(inst(wrapper).getMarkdown()).toBe('');
    expect(inst(wrapper).getText()).toBe('');
    wrapper.unmount();
  });
});

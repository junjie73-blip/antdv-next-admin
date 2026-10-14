<script setup lang="ts">
import type {
  MarkdownEditorInstance,
  MarkdownEditorMode,
} from '~/components/business/MarkdownEditor';

import { computed, nextTick, ref, useTemplateRef } from 'vue';

import {
  Card,
  Divider,
  Scrollbar,
  Segmented,
  Space,
  TabPane,
  Tabs,
  Tag,
  Tooltip,
} from '@antdv/common-ui';
import { message } from '@antdv/popup-ui';

import { Button, Switch } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/cn';
import { Icon } from '@iconify/vue';
import { useClipboard } from '@vueuse/core';
import hljs from 'highlight.js';
import MarkdownIt from 'markdown-it';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import { MarkdownEditor } from '~/components/business/MarkdownEditor';

import 'highlight.js/styles/github-dark.css';

/**
 * 编辑器示例：原「Markdown 编辑器」与「富文本编辑器」两个菜单合并为一页，路由 `/components/editor`。
 *
 * 先说清一件事 —— 这两个 Tab **不是**同一个包装器的两种模式（对照过源码）：
 * - Markdown 编辑：本文件自己实现的 `textarea` + `marked` / `markdown-it` + `highlight.js`，
 *   工具栏往源码里插 Markdown 语法，右侧用 `v-safe-html` 实时渲染 HTML。
 * - 富文本编辑：仓库内的 `MarkdownEditor`（tiptap），产出的是 HTML，
 *   `edit / split / preview` 是它的 `mode`，`readonly / disabled / showCount` 是它的 props。
 *
 * 合成一个菜单的理由是两者讲的是同一件事（编辑器），而「初始值 / 禁用 / 只读 / 取值 / 赋值」
 * 这套概念在两边完全同形，放在一张共用卡片里切着看比拆成两个菜单更好对照。
 *
 * 富文本这一侧的历史：它原先直连 `@wangeditor/editor`，而依赖清单里**从来没有装过它**：
 * 页面被路由排除规则屏蔽期间没人编译过它，所以"缺依赖"这件事一直没暴露。
 * 排除规则修好（见 internal/vite-config/src/plugins/vue.ts）之后它才第一次参与编译，
 * 表现是导航进来永远停在"页面加载中..."。
 * 现在改用仓库内的 `MarkdownEditor` —— 它就是当初 wangEditor 的 tiptap 替代实现，
 * 工具栏按键名、待办/视频节点都按 wangEditor 的存量格式对齐过。
 */
defineOptions({ name: 'ComponentsEditor' });

const activeKey = ref<'markdown' | 'rich-text'>('markdown');

/* ============================================================
 * 两个 Tab 共用的开关
 * ============================================================ */

const readonly = ref(false);
const disabled = ref(false);
const showCount = ref(true);

/* ============================================================
 * Tab 1：Markdown 编辑（textarea + marked / markdown-it）
 * ============================================================ */

const { copy, copied } = useClipboard();

const markedInstance = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code: string, lang: string) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
  }),
);

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(code: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      return `<pre class="hljs"><code class="hljs language-${lang}">${hljs.highlight(code, { language: lang }).value}</code></pre>`;
    }
    return `<pre class="hljs"><code class="hljs">${hljs.highlightAuto(code).value}</code></pre>`;
  },
});

const renderer = ref<'markdown-it' | 'marked'>('marked');

const defaultMarkdown = `# Markdown 编辑器演示

## 欢迎使用

这是一个 **实时预览** 的 Markdown 编辑器。在左侧编辑 Markdown 文本，右侧会即时显示渲染结果。

---

## 功能演示

### 文本样式

- **粗体文字** —— 使用 \`**text**\`
- *斜体文字* —— 使用 \`*text*\`
- ~~删除线~~ —— 使用 \`~~text~~\`
- \`行内代码\` —— 使用 \\\`code\\\`

### 引用

> 这是一段引用文字。
>
> 引用可以多行使用。

### 列表

1. 有序列表第一项
2. 有序列表第二项
3. 有序列表第三项

- 无序列表
  - 嵌套列表
    - 更深层级

### 代码块

\`\`\`typescript
interface User {
  name: string
  age: number
  email: string
}

function greet(user: User): string {
  return \`你好，\${user.name}！\`
}

const user: User = {
  name: '张三',
  age: 28,
  email: 'zhangsan@example.com',
}

console.log(greet(user))
\`\`\`

\`\`\`python
def fibonacci(n: int) -> list[int]:
    """生成斐波那契数列"""
    result = [0, 1]
    for _ in range(2, n):
        result.append(result[-1] + result[-2])
    return result[:n]

print(fibonacci(10))  # [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
\`\`\`

### 表格

| 姓名   | 年龄 | 城市     | 职位       |
| ------ | ---- | -------- | ---------- |
| 张三   | 28   | 北京     | 前端工程师 |
| 李四   | 32   | 上海     | 后端工程师 |
| 王五   | 25   | 深圳     | 产品经理   |
| 赵六   | 30   | 杭州     | 设计师     |

### 链接与图片

[GitHub](https://github.com)

![示例图片](https://via.placeholder.com/400x200/3b82f6/ffffff?text=Markdown)

### 任务列表

- [x] 学习 Vue 3
- [x] 学习 TypeScript
- [ ] 学习 Tailwind CSS
- [ ] 完成项目开发

### 数学公式（LaTeX 风格）

内联公式：$E = mc^2$

块级公式：

$$
\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

---

> 💡 **提示**：试试点击工具栏按钮来插入不同格式的 Markdown 语法！
`;

const markdownContent = ref(defaultMarkdown);

const renderedHtml = computed(() => {
  if (!markdownContent.value) return '';
  if (renderer.value === 'marked') {
    return markedInstance.parse(markdownContent.value) as string;
  }
  return md.render(markdownContent.value);
});

const textareaRef = useTemplateRef<HTMLTextAreaElement>('textareaRef');

/** 两个 Tab 共用：只读或禁用都不再允许改内容，口径对齐 `MarkdownEditor` 内部的 `isLocked` */
const contentLocked = computed(() => disabled.value || readonly.value);

function insertMarkdown(
  before: string,
  after = '',
  placeholder = '',
  keepSelection = false,
) {
  if (contentLocked.value) return;
  const textarea = textareaRef.value;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = markdownContent.value.substring(start, end);

  const replacement = keepSelection
    ? `${before}${selectedText}${after}`
    : `${before}${placeholder}${after}`;

  markdownContent.value =
    markdownContent.value.substring(0, start) +
    replacement +
    markdownContent.value.substring(end);

  void nextTick(() => {
    textarea.focus();
    if (keepSelection) {
      const newCursorEnd = start + replacement.length;
      textarea.setSelectionRange(newCursorEnd, newCursorEnd);
    } else {
      const cursorPos = start + before.length + placeholder.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    }
  });
}

function insertLink() {
  const textarea = textareaRef.value;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = markdownContent.value.substring(start, end);

  if (selectedText) {
    insertMarkdown('[', '](url)', selectedText, true);
  } else {
    insertMarkdown('[', '](url)', '链接文本');
  }
}

function insertImage() {
  const textarea = textareaRef.value;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = markdownContent.value.substring(start, end);

  if (selectedText) {
    insertMarkdown('![', '](url)', selectedText, true);
  } else {
    insertMarkdown('![', '](url)', '图片描述');
  }
}

function insertTable() {
  if (contentLocked.value) return;
  const tableTemplate =
    '\n| 列1   | 列2   | 列3   |\n| ----- | ----- | ----- |\n| 内容1 | 内容2 | 内容3 |\n| 内容4 | 内容5 | 内容6 |\n';
  const textarea = textareaRef.value;
  if (!textarea) return;

  const start = textarea.selectionStart;
  markdownContent.value =
    markdownContent.value.substring(0, start) +
    tableTemplate +
    markdownContent.value.substring(start);

  void nextTick(() => {
    textarea.focus();
    const cursorPos = start + 2;
    textarea.setSelectionRange(cursorPos, cursorPos);
  });
}

function insertHeading(level: number) {
  const prefix = `${'#'.repeat(level)} `;
  insertMarkdown(prefix, '', '标题文字');
}

function insertCodeBlock() {
  if (contentLocked.value) return;
  const template = '\n```\n\n```\n';
  const textarea = textareaRef.value;
  if (!textarea) return;

  const start = textarea.selectionStart;
  markdownContent.value =
    markdownContent.value.substring(0, start) +
    template +
    markdownContent.value.substring(start);

  void nextTick(() => {
    textarea.focus();
    const cursorPos = start + 5;
    textarea.setSelectionRange(cursorPos, cursorPos);
  });
}

function insertTaskList() {
  if (contentLocked.value) return;
  const template = '\n- [ ] 待办事项1\n- [ ] 待办事项2\n- [ ] 待办事项3\n';
  const textarea = textareaRef.value;
  if (!textarea) return;

  const start = textarea.selectionStart;
  markdownContent.value =
    markdownContent.value.substring(0, start) +
    template +
    markdownContent.value.substring(start);

  void nextTick(() => {
    textarea.focus();
    const cursorPos = start + 7;
    textarea.setSelectionRange(cursorPos, cursorPos);
  });
}

const toolbarGroups = [
  {
    buttons: [
      {
        label: '加粗',
        icon: 'carbon:text-bold',
        action: () => insertMarkdown('**', '**', '粗体文字', false),
      },
      {
        label: '斜体',
        icon: 'carbon:text-italic',
        action: () => insertMarkdown('*', '*', '斜体文字', false),
      },
      {
        label: '删除线',
        icon: 'carbon:text-strikethrough',
        action: () => insertMarkdown('~~', '~~', '删除线文字', false),
      },
      {
        label: '行内代码',
        icon: 'carbon:code',
        action: () => insertMarkdown('`', '`', '代码', false),
      },
    ],
  },
  {
    buttons: [
      { label: 'H1', icon: 'carbon:heading', action: () => insertHeading(1) },
      { label: 'H2', icon: 'carbon:heading', action: () => insertHeading(2) },
      { label: 'H3', icon: 'carbon:heading', action: () => insertHeading(3) },
    ],
  },
  {
    buttons: [
      {
        label: '引用',
        icon: 'carbon:quotes',
        action: () => insertMarkdown('\n> ', '', '引用内容', false),
      },
      {
        label: '无序列表',
        icon: 'carbon:list',
        action: () => insertMarkdown('\n- ', '', '列表项', false),
      },
      {
        label: '有序列表',
        icon: 'carbon:list-numbered',
        action: () => insertMarkdown('\n1. ', '', '列表项', false),
      },
      {
        label: '任务列表',
        icon: 'carbon:checkbox-checked',
        action: insertTaskList,
      },
    ],
  },
  {
    buttons: [
      { label: '代码块', icon: 'carbon:code-block', action: insertCodeBlock },
      { label: '表格', icon: 'carbon:table', action: insertTable },
    ],
  },
  {
    buttons: [
      { label: '链接', icon: 'carbon:link', action: insertLink },
      { label: '图片', icon: 'carbon:image', action: insertImage },
      {
        label: '分割线',
        icon: 'carbon:horizontal-line-solid',
        action: () => insertMarkdown('\n\n---\n\n', '', '', false),
      },
    ],
  },
];

/* ============================================================
 * Tab 2：富文本编辑（MarkdownEditor / tiptap）
 * ============================================================ */

const editorRef = ref<MarkdownEditorInstance | null>(null);
const mode = ref<MarkdownEditorMode>('edit');
const changeCount = ref(0);

const INITIAL_HTML = `<h1>富文本编辑器</h1><p>基于 <strong>tiptap</strong> 的所见即所得编辑器，支持标题、<em>斜体</em>、<u>下划线</u>、<s>删除线</s>、<code>行内代码</code>、高亮与列表。</p><ul><li>工具栏：正文 / 标题 1~5</li><li>对齐：左 / 中 / 右</li><li>插入：链接、图片、视频、表格、代码块、待办</li></ul><blockquote>引用块：适合放提示语。</blockquote><table><tbody><tr><th>能力</th><th>说明</th></tr><tr><td>双向绑定</td><td>v-model:value 直接给 HTML</td></tr><tr><td>实例方法</td><td>setHtml / insertText / getMarkdown …</td></tr></tbody></table>`;

/**
 * 初值走 `value` 的**初始值**而不是挂载后 `setHtml()`。
 *
 * 两种写法看着等价，实际不等：`created` 事件抛出时组件的实例方法还拿不到编辑器，
 * 而挂载后立刻写 `html` 又落在编辑器自己的 200ms 回声屏蔽期里 ——
 * 表现是"示例页打开是空白的"。初值直接给 prop 才是这条链路的正解。
 */
const html = ref(INITIAL_HTML);

/** 本地生成的占位图：`insertImage()` 只吃一个 URL，这里不请求任何接口 */
const SAMPLE_IMAGE_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160"><rect width="320" height="160" fill="#0ea5e9"/><text x="16" y="92" font-size="24" fill="#ffffff" font-family="system-ui">本地占位图</text></svg>',
)}`;

function handleClear() {
  editorRef.value?.clear();
  message.success('已清空内容');
}

function handleInsertText() {
  editorRef.value?.insertText('（在光标处插入的文本）');
}

function handleInsertHtml() {
  editorRef.value?.insertHtml(
    '<p style="color:#0ea5e9">插入的一段带样式内容</p>',
  );
}

function handleInsertImage() {
  editorRef.value?.insertImage(SAMPLE_IMAGE_URL, '示例图片');
}

function handleUndo() {
  editorRef.value?.undo();
}

function handleRedo() {
  editorRef.value?.redo();
}

function handleFocus() {
  editorRef.value?.focus();
}

function handleChange() {
  changeCount.value += 1;
}

function handleLogMarkdown() {
  const md = editorRef.value?.getMarkdown() ?? '';
  message.info(`已生成 Markdown 源码，共 ${md.length} 字符`);
  console.log('[rich-text demo] markdown:\n', md);
}

/* ============================================================
 * 共用操作：取值 / 赋值 / 恢复初始值（作用于当前 Tab）
 * ============================================================ */

/** 取值：Markdown 侧读 `v-model` 绑定的 ref，富文本侧读实例的 `getHtml()` */
function handleGetValue() {
  if (activeKey.value === 'markdown') {
    const value = markdownContent.value;
    message.info(`已取到 Markdown 源码，共 ${value.length} 字符`);
    console.log('[editor demo] markdown value:\n', value);
    return;
  }
  const value = editorRef.value?.getHtml() ?? '';
  message.info(`已取到 HTML，共 ${value.length} 字符`);
  console.log('[editor demo] html value:\n', value);
}

/** 赋值：两边都是"整篇替换"，Markdown 直接写 ref，富文本走 `setHtml()` */
function handleSetValue() {
  if (activeKey.value === 'markdown') {
    markdownContent.value =
      '## 由「赋值」写入的 Markdown\n\n- 右侧预览区会立刻跟着重渲染\n- 引擎切换（marked / markdown-it）不影响这次赋值\n';
    message.success('已通过 ref 写入 Markdown 内容');
    return;
  }
  editorRef.value?.setHtml(
    '<h2>由「赋值」写入的 HTML</h2><p>走实例方法 <code>setHtml()</code>，<code>v-model:value</code> 会同步刷新。</p>',
  );
  message.success('已通过 setHtml() 写入 HTML 内容');
}

function handleResetInitial() {
  if (activeKey.value === 'markdown') {
    markdownContent.value = defaultMarkdown;
    message.success('已恢复 Markdown 初始内容');
    return;
  }
  editorRef.value?.setHtml(INITIAL_HTML);
  message.success('已恢复富文本初始内容');
}

/* ============================================================
 * 类名
 * ============================================================ */

/** 内边距归布局管：路由页面根容器不留 padding */
const containerClassName = cn('space-y-6');

const pageTitleClassName = cn(
  'text-2xl font-bold',
  'text-gray-800 dark:text-gray-100',
  'mb-1',
);

const pageSubtitleClassName = cn(
  'text-sm text-gray-500 dark:text-gray-400',
  'mb-4',
);

const introClassName = cn(
  'text-sm',
  'text-gray-500 dark:text-gray-400',
  '[&_code]:text-xs [&_code]:text-gray-700 [&_code]:dark:text-gray-200',
);

const fieldLabelClassName = cn('text-sm text-gray-500 dark:text-gray-400');

const hintClassName = cn(
  'mt-3 text-xs',
  'text-gray-400 dark:text-gray-500',
  '[&_code]:text-gray-500 [&_code]:dark:text-gray-300',
);

const editorPaneClassName = cn(
  'flex min-w-0 flex-1 flex-col',
  'overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700',
);

const editorTitleClassName = cn(
  'px-4 py-2.5',
  'text-sm font-semibold',
  'bg-gray-50 dark:bg-gray-800',
  'text-gray-700 dark:text-gray-200',
  'border-b border-gray-200 dark:border-gray-700',
  'flex items-center gap-2',
);

const toolbarContainerClassName = cn(
  'flex flex-wrap items-center gap-1',
  'px-2 py-1.5',
  'bg-gray-50/50 dark:bg-gray-800/50',
  'border-b border-gray-200 dark:border-gray-700',
);

const toolbarButtonBaseClassName = cn(
  'inline-flex items-center justify-center',
  'size-7 rounded-sm',
  'text-gray-600 dark:text-gray-400',
  'hover:bg-gray-200 dark:hover:bg-gray-700',
  'hover:text-gray-800 dark:hover:text-gray-200',
  'transition-colors duration-150',
  'text-xs',
  'disabled:cursor-not-allowed disabled:opacity-40',
  'disabled:hover:bg-transparent disabled:hover:text-gray-600',
);

const toolbarDividerClassName = cn(
  'mx-0.5 h-4 w-px',
  'bg-gray-300 dark:bg-gray-600',
);

const textareaClassName = cn(
  'w-full flex-1 p-4',
  'text-sm/relaxed',
  'bg-white dark:bg-gray-900',
  'text-gray-800 dark:text-gray-200',
  'placeholder-gray-400 dark:placeholder-gray-500',
  'resize-none border-none outline-none',
  'font-mono',
  'disabled:cursor-not-allowed',
);

const previewTitleClassName = cn(
  'px-4 py-2.5',
  'text-sm font-semibold',
  'bg-gray-50 dark:bg-gray-800',
  'text-gray-700 dark:text-gray-200',
  'border-b border-gray-200 dark:border-gray-700',
  'flex items-center justify-between',
);

const previewScrollbarClassName = cn('flex-1');

const previewContentClassName = cn(
  'p-4',
  'dark:prose-invert prose prose-sm max-w-none',
  'dark:prose-headings:text-gray-100 prose-headings:text-gray-800',
  'dark:prose-p:text-gray-300 prose-p:text-gray-700',
  'dark:prose-a:text-blue-400 prose-a:text-blue-500',
  'dark:prose-code:text-pink-400 prose-code:text-pink-500',
  'dark:prose-code:bg-gray-800 prose-code:bg-gray-100',
  'prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm',
  'dark:prose-pre:bg-gray-950 prose-pre:bg-gray-900',
  'prose-pre:border prose-pre:border-gray-700',
  'prose-table:border-collapse',
  'dark:prose-th:border-gray-600 prose-th:border prose-th:border-gray-300',
  'prose-th:px-4 prose-th:py-2',
  'dark:prose-th:bg-gray-800 prose-th:bg-gray-50',
  'dark:prose-td:border-gray-600 prose-td:border prose-td:border-gray-300',
  'prose-td:px-4 prose-td:py-2',
  'prose-img:rounded-lg prose-img:shadow-md',
  'prose-blockquote:border-blue-500 prose-blockquote:border-l-4',
  'dark:prose-blockquote:bg-blue-950/30 prose-blockquote:bg-blue-50/50',
  'prose-blockquote:px-4 prose-blockquote:py-2',
  // 原代码块的浏览器横向滚动类已移除：横向溢出改由外层 Scrollbar 的 wrap 统一滚动
  '[&_pre]:rounded-lg',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
);

/** 页头比原 Markdown 页多了标题卡与 Tab 栏，可视高度相应扣掉这一段 */
const mainContainerClassName = cn(
  'flex h-[calc(100vh-400px)] min-h-[420px] flex-1 gap-4',
);

const copyBtnClassName = cn(
  'inline-flex items-center gap-1',
  'rounded-sm px-2 py-0.5 text-xs',
  'text-gray-500 dark:text-gray-400',
  'hover:bg-gray-200 dark:hover:bg-gray-700',
  'transition-colors duration-150',
);

const emptyPreviewClassName = cn(
  'flex h-full items-center justify-center',
  'text-gray-400 dark:text-gray-500',
  'text-sm',
);

const wordCountClassName = cn('text-xs text-gray-400 dark:text-gray-500');

const rendererToggleClassName = cn(
  'inline-flex items-center',
  'text-xs',
  'bg-gray-100 dark:bg-gray-800',
  'rounded-lg p-0.5',
);

const rendererOptionClassName = cn(
  'rounded-md px-2.5 py-0.5',
  'transition-colors duration-150',
);

/**
 * 渲染引擎切换按钮的选中 / 未选中态。
 *
 * 提到脚本里算：模板内联 `cn(...)` 一旦带上尾随逗号，Vue 模板解析器会报
 * "Unexpected EOF in tag"，整页编译不过。
 */
const OPTION_ACTIVE =
  'bg-white font-medium text-gray-800 shadow-sm dark:bg-gray-700 dark:text-gray-200';
const OPTION_IDLE =
  'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300';

const markedOptionClassName = computed(() =>
  cn(
    rendererOptionClassName,
    renderer.value === 'marked' ? OPTION_ACTIVE : OPTION_IDLE,
  ),
);

const markdownItOptionClassName = computed(() =>
  cn(
    rendererOptionClassName,
    renderer.value === 'markdown-it' ? OPTION_ACTIVE : OPTION_IDLE,
  ),
);

const outputPreClassName = cn(
  'overflow-wrap-anywhere px-1 whitespace-pre-wrap',
  'font-mono text-xs',
  'text-gray-600 dark:text-gray-300',
);
</script>

<template>
  <div :class="containerClassName">
    <div>
      <h1 :class="pageTitleClassName">编辑器</h1>
      <p :class="pageSubtitleClassName">
        Markdown 编辑（marked + highlight.js + markdown-it
        实时预览）与富文本编辑（tiptap 版
        <code>MarkdownEditor</code>）两种写法合并在一页的两个 Tab 里
      </p>
    </div>

    <Card title="两种模式共用的配置">
      <p :class="introClassName">
        这两个 Tab 不是同一个组件的两种模式：Markdown 侧是本页手写的
        <code>textarea</code> 加纯前端渲染，富文本侧是仓库内的
        <code>MarkdownEditor</code>（tiptap，产出 HTML）。
        之所以并成一个菜单，是因为「初始值 / 禁用 / 只读 / 取值 /
        赋值」这套概念两边完全同形，
        放在同一张卡片上切着对照，比拆成两个菜单更好读。下面的开关与按钮同时作用于两个
        Tab。
      </p>

      <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div class="flex items-center gap-2">
          <span :class="fieldLabelClassName">只读</span>
          <Switch
            :model-value="readonly"
            @update:model-value="(v: boolean) => (readonly = v)"
          />
        </div>
        <div class="flex items-center gap-2">
          <span :class="fieldLabelClassName">禁用</span>
          <Switch
            :model-value="disabled"
            @update:model-value="(v: boolean) => (disabled = v)"
          />
        </div>
        <div class="flex items-center gap-2">
          <span :class="fieldLabelClassName">字数统计</span>
          <Switch
            :model-value="showCount"
            @update:model-value="(v: boolean) => (showCount = v)"
          />
        </div>
        <Divider type="vertical" class="h-5!" />
        <Space wrap :size="8">
          <Button size="sm" variant="outline" @click="handleGetValue">
            <Icon icon="carbon:copy" />
            取值
          </Button>
          <Button
            size="sm"
            variant="outline"
            :disabled="contentLocked"
            @click="handleSetValue"
          >
            <Icon icon="carbon:edit" />
            赋值
          </Button>
          <Button
            size="sm"
            variant="outline"
            :disabled="contentLocked"
            @click="handleResetInitial"
          >
            <Icon icon="carbon:reset" />
            恢复初始值
          </Button>
        </Space>
      </div>
    </Card>

    <Card>
      <Tabs v-model:active-key="activeKey">
        <!-- ============ Markdown 编辑 ============ -->
        <TabPane value="markdown" tab="Markdown 编辑">
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <span :class="fieldLabelClassName">渲染引擎：</span>
            <div :class="rendererToggleClassName">
              <button
                type="button"
                :class="markedOptionClassName"
                @click="renderer = 'marked'"
              >
                marked
              </button>
              <button
                type="button"
                :class="markdownItOptionClassName"
                @click="renderer = 'markdown-it'"
              >
                markdown-it
              </button>
            </div>
            <span :class="wordCountClassName">
              纯前端渲染，不发请求；只影响右侧预览区的 HTML
            </span>
          </div>

          <!-- 左右分栏 -->
          <div :class="mainContainerClassName">
            <!-- 左侧编辑面板 -->
            <div :class="editorPaneClassName">
              <div :class="editorTitleClassName">
                <Icon class="text-base" icon="carbon:edit" />
                <span>编辑区</span>
                <span v-if="contentLocked" :class="wordCountClassName">
                  {{ disabled ? '已禁用' : '只读中' }}，工具栏插入与赋值已停用
                </span>
              </div>

              <!-- 工具栏 -->
              <div :class="toolbarContainerClassName">
                <template v-for="(group, idx) in toolbarGroups" :key="idx">
                  <span v-if="idx > 0" :class="toolbarDividerClassName"></span>
                  <Tooltip
                    v-for="btn in group.buttons"
                    :key="btn.label"
                    :title="btn.label"
                    placement="top"
                  >
                    <button
                      type="button"
                      :class="toolbarButtonBaseClassName"
                      :disabled="contentLocked"
                      @click="btn.action()"
                    >
                      <Icon :icon="btn.icon" :width="14" />
                    </button>
                  </Tooltip>
                </template>
              </div>

              <!-- 编辑区 -->
              <textarea
                ref="textareaRef"
                v-model="markdownContent"
                :class="textareaClassName"
                :readonly="readonly"
                :disabled="disabled"
                placeholder="在此输入 Markdown 内容..."
                spellcheck="false"
              ></textarea>
            </div>

            <!-- 右侧预览面板 -->
            <div :class="editorPaneClassName">
              <div :class="previewTitleClassName">
                <div class="flex items-center gap-2">
                  <Icon class="text-base" icon="carbon:thumbnail-preview" />
                  <span>预览区</span>
                </div>
                <div class="flex items-center gap-2">
                  <span v-if="showCount" :class="wordCountClassName">
                    {{ markdownContent.length }} 字
                  </span>
                  <button
                    type="button"
                    :class="copyBtnClassName"
                    @click="copy(renderedHtml)"
                  >
                    <Icon class="text-xs" icon="carbon:copy" />
                    {{ copied ? '已复制' : '复制HTML' }}
                  </button>
                </div>
              </div>

              <!-- 预览内容（使用安全指令：保留合法HTML标签，过滤script和事件处理器） -->
              <Scrollbar
                v-if="renderedHtml"
                :root-class="previewScrollbarClassName"
              >
                <div
                  v-safe-html="{ content: renderedHtml, allowHtml: true }"
                  :class="previewContentClassName"
                ></div>
              </Scrollbar>
              <div v-else :class="emptyPreviewClassName">
                <div class="text-center">
                  <Icon
                    class="mx-auto mb-2 text-4xl opacity-30"
                    icon="carbon:document-blank"
                  />
                  <p>在左侧输入 Markdown 内容后，此处将实时预览渲染结果</p>
                </div>
              </div>
            </div>
          </div>
        </TabPane>

        <!-- ============ 富文本编辑 ============ -->
        <TabPane value="rich-text" tab="富文本编辑">
          <div class="mb-3 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div class="flex items-center gap-2">
              <span :class="fieldLabelClassName">模式</span>
              <Segmented
                v-model:value="mode"
                :options="[
                  { label: '编辑', value: 'edit' },
                  { label: '分屏', value: 'split' },
                  { label: '预览', value: 'preview' },
                ]"
              />
            </div>
            <div
              class="ml-auto flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
            >
              <Tag color="blue">change × {{ changeCount }}</Tag>
            </div>
          </div>

          <MarkdownEditor
            ref="editorRef"
            v-model:value="html"
            :mode="mode"
            :readonly="readonly"
            :disabled="disabled"
            :show-count="showCount"
            :height="420"
            placeholder="请输入内容..."
            @change="handleChange"
          />

          <Card class="mt-4" title="实例方法（MarkdownEditor ref）">
            <Space wrap :size="8">
              <Button size="sm" variant="outline" @click="handleInsertText">
                <Icon icon="carbon:zoom-in" />
                插入文本
              </Button>
              <Button size="sm" variant="outline" @click="handleInsertHtml">
                <Icon icon="carbon:code" />
                插入 HTML
              </Button>
              <Button size="sm" variant="outline" @click="handleInsertImage">
                <Icon icon="carbon:image" />
                插入图片
              </Button>
              <Button size="sm" variant="outline" @click="handleUndo">
                <Icon icon="carbon:undo" />
                撤销
              </Button>
              <Button size="sm" variant="outline" @click="handleRedo">
                <Icon icon="carbon:redo" />
                重做
              </Button>
              <Button size="sm" variant="outline" @click="handleFocus">
                <Icon icon="carbon:cursor-1" />
                聚焦
              </Button>
              <Button size="sm" variant="outline" @click="handleLogMarkdown">
                <Icon icon="carbon:string-text" />
                导出 Markdown
              </Button>
              <Button size="sm" variant="destructive" @click="handleClear">
                <Icon icon="carbon:trash-can" />
                清空
              </Button>
            </Space>
            <p :class="hintClassName">
              「导出 Markdown」与「取值」只读本地内容，结果打到控制台；
              「插入图片」用的是本地生成的 data URL，不请求接口。
              工具栏上的「上传图片 / 上传视频」才会走组件内置上传 （<code
                >POST /api/upload/file</code
              >），本地由 mock 返回一张内联 SVG 占位图，不落盘。
            </p>
          </Card>

          <Card class="mt-4" title="v-model:value 产出的 HTML">
            <Scrollbar max-height="180px">
              <pre :class="outputPreClassName">{{ html }}</pre>
            </Scrollbar>
          </Card>
        </TabPane>
      </Tabs>
    </Card>
  </div>
</template>

<style scoped>
.overflow-wrap-anywhere {
  overflow-wrap: anywhere;
}
</style>

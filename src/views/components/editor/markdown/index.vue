<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useClipboard } from '@vueuse/core'
import hljs from 'highlight.js'
import MarkdownIt from 'markdown-it'
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import { cn } from '@/utils/cn'

import 'highlight.js/styles/github-dark.css'

const { copy, copied } = useClipboard()

const markedInstance = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code: string, lang: string) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value
      }
      return hljs.highlightAuto(code).value
    },
  }),
)

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(code: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      return `<pre class="hljs"><code class="hljs language-${lang}">${hljs.highlight(code, { language: lang }).value}</code></pre>`
    }
    return `<pre class="hljs"><code class="hljs">${hljs.highlightAuto(code).value}</code></pre>`
  },
})

const renderer = ref<'marked' | 'markdown-it'>('marked')

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
`

const markdownContent = ref(defaultMarkdown)

const renderedHtml = computed(() => {
  if (!markdownContent.value)
    return ''
  if (renderer.value === 'marked') {
    return markedInstance.parse(markdownContent.value) as string
  }
  return md.render(markdownContent.value)
})

const textareaRef = useTemplateRef<HTMLTextAreaElement>('textareaRef')

function insertMarkdown(
  before: string,
  after = '',
  placeholder = '',
  keepSelection = false,
) {
  const textarea = textareaRef.value
  if (!textarea)
    return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selectedText = markdownContent.value.substring(start, end)

  const replacement = keepSelection
    ? `${before}${selectedText}${after}`
    : `${before}${placeholder}${after}`

  markdownContent.value
    = markdownContent.value.substring(0, start)
      + replacement
      + markdownContent.value.substring(end)

  void nextTick(() => {
    textarea.focus()
    if (keepSelection) {
      const newCursorEnd = start + replacement.length
      textarea.setSelectionRange(newCursorEnd, newCursorEnd)
    }
    else {
      const cursorPos = start + before.length + placeholder.length
      textarea.setSelectionRange(cursorPos, cursorPos)
    }
  })
}

function insertLink() {
  const textarea = textareaRef.value
  if (!textarea)
    return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selectedText = markdownContent.value.substring(start, end)

  if (selectedText) {
    insertMarkdown('[', '](url)', selectedText, true)
  }
  else {
    insertMarkdown('[', '](url)', '链接文本')
  }
}

function insertImage() {
  const textarea = textareaRef.value
  if (!textarea)
    return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selectedText = markdownContent.value.substring(start, end)

  if (selectedText) {
    insertMarkdown('![', '](url)', selectedText, true)
  }
  else {
    insertMarkdown('![', '](url)', '图片描述')
  }
}

function insertTable() {
  const tableTemplate = '\n| 列1   | 列2   | 列3   |\n| ----- | ----- | ----- |\n| 内容1 | 内容2 | 内容3 |\n| 内容4 | 内容5 | 内容6 |\n'
  const textarea = textareaRef.value
  if (!textarea)
    return

  const start = textarea.selectionStart
  markdownContent.value
    = markdownContent.value.substring(0, start)
      + tableTemplate
      + markdownContent.value.substring(start)

  void nextTick(() => {
    textarea.focus()
    const cursorPos = start + 2
    textarea.setSelectionRange(cursorPos, cursorPos)
  })
}

function insertHeading(level: number) {
  const prefix = `${'#'.repeat(level)} `
  insertMarkdown(prefix, '', '标题文字')
}

function insertCodeBlock() {
  const template = '\n```\n\n```\n'
  const textarea = textareaRef.value
  if (!textarea)
    return

  const start = textarea.selectionStart
  markdownContent.value
    = markdownContent.value.substring(0, start)
      + template
      + markdownContent.value.substring(start)

  void nextTick(() => {
    textarea.focus()
    const cursorPos = start + 5
    textarea.setSelectionRange(cursorPos, cursorPos)
  })
}

function insertTaskList() {
  const template = '\n- [ ] 待办事项1\n- [ ] 待办事项2\n- [ ] 待办事项3\n'
  const textarea = textareaRef.value
  if (!textarea)
    return

  const start = textarea.selectionStart
  markdownContent.value
    = markdownContent.value.substring(0, start)
      + template
      + markdownContent.value.substring(start)

  void nextTick(() => {
    textarea.focus()
    const cursorPos = start + 7
    textarea.setSelectionRange(cursorPos, cursorPos)
  })
}

const toolbarGroups = [
  {
    buttons: [
      { label: '加粗', icon: 'carbon:text-bold', action: () => insertMarkdown('**', '**', '粗体文字', false) },
      { label: '斜体', icon: 'carbon:text-italic', action: () => insertMarkdown('*', '*', '斜体文字', false) },
      { label: '删除线', icon: 'carbon:text-strikethrough', action: () => insertMarkdown('~~', '~~', '删除线文字', false) },
      { label: '行内代码', icon: 'carbon:code', action: () => insertMarkdown('`', '`', '代码', false) },
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
      { label: '引用', icon: 'carbon:quotes', action: () => insertMarkdown('\n> ', '', '引用内容', false) },
      { label: '无序列表', icon: 'carbon:list', action: () => insertMarkdown('\n- ', '', '列表项', false) },
      { label: '有序列表', icon: 'carbon:list-numbered', action: () => insertMarkdown('\n1. ', '', '列表项', false) },
      { label: '任务列表', icon: 'carbon:checkbox-checked', action: insertTaskList },
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
      { label: '分割线', icon: 'carbon:horizontal-rule', action: () => insertMarkdown('\n\n---\n\n', '', '', false) },
    ],
  },
]

const editorPaneClassName = cn(
  'flex-1 flex flex-col min-w-0',
  'border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden',
)

const editorTitleClassName = cn(
  'px-4 py-2.5',
  'text-sm font-semibold',
  'bg-gray-50 dark:bg-gray-800',
  'text-gray-700 dark:text-gray-200',
  'border-b border-gray-200 dark:border-gray-700',
  'flex items-center gap-2',
)

const toolbarContainerClassName = cn(
  'flex flex-wrap items-center gap-1',
  'px-2 py-1.5',
  'bg-gray-50/50 dark:bg-gray-800/50',
  'border-b border-gray-200 dark:border-gray-700',
)

const toolbarButtonBaseClassName = cn(
  'inline-flex items-center justify-center',
  'w-7 h-7 rounded',
  'text-gray-600 dark:text-gray-400',
  'hover:bg-gray-200 dark:hover:bg-gray-700',
  'hover:text-gray-800 dark:hover:text-gray-200',
  'transition-colors duration-150',
  'text-xs',
)

const toolbarDividerClassName = cn(
  'w-px h-4 mx-0.5',
  'bg-gray-300 dark:bg-gray-600',
)

const textareaClassName = cn(
  'flex-1 w-full p-4',
  'text-sm leading-relaxed',
  'bg-white dark:bg-gray-900',
  'text-gray-800 dark:text-gray-200',
  'placeholder-gray-400 dark:placeholder-gray-500',
  'resize-none outline-none border-none',
  'font-mono',
)

const previewTitleClassName = cn(
  'px-4 py-2.5',
  'text-sm font-semibold',
  'bg-gray-50 dark:bg-gray-800',
  'text-gray-700 dark:text-gray-200',
  'border-b border-gray-200 dark:border-gray-700',
  'flex items-center justify-between',
)

const previewContentClassName = cn(
  'flex-1 overflow-y-auto p-4',
  'prose prose-sm dark:prose-invert max-w-none',
  'prose-headings:text-gray-800 dark:prose-headings:text-gray-100',
  'prose-p:text-gray-700 dark:prose-p:text-gray-300',
  'prose-a:text-blue-500 dark:prose-a:text-blue-400',
  'prose-code:text-pink-500 dark:prose-code:text-pink-400',
  'prose-code:bg-gray-100 dark:prose-code:bg-gray-800',
  'prose-code:px-1 prose-code:py-0.5 prose-code:rounded',
  'prose-pre:bg-gray-900 dark:prose-pre:bg-gray-950',
  'prose-pre:border prose-pre:border-gray-700',
  'prose-table:border-collapse',
  'prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-600',
  'prose-th:px-4 prose-th:py-2',
  'prose-th:bg-gray-50 dark:prose-th:bg-gray-800',
  'prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-600',
  'prose-td:px-4 prose-td:py-2',
  'prose-img:rounded-lg prose-img:shadow-md',
  'prose-blockquote:border-l-4 prose-blockquote:border-blue-500',
  'prose-blockquote:bg-blue-50/50 dark:prose-blockquote:bg-blue-950/30',
  'prose-blockquote:px-4 prose-blockquote:py-2',
  '[&_pre]:rounded-lg [&_pre]:overflow-x-auto',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
)

const pageTitleClassName = cn(
  'text-2xl font-bold',
  'text-gray-800 dark:text-gray-100',
  'mb-1',
)

const pageSubtitleClassName = cn(
  'text-sm text-gray-500 dark:text-gray-400',
  'mb-4',
)

const mainContainerClassName = cn(
  'flex flex-1 gap-4 h-[calc(100vh-140px)] min-h-[500px]',
)

const copyBtnClassName = cn(
  'inline-flex items-center gap-1',
  'px-2 py-0.5 text-xs rounded',
  'text-gray-500 dark:text-gray-400',
  'hover:bg-gray-200 dark:hover:bg-gray-700',
  'transition-colors duration-150',
)

const emptyPreviewClassName = cn(
  'flex items-center justify-center h-full',
  'text-gray-400 dark:text-gray-500',
  'text-sm',
)

const wordCountClassName = cn(
  'text-xs text-gray-400 dark:text-gray-500',
)

const rendererToggleClassName = cn(
  'inline-flex items-center',
  'text-xs',
  'bg-gray-100 dark:bg-gray-800',
  'rounded-lg p-0.5',
)
</script>

<template>
  <div class="p-4 h-full flex flex-col">
    <div class="flex items-center justify-between mb-1">
      <div>
        <h1 :class="pageTitleClassName">
          Markdown 编辑器
        </h1>
        <p :class="pageSubtitleClassName">
          基于 marked + highlight.js + markdown-it 的实时预览 Markdown 编辑器
        </p>
      </div>
    </div>

    <!-- 渲染引擎切换 -->
    <div class="flex items-center gap-2 mb-3">
      <span class="text-xs text-gray-500 dark:text-gray-400">渲染引擎：</span>
      <div :class="rendererToggleClassName">
        <button
          type="button"
          :class="cn(
            'px-2.5 py-0.5 rounded-md transition-colors duration-150',
            renderer === 'marked'
              ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-800 dark:text-gray-200 font-medium'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
          )"
          @click="renderer = 'marked'"
        >
          marked
        </button>
        <button
          type="button"
          :class="cn(
            'px-2.5 py-0.5 rounded-md transition-colors duration-150',
            renderer === 'markdown-it'
              ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-800 dark:text-gray-200 font-medium'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
          )"
          @click="renderer = 'markdown-it'"
        >
          markdown-it
        </button>
      </div>
    </div>

    <!-- 左右分栏 -->
    <div :class="mainContainerClassName">
      <!-- 左侧编辑面板 -->
      <div :class="editorPaneClassName">
        <div :class="editorTitleClassName">
          <icon-carbon-edit class="text-base" />
          <span>编辑区</span>
        </div>

        <!-- 工具栏 -->
        <div :class="toolbarContainerClassName">
          <template
            v-for="(group, idx) in toolbarGroups"
            :key="idx"
          >
            <span
              v-if="idx > 0"
              :class="toolbarDividerClassName"
            />
            <a-tooltip
              v-for="btn in group.buttons"
              :key="btn.label"
              :title="btn.label"
              placement="top"
              :mouse-enter-delay="0.3"
            >
              <button
                type="button"
                :class="toolbarButtonBaseClassName"
                @click="btn.action()"
              >
                <Icon
                  :icon="btn.icon"
                  :width="14"
                />
              </button>
            </a-tooltip>
          </template>
        </div>

        <!-- 编辑区 -->
        <textarea
          ref="textareaRef"
          v-model="markdownContent"
          :class="textareaClassName"
          placeholder="在此输入 Markdown 内容..."
          spellcheck="false"
        />
      </div>

      <!-- 右侧预览面板 -->
      <div :class="editorPaneClassName">
        <div :class="previewTitleClassName">
          <div class="flex items-center gap-2">
            <icon-carbon-preview class="text-base" />
            <span>预览区</span>
          </div>
          <div class="flex items-center gap-2">
            <span :class="wordCountClassName">{{ markdownContent.length }} 字</span>
            <button
              type="button"
              :class="copyBtnClassName"
              @click="copy(renderedHtml)"
            >
              <icon-carbon-copy class="text-xs" />
              {{ copied ? '已复制' : '复制HTML' }}
            </button>
          </div>
        </div>

        <!-- 预览内容（使用安全指令：保留合法HTML标签，过滤script和事件处理器） -->
        <div
          v-if="renderedHtml"
          v-safe-html="{ content: renderedHtml, allowHtml: true }"
          :class="previewContentClassName"
        />
        <div
          v-else
          :class="emptyPreviewClassName"
        >
          <div class="text-center">
            <icon-carbon-document-blank class="text-4xl mb-2 mx-auto opacity-30" />
            <p>在左侧输入 Markdown 内容后，此处将实时预览渲染结果</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

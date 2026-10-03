<script setup lang="ts">
import { Icon } from '@iconify/vue'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { computed, nextTick, ref } from 'vue'

import { MarkdownEditor } from '~/components/business/MarkdownEditor'

defineOptions({ name: 'TemplateEditor' })

/* ============================================================
 * 双向绑定
 * ============================================================ */
const content = defineModel<string>('content', { default: '' })
const contentFormat = defineModel<'markdown' | 'html' | 'text'>('contentFormat', {
  default: 'markdown',
})
const editorType = defineModel<string>('editorType', { default: 'richtext' })

/* ============================================================
 * Props
 * ============================================================ */
interface VariableOption {
  name: string
  label: string
}

const props = withDefaults(
  defineProps<{
    /** 可插入的变量（含用户自定义 + 系统变量），由父组件传入 */
    variableOptions?: VariableOption[]
    placeholder?: string
    minHeight?: number
  }>(),
  {
    variableOptions: () => [],
    placeholder: '在此输入邮件正文，从顶部「插入变量」添加 ${userName} 等变量',
    minHeight: 300,
  },
)

const textareaRef = ref<HTMLTextAreaElement>()

/* ============================================================
 * 预览渲染
 * ============================================================ */
const renderedHtml = computed(() => {
  const raw = content.value || ''
  if (!raw.trim()) return '<p class="text-slate-400 text-sm italic">（暂无内容）</p>'

  if (contentFormat.value === 'text') {
    const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
    return DOMPurify.sanitize(escaped)
  }

  if (contentFormat.value === 'html') {
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: [
        'p',
        'br',
        'strong',
        'b',
        'em',
        'i',
        'u',
        's',
        'a',
        'img',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'ul',
        'ol',
        'li',
        'blockquote',
        'code',
        'pre',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'div',
        'span',
        'hr',
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'target', 'width', 'height'],
    })
  }

  const html = marked.parse(raw, { breaks: true, gfm: true }) as string
  return DOMPurify.sanitize(html)
})

/* ============================================================
 * 工具栏
 * ============================================================ */
interface WrapConfig {
  prefix: string
  suffix?: string
  placeholder?: string
  block?: boolean
}

async function wrapSelection(config: WrapConfig) {
  const ta = textareaRef.value
  if (!ta) return

  const start = ta.selectionStart
  const end = ta.selectionEnd
  const before = content.value.slice(0, start)
  const selected = content.value.slice(start, end)
  const after = content.value.slice(end)

  const suffix = config.suffix ?? config.prefix
  const text = selected || config.placeholder || ''

  let newText: string
  if (config.block) {
    const lines = (before + selected).split('\n')
    const lastLine = lines.pop() ?? ''
    const newLine = `${config.prefix}${lastLine || text}`
    newText = `${lines.join('\n')}${lines.length ? '\n' : ''}${newLine}${after}`
  } else {
    newText = `${before}${config.prefix}${text}${suffix}${after}`
  }

  content.value = newText

  await nextTick()
  ta.focus()
  const newStart = start + config.prefix.length
  const newEnd = newStart + text.length
  ta.setSelectionRange(newStart, newEnd)
}

const TOOLBAR_BUTTONS = [
  {
    icon: 'carbon:text-bold',
    label: '加粗',
    md: { prefix: '**' },
    html: { prefix: '<strong>', suffix: '</strong>' },
  },
  {
    icon: 'carbon:text-italic',
    label: '斜体',
    md: { prefix: '*' },
    html: { prefix: '<em>', suffix: '</em>' },
  },
  {
    icon: 'carbon:text-strikethrough',
    label: '删除线',
    md: { prefix: '~~' },
    html: { prefix: '<s>', suffix: '</s>' },
  },
  {
    icon: 'carbon:link',
    label: '链接',
    md: { prefix: '[', suffix: '](https://)', placeholder: '链接文字' },
    html: { prefix: '<a href="https://">', suffix: '</a>', placeholder: '链接文字' },
  },
  {
    icon: 'carbon:image',
    label: '图片',
    md: { prefix: '![', suffix: '](https://)', placeholder: '图片描述' },
    html: { prefix: '<img src="https://" alt="', suffix: '" />', placeholder: '图片描述' },
  },
  {
    icon: 'carbon:list-bulleted',
    label: '无序列表',
    md: { prefix: '- ', block: true },
    html: { prefix: '<li>', suffix: '</li>', placeholder: '列表项' },
  },
  {
    icon: 'carbon:list-numbered',
    label: '有序列表',
    md: { prefix: '1. ', block: true },
    html: { prefix: '<li>', suffix: '</li>', placeholder: '列表项' },
  },
  {
    icon: 'carbon:quotes',
    label: '引用',
    md: { prefix: '> ', block: true },
    html: { prefix: '<blockquote>', suffix: '</blockquote>', placeholder: '引用内容' },
  },
  {
    icon: 'carbon:code',
    label: '代码',
    md: { prefix: '`' },
    html: { prefix: '<code>', suffix: '</code>' },
  },
  {
    icon: 'carbon:horizontal-rule',
    label: '分割线',
    md: { prefix: '\n---\n', suffix: '' },
    html: { prefix: '<hr />', suffix: '' },
  },
]

async function handleToolbar(btn: (typeof TOOLBAR_BUTTONS)[number]) {
  const config = contentFormat.value === 'html' ? btn.html : btn.md
  await wrapSelection(config)
}

/* ============================================================
 * 变量插入
 * ============================================================ */
async function insertVariable(varName: string) {
  const ta = textareaRef.value
  if (!ta) {
    content.value += `\${${varName}}`
    return
  }

  const start = ta.selectionStart
  const end = ta.selectionEnd
  const before = content.value.slice(0, start)
  const after = content.value.slice(end)
  const snippet = `\${${varName}}`

  content.value = `${before}${snippet}${after}`

  await nextTick()
  ta.focus()
  const newPos = start + snippet.length
  ta.setSelectionRange(newPos, newPos)
}

defineExpose({ insertVariable })

/* ============================================================
 * 快捷系统变量（默认值）
 * ============================================================ */
const SYSTEM_VARS: VariableOption[] = [
  { name: 'userName', label: '用户名' },
  { name: 'realName', label: '真实姓名' },
  { name: 'appName', label: '应用名称' },
  { name: 'deptName', label: '部门名称' },
  { name: 'now', label: '当前时间' },
]

/** 合并：系统变量 + 用户定义的变量（去重） */
const quickInsertVars = computed<VariableOption[]>(() => {
  const map = new Map<string, VariableOption>()
  for (const v of SYSTEM_VARS) map.set(v.name, v)
  for (const v of props.variableOptions) {
    if (v.name) map.set(v.name, v)
  }
  return [...map.values()]
})

function varPlaceholder(name: string): string {
  return `\${${name}}`
}
</script>

<template>
  <div class="template-editor space-y-4">
    <!-- 顶部工具栏（仅 markdown 模式显示） -->
    <div
      v-if="editorType === 'markdown'"
      class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-2 dark:border-slate-700 dark:bg-slate-900/40"
    >
      <div class="flex items-center gap-0.5">
        <a-tooltip v-for="btn in TOOLBAR_BUTTONS" :key="btn.label" :title="btn.label">
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            @click="handleToolbar(btn)"
          >
            <Icon :icon="btn.icon" class="text-sm" />
          </button>
        </a-tooltip>
      </div>
    </div>

    <!-- 内容编辑区 -->
    <div class="flex justify-around gap-2">
      <MarkdownEditor
        v-if="editorType === 'richtext'"
        v-model:value="content"
        :placeholder="placeholder"
        :min-height="minHeight"
      />

      <div v-else class="flex-1">
        <div class="mb-1.5 flex items-center justify-between">
          <span class="text-[11px] text-slate-400">
            用
            <code class="rounded bg-slate-100 px-1 dark:bg-slate-800">{{ varPlaceholder('变量') }}</code>
            表示占位符
          </span>
        </div>
        <div class="relative">
          <textarea
            ref="textareaRef"
            v-model="content"
            class="min-h-[300px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-[13px] leading-relaxed text-slate-800 transition-colors outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-blue-500 dark:focus:ring-blue-950"
            :placeholder="
              contentFormat === 'html' ? '<p>您好 ${userName}</p>' : '您好 ${userName}，欢迎加入 ${appName}！'
            "
            spellcheck="false"
          />
          <div
            class="pointer-events-none absolute right-2 bottom-2 rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-400 dark:bg-slate-900/80"
          >
            {{ content.length }} / 50000
          </div>
        </div>
      </div>

      <div v-if="editorType === 'markdown'" class="flex-1">
        <div class="mb-1.5 flex items-center gap-2">
          <span class="text-xs font-medium text-slate-600 dark:text-slate-400">实时预览</span>
          <span
            class="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
          >
            <span class="h-1 w-1 rounded-full bg-emerald-500" />
            实时
          </span>
        </div>
        <div
          class="prose prose-sm dark:prose-invert min-h-[300px] w-full max-w-none overflow-auto rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed dark:border-slate-700 dark:bg-slate-900"
          v-html="renderedHtml"
        />
      </div>
    </div>

    <!-- 快捷插入变量 -->
    <div>
      <div class="mb-2 flex items-center justify-between">
        <span class="text-xs font-medium text-slate-600 dark:text-slate-400">快捷插入变量</span>
        <span class="text-[11px] text-slate-400">点击插入到光标位置</span>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="v in quickInsertVars"
          :key="v.name"
          type="button"
          class="group inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 transition-all hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-blue-500 dark:hover:bg-blue-950/30 dark:hover:text-blue-400"
          @click="insertVariable(v.name)"
        >
          <Icon icon="carbon:add" class="text-sm" />
          <span class="font-medium">{{ v.label }}</span>
          <code class="text-[10px] opacity-60">{{ varPlaceholder(v.name) }}</code>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 保持原有样式（预览排版等） */
.template-editor :deep(h1) {
  font-size: 1.5em;
  font-weight: 700;
  margin: 0.6em 0 0.4em;
}
.template-editor :deep(h2) {
  font-size: 1.3em;
  font-weight: 700;
  margin: 0.6em 0 0.4em;
}
.template-editor :deep(h3) {
  font-size: 1.15em;
  font-weight: 600;
  margin: 0.5em 0 0.3em;
}
.template-editor :deep(p) {
  margin: 0.5em 0;
}
.template-editor :deep(ul),
.template-editor :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}
.template-editor :deep(li) {
  margin: 0.2em 0;
}
.template-editor :deep(code) {
  padding: 0.15em 0.4em;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.06);
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 0.9em;
}
.template-editor :deep(pre) {
  padding: 0.8em;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.05);
  overflow-x: auto;
  font-size: 0.85em;
}
.template-editor :deep(blockquote) {
  border-left: 3px solid #cbd5e1;
  padding-left: 0.8em;
  margin: 0.6em 0;
  color: #64748b;
}
.template-editor :deep(a) {
  color: #3b82f6;
  text-decoration: underline;
}
.template-editor :deep(img) {
  max-width: 100%;
  border-radius: 6px;
}
.template-editor :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.6em 0;
  font-size: 0.9em;
}
.template-editor :deep(th),
.template-editor :deep(td) {
  border: 1px solid #e2e8f0;
  padding: 6px 10px;
}
.template-editor :deep(th) {
  background: #f8fafc;
  font-weight: 600;
}
.template-editor :deep(hr) {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 1em 0;
}
</style>

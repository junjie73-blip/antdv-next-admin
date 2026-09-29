<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Select } from 'antdv-next'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { computed, nextTick, ref, watch } from 'vue'

import type { TemplateParam } from '../types'

import { PARAM_TYPE_OPTIONS } from '../constants'

defineOptions({ name: 'TemplateEditor' })

const props = withDefaults(
  defineProps<{
    content?: string
    contentFormat?: 'markdown' | 'html' | 'text'
    params?: TemplateParam[]
  }>(),
  {
    content: '',
    contentFormat: 'markdown',
    params: () => [],
  },
)

const emit = defineEmits<{
  'update:content': [v: string]
  'update:contentFormat': [v: 'markdown' | 'html' | 'text']
  'update:params': [v: TemplateParam[]]
}>()

/* ============================================================
 * 本地状态
 * ============================================================ */
const localContent = ref(props.content)
const localFormat = ref(props.contentFormat)
const localParams = ref<TemplateParam[]>([...(props.params ?? [])])

const textareaRef = ref<HTMLTextAreaElement>()

/* ============================================================
 * 双向同步
 * ============================================================ */
watch(
  () => props.content,
  (v) => {
    if (v !== localContent.value) localContent.value = v
  },
)
watch(
  () => props.contentFormat,
  (v) => {
    if (v !== localFormat.value) localFormat.value = v
  },
)
watch(
  () => props.params,
  (v) => {
    // 只在外部变化且长度不同步时更新，避免光标丢失
    if (JSON.stringify(v) !== JSON.stringify(localParams.value)) {
      localParams.value = [...(v ?? [])]
    }
  },
  { deep: true },
)

watch(localContent, (v) => emit('update:content', v))
watch(localFormat, (v) => emit('update:contentFormat', v))

/* ============================================================
 * 变量相关
 * ============================================================ */
const usedVars = computed(() => {
  const regex = /\$\{(\w+)\}/g
  const set = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = regex.exec(localContent.value)) !== null) set.add(m[1]!)
  return [...set]
})

const definedVarNames = computed(() => new Set(localParams.value.map((p) => p.name)))

const undefinedVars = computed(() => usedVars.value.filter((v) => !definedVarNames.value.has(v)))

const unusedVars = computed(() => [...definedVarNames.value].filter((v) => !usedVars.value.includes(v)))

/* ============================================================
 * 预览渲染
 * ============================================================ */
const renderedHtml = computed(() => {
  const raw = localContent.value || ''
  if (!raw.trim()) return '<p class="text-slate-400 text-sm italic">（暂无内容）</p>'

  if (localFormat.value === 'text') {
    // 纯文本：转义后换行
    const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
    return DOMPurify.sanitize(escaped)
  }

  if (localFormat.value === 'html') {
    // HTML：直接净化
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

  // Markdown：marked 转换 + DOMPurify
  const html = marked.parse(raw, { breaks: true, gfm: true }) as string
  return DOMPurify.sanitize(html)
})

/* ============================================================
 * 工具栏操作（针对 Markdown / HTML）
 * ============================================================ */
interface WrapConfig {
  prefix: string
  suffix?: string
  placeholder?: string
  block?: boolean // 是否整行块级（如标题、列表）
}

async function wrapSelection(config: WrapConfig) {
  const ta = textareaRef.value
  if (!ta) return

  const start = ta.selectionStart
  const end = ta.selectionEnd
  const before = localContent.value.slice(0, start)
  const selected = localContent.value.slice(start, end)
  const after = localContent.value.slice(end)

  const suffix = config.suffix ?? config.prefix
  const text = selected || config.placeholder || ''

  let newText: string
  if (config.block) {
    // 块级：在行首添加
    const lines = (before + selected).split('\n')
    const lastLine = lines.pop() ?? ''
    const newLine = `${config.prefix}${lastLine || text}`
    newText = `${lines.join('\n')}${lines.length ? '\n' : ''}${newLine}${after}`
  } else {
    newText = `${before}${config.prefix}${text}${suffix}${after}`
  }

  localContent.value = newText

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
  const config = localFormat.value === 'html' ? btn.html : btn.md
  await wrapSelection(config)
}

/* ============================================================
 * 变量：光标处插入
 * ============================================================ */
async function insertVariable(varName: string) {
  const ta = textareaRef.value
  if (!ta) {
    localContent.value += `\${${varName}}`
    return
  }

  const start = ta.selectionStart
  const end = ta.selectionEnd
  const before = localContent.value.slice(0, start)
  const after = localContent.value.slice(end)
  const snippet = `\${${varName}}`

  localContent.value = `${before}${snippet}${after}`

  await nextTick()
  ta.focus()
  const newPos = start + snippet.length
  ta.setSelectionRange(newPos, newPos)
}

/* ============================================================
 * 变量定义
 * ============================================================ */
function addParam(name?: string) {
  const usedName = name ?? ''
  if (usedName && localParams.value.some((p) => p.name === usedName)) return

  localParams.value.push({
    name: usedName,
    label: usedName,
    type: 'string',
    required: false,
  })
  syncParams()
}

function removeParam(index: number) {
  localParams.value.splice(index, 1)
  syncParams()
}

function syncParams() {
  emit('update:params', [...localParams.value])
}

watch(localParams, () => syncParams(), { deep: true })

/** 一键补齐未定义变量 */
function autoAddUndefinedVars() {
  undefinedVars.value.forEach((v) => addParam(v))
}

/* ============================================================
 * 快捷系统变量
 * ============================================================ */
const SYSTEM_VARS = [
  { name: 'userName', label: '用户名' },
  { name: 'realName', label: '真实姓名' },
  { name: 'appName', label: '应用名称' },
  { name: 'deptName', label: '部门名称' },
  { name: 'now', label: '当前时间' },
]

/* ============================================================
 * 格式切换
 * ============================================================ */
const FORMAT_OPTIONS = [
  {
    label: 'Markdown',
    value: 'markdown',
    icon: 'carbon:markdown',
    tip: '支持标题、列表、代码块等',
  },
  { label: 'HTML', value: 'html', icon: 'carbon:code', tip: '直接编写 HTML' },
  { label: '纯文本', value: 'text', icon: 'carbon:text-align-left', tip: '纯文本，不解析格式' },
]
function extractVarNames(text: string): string[] {
  const raw = text ?? ''
  if (!raw) return []
  const regex = /\$\{(\w+)\}/g
  const set = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = regex.exec(raw)) !== null) set.add(m[1]!)
  return [...set]
}
function syncParamsFromContent(content: string) {
  const varNames = extractVarNames(content)
  if (varNames.length === 0) return

  const existingNames = new Set(localParams.value.map((p) => p.name))
  const toAdd = varNames.filter((v) => !existingNames.has(v))

  if (toAdd.length === 0) return

  localParams.value = [
    ...localParams.value,
    ...toAdd.map((name) => ({
      name,
      label: name,
      type: 'string' as const,
      required: false,
    })),
  ]
  syncParams()
}
watch(
  localContent,
  (v) => {
    syncParamsFromContent(v ?? '')
  },
  { immediate: true },
)
</script>

<template>
  <div class="template-editor space-y-4">
    <!-- ============================================================
         顶部工具栏
         ============================================================ -->
    <div
      class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-2 dark:border-slate-700 dark:bg-slate-900/40"
    >
      <!-- 格式选择 -->
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-slate-500 dark:text-slate-400">格式</span>
        <a-radio-group v-model:value="localFormat" size="small" button-style="solid">
          <a-radio-button v-for="f in FORMAT_OPTIONS" :key="f.value" :value="f.value">
            <a-tooltip :title="f.tip">
              <span class="inline-flex items-center gap-1">
                <Icon :icon="f.icon" class="text-sm" />
                {{ f.label }}
              </span>
            </a-tooltip>
          </a-radio-button>
        </a-radio-group>
      </div>

      <!-- 格式化工具（纯文本禁用） -->
      <div v-if="localFormat !== 'text'" class="flex items-center gap-0.5">
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

    <!-- ============================================================
         双栏编辑器：左编辑 / 右预览
         ============================================================ -->
    <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <!-- 编辑区 -->
      <div>
        <div class="mb-1.5 flex items-center justify-between">
          <span class="text-xs font-medium text-slate-600 dark:text-slate-400">
            编辑内容 <span class="text-rose-500">*</span>
          </span>
          <span class="text-[11px] text-slate-400">
            用
            <code class="rounded bg-slate-100 px-1 dark:bg-slate-800">${'{'}变量名{'}'}</code>
            表示占位符
          </span>
        </div>
        <div class="relative">
          <textarea
            ref="textareaRef"
            v-model="localContent"
            class="min-h-[300px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-[13px] leading-relaxed text-slate-800 transition-colors outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-blue-500 dark:focus:ring-blue-950"
            :placeholder="
              localFormat === 'html' ? '<p>您好 ${userName}</p>' : '您好 ${userName}，欢迎加入 ${appName}！'
            "
            spellcheck="false"
          />
          <div
            class="pointer-events-none absolute right-2 bottom-2 rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-400 dark:bg-slate-900/80"
          >
            {{ localContent.length }} / 50000
          </div>
        </div>
      </div>

      <!-- 预览区 -->
      <div>
        <div class="mb-1.5 flex items-center gap-2">
          <span class="text-xs font-medium text-slate-600 dark:text-slate-400"> 实时预览 </span>
          <span
            class="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
          >
            <span class="h-1 w-1 rounded-full bg-emerald-500" />
            实时
          </span>
        </div>
        <div
          class="preview-pane min-h-[300px] w-full overflow-auto rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed dark:border-slate-700 dark:bg-slate-900"
          v-html="renderedHtml"
        />
      </div>
    </div>

    <!-- ============================================================
         快捷插入变量
         ============================================================ -->
    <div>
      <div class="mb-2 flex items-center justify-between">
        <span class="text-xs font-medium text-slate-600 dark:text-slate-400"> 快捷插入变量 </span>
        <span class="text-[11px] text-slate-400"> 点击插入到光标位置 </span>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="v in SYSTEM_VARS"
          :key="v.name"
          type="button"
          class="group inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 transition-all hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-blue-500 dark:hover:bg-blue-950/30 dark:hover:text-blue-400"
          @click="insertVariable(v.name)"
        >
          <Icon icon="carbon:add" class="text-sm" />
          <span class="font-medium">{{ v.label }}</span>
          <code class="text-[10px] opacity-60">${'{'} {{ v.name }} {'}'}</code>
        </button>
      </div>
    </div>

    <!-- ============================================================
         变量定义
         ============================================================ -->
    <div>
      <div class="mb-2 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-slate-700 dark:text-slate-300"> 变量定义 </span>
          <span
            v-if="usedVars.length > 0"
            class="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
          >
            已用 {{ usedVars.length }} 个
          </span>
        </div>
        <div class="flex items-center gap-1">
          <a-button
            v-if="undefinedVars.length > 0"
            size="small"
            type="link"
            class="!text-amber-600"
            @click="autoAddUndefinedVars"
          >
            <template #icon><Icon icon="carbon:magic-wand" /></template>
            一键补齐
          </a-button>
          <a-button size="small" type="link" @click="addParam()">
            <template #icon><Icon icon="carbon:add" /></template>
            添加变量
          </a-button>
        </div>
      </div>

      <!-- 空状态 -->
      <div
        v-if="localParams.length === 0"
        class="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500"
      >
        暂无变量定义。点击上方系统变量插入，或点「添加变量」手动添加
      </div>

      <!-- 变量表格 -->
      <div v-else class="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        <table class="w-full text-xs">
          <thead class="bg-slate-50 text-left dark:bg-slate-900/50">
            <tr class="text-slate-500 dark:text-slate-400">
              <th class="px-2 py-2 font-medium">变量名</th>
              <th class="px-2 py-2 font-medium">显示名</th>
              <th class="px-2 py-2 font-medium" style="width: 90px">类型</th>
              <th class="px-2 py-2 text-center font-medium" style="width: 60px">必填</th>
              <th class="px-2 py-2 font-medium">说明</th>
              <th class="px-2 py-2" style="width: 40px"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
            <tr
              v-for="(p, index) in localParams"
              :key="index"
              :class="{
                'bg-amber-50/40 dark:bg-amber-950/10': unusedVars.includes(p.name),
              }"
            >
              <td class="px-2 py-1.5">
                <a-input v-model:value="p.name" size="small" placeholder="varName" :maxlength="64" class="var-input" />
              </td>
              <td class="px-2 py-1.5">
                <a-input v-model:value="p.label" size="small" placeholder="显示名" :maxlength="64" />
              </td>
              <td class="px-2 py-1.5">
                <Select v-model:value="p.type" size="small" :options="PARAM_TYPE_OPTIONS" class="w-full" />
              </td>
              <td class="px-2 py-1.5 text-center">
                <a-checkbox v-model:checked="p.required" />
              </td>
              <td class="px-2 py-1.5">
                <a-input v-model:value="p.description" size="small" placeholder="说明" />
              </td>
              <td class="px-2 py-1.5 text-center">
                <a-button type="text" size="small" danger @click="removeParam(index)">
                  <Icon icon="carbon:trash-can" class="text-sm" />
                </a-button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 警告 -->
      <div
        v-if="undefinedVars.length > 0"
        class="mt-3 rounded-lg border border-rose-200/60 bg-rose-50/50 p-3 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300"
      >
        <Icon icon="carbon:warning-alt" class="mr-1 inline" />
        模板中使用了以下未定义的变量：
        <code v-for="v in undefinedVars" :key="v" class="mx-0.5 rounded bg-white/70 px-1 dark:bg-slate-900/60"
          >${'{'} {{ v }} {'}'}</code
        >
        ，请补充定义
      </div>
    </div>
  </div>
</template>

<style scoped>
.template-editor :deep(.var-input input) {
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
}

/* 预览区排版 */
.preview-pane :deep(h1) {
  font-size: 1.5em;
  font-weight: 700;
  margin: 0.6em 0 0.4em;
}
.preview-pane :deep(h2) {
  font-size: 1.3em;
  font-weight: 700;
  margin: 0.6em 0 0.4em;
}
.preview-pane :deep(h3) {
  font-size: 1.15em;
  font-weight: 600;
  margin: 0.5em 0 0.3em;
}
.preview-pane :deep(p) {
  margin: 0.5em 0;
}
.preview-pane :deep(ul),
.preview-pane :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}
.preview-pane :deep(li) {
  margin: 0.2em 0;
}
.preview-pane :deep(code) {
  padding: 0.15em 0.4em;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.06);
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 0.9em;
}
.preview-pane :deep(pre) {
  padding: 0.8em;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.05);
  overflow-x: auto;
  font-size: 0.85em;
}
.preview-pane :deep(pre code) {
  padding: 0;
  background: transparent;
}
.preview-pane :deep(blockquote) {
  border-left: 3px solid #cbd5e1;
  padding-left: 0.8em;
  margin: 0.6em 0;
  color: #64748b;
}
.preview-pane :deep(a) {
  color: #3b82f6;
  text-decoration: underline;
}
.preview-pane :deep(img) {
  max-width: 100%;
  border-radius: 6px;
}
.preview-pane :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.6em 0;
  font-size: 0.9em;
}
.preview-pane :deep(th),
.preview-pane :deep(td) {
  border: 1px solid #e2e8f0;
  padding: 6px 10px;
}
.preview-pane :deep(th) {
  background: #f8fafc;
  font-weight: 600;
}
.preview-pane :deep(hr) {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 1em 0;
}

/* 暗色模式 */
:global(.dark) .preview-pane :deep(code),
:global(.dark) .preview-pane :deep(pre) {
  background: rgba(255, 255, 255, 0.06);
}
:global(.dark) .preview-pane :deep(th),
:global(.dark) .preview-pane :deep(td) {
  border-color: #334155;
}
:global(.dark) .preview-pane :deep(th) {
  background: #1e293b;
}
:global(.dark) .preview-pane :deep(blockquote) {
  border-color: #475569;
  color: #94a3b8;
}
</style>

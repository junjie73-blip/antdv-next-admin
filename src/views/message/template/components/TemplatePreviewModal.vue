<script setup lang="ts">
import { Icon } from '@iconify/vue'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { computed, reactive, ref, watch } from 'vue'

import type { TemplateRecord } from '../types'

import { renderPreview } from '../api'

defineOptions({ name: 'TemplatePreviewModal' })

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ template: TemplateRecord | null }>()

const loading = ref(false)
const rendered = ref<{ title: string; content: string }>({ title: '', content: '' })
const params = reactive<Record<string, unknown>>({})

/* ============================================================
 * ⭐ 系统变量默认值（预览时用）
 * ============================================================ */
const SYSTEM_DEFAULTS: Record<string, string> = {
  userName: '示例用户',
  realName: '张三',
  appName: 'SaaS Admin',
  deptName: '技术部',
  now: new Date().toLocaleString('zh-CN'),
}

/* ============================================================
 * 参数列表：模板定义 + 系统变量
 * ============================================================ */
const paramList = computed(() => {
  const fromParams = props.template?.params ?? []
  const definedNames = new Set(fromParams.map((p) => p.name))

  // 从 content 里提取所有用到的变量
  const content = props.template?.content ?? ''
  const title = props.template?.title ?? ''
  const regex = /\$\{(\w+)\}/g
  const usedVars = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = regex.exec(content)) !== null) usedVars.add(m[1]!)
  while ((m = regex.exec(title)) !== null) usedVars.add(m[1]!)

  // 已定义的模板参数（保持原顺序）
  const result: Array<{ name: string; label: string; type: string; required?: boolean }> = fromParams.map((p) => ({
      name: p.name,
      label: p.label ?? p.name,
      type: p.type ?? 'string',
      required: p.required,
    }))

  // 未定义但使用了的变量（补到列表）
  for (const name of usedVars) {
    if (!definedNames.has(name)) {
      result.push({
        name,
        label: SYSTEM_DEFAULTS[name] ? `系统变量-${name}` : name,
        type: 'string',
        required: false,
      })
    }
  }

  return result
})

/* ============================================================
 * ⭐ 初始化：模板参数用默认值，系统变量用系统默认值
 * ============================================================ */
watch(
  () => [open.value, props.template] as const,
  async ([isOpen, tpl]) => {
    if (!isOpen || !tpl) return

    Object.keys(params).forEach((k) => delete params[k])

    // 1) 先填模板定义的参数
    ;(tpl.params ?? []).forEach((p) => {
      params[p.name] = p.defaultValue ?? ''
    })

    // 2) 补全系统变量（如果模板没定义但用了，用系统默认值）
    for (const p of paramList.value) {
      if (params[p.name] === undefined || params[p.name] === '') {
        params[p.name] = SYSTEM_DEFAULTS[p.name] ?? ''
      }
    }

    await doRender()
  },
  { immediate: true },
)

async function doRender() {
  if (!props.template) return
  loading.value = true
  try {
    const res: any = await renderPreview({
      content: props.template.content,
      title: props.template.title ?? undefined,
      params: { ...params },
      // @ts-expect-error 后端已支持 editorType 参数
      editorType: props.template.editorType ?? 'markdown',
    })
    const data = res?.data ?? res
    rendered.value = { title: data.title ?? '', content: data.content ?? '' }
  } finally {
    loading.value = false
  }
}

/* ============================================================
 * ⭐ 预览 HTML：按 contentFormat 分派 + DOMPurify 净化
 * ============================================================ */
const previewHtml = computed(() => {
  const raw = rendered.value.content || ''
  if (!raw.trim()) {
    return '<p style="color:#94a3b8;font-style:italic;">（暂无内容）</p>'
  }

  const format = props.template?.contentFormat ?? 'markdown'

  if (format === 'text') {
    const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
    return DOMPurify.sanitize(escaped)
  }

  if (format === 'html') {
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
        'del',
        'ins',
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

  // markdown
  const html = marked.parse(raw, { breaks: true, gfm: true }) as string
  return DOMPurify.sanitize(html)
})

/* ============================================================
 * ⭐ 格式化变量占位符文本（用于 label 展示）
 * ============================================================ */
function varPlaceholder(name: string): string {
  return `\${${name}}`
}
</script>

<template>
  <a-modal v-model:open="open" :title="`模板预览 - ${template?.templateName ?? ''}`" :width="720" :footer="null">
    <div class="space-y-4">
      <!-- 变量输入 -->
      <div v-if="paramList.length > 0">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm font-medium text-slate-700 dark:text-slate-300"> 测试变量 </span>
          <a-button size="small" type="link" @click="doRender">
            <template #icon><Icon icon="carbon:renew" /></template>
            重新渲染
          </a-button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div v-for="p in paramList" :key="p.name">
            <div class="mb-1 text-xs text-slate-500 dark:text-slate-400">
              {{ p.label }}
              <span v-if="p.required" class="text-rose-500">*</span>
              <!-- ⭐ 修复：用字符串拼接，避免 Vue 编译歧义 -->
              <code class="ml-1 text-[10px] opacity-60">{{ varPlaceholder(p.name) }}</code>
            </div>
            <a-input
              v-model:value="params[p.name]"
              size="small"
              :placeholder="`请输入${p.label}`"
              @press-enter="doRender"
            />
          </div>
        </div>
      </div>

      <!-- 渲染结果 -->
      <a-spin :spinning="loading">
        <div class="space-y-3">
          <!-- 标题 -->
          <div v-if="rendered.title">
            <div class="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">标题</div>
            <div
              class="rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/40"
            >
              {{ rendered.title }}
            </div>
          </div>

          <!-- 内容（⭐ 修复：按 format 智能渲染） -->
          <div>
            <div class="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">内容</div>
            <div
              class="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-sm leading-relaxed dark:border-slate-800 dark:bg-slate-900/40"
              v-html="previewHtml"
            />
          </div>
        </div>
      </a-spin>
    </div>
  </a-modal>
</template>

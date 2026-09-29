<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, reactive, ref, watch } from 'vue'

import type { TemplateRecord } from '../types'

import { renderPreview } from '../api'

defineOptions({ name: 'TemplatePreviewModal' })

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ template: TemplateRecord | null }>()

const loading = ref(false)
const rendered = ref<{ title: string; content: string }>({ title: '', content: '' })
const params = reactive<Record<string, unknown>>({})

watch(
  () => [open.value, props.template] as const,
  async ([isOpen, tpl]) => {
    if (!isOpen || !tpl) return
    // 用变量默认值初始化
    Object.keys(params).forEach((k) => delete params[k])
    ;(tpl.params ?? []).forEach((p) => {
      params[p.name] = p.defaultValue ?? ''
    })
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
    })
    const data = res?.data ?? res
    rendered.value = { title: data.title ?? '', content: data.content ?? '' }
  } finally {
    loading.value = false
  }
}

const paramList = computed(() => {
  const fromParams = props.template?.params ?? []
  if (fromParams.length > 0) return fromParams

  // 兜底：从 content 派生
  const content = props.template?.content ?? ''
  const regex = /\$\{(\w+)\}/g
  const set = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = regex.exec(content)) !== null) set.add(m[1]!)
  return [...set].map((name) => ({
    name,
    label: name,
    type: 'string' as const,
    required: false,
  }))
})
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
              <code class="ml-1 text-[10px] opacity-60">${'{'} {{ p.name }} {'}'}</code>
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
          <div v-if="rendered.title">
            <div class="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">标题</div>
            <div
              class="rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/40"
            >
              {{ rendered.title }}
            </div>
          </div>
          <div>
            <div class="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">内容</div>
            <div
              class="rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-sm leading-relaxed whitespace-pre-wrap dark:border-slate-800 dark:bg-slate-900/40"
            >
              {{ rendered.content || '（暂无内容）' }}
            </div>
          </div>
        </div>
      </a-spin>
    </div>
  </a-modal>
</template>

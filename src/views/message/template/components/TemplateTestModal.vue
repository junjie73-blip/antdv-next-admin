<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { computed, reactive, ref, watch } from 'vue'

import type { TemplateRecord } from '../types'

import { testSendTemplate } from '../api'

defineOptions({ name: 'TemplateTestModal' })

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ template: TemplateRecord | null }>()

const sending = ref(false)
const params = reactive<Record<string, unknown>>({})
const receiver = ref('')

const paramList = computed(() => props.template?.params ?? [])

const receiverPlaceholder = computed(() => {
  const channel = props.template?.channelType
  if (channel === 'email') return '请输入测试邮箱'
  if (channel === 'sms') return '请输入测试手机号'
  if (channel === 'webhook') return '请输入 Webhook URL'
  return '请输入接收人'
})

watch(
  () => [open.value, props.template] as const,
  ([isOpen, tpl]) => {
    if (!isOpen || !tpl) return
    receiver.value = ''
    Object.keys(params).forEach((k) => delete params[k])
    ;(tpl.params ?? []).forEach((p) => {
      params[p.name] = p.defaultValue ?? ''
    })
  },
)

async function handleSend() {
  if (!receiver.value.trim()) {
    message.warning('请输入接收人')
    return
  }
  if (!props.template) return

  sending.value = true
  try {
    await testSendTemplate({
      templateId: props.template.templateId,
      receiver: receiver.value.trim(),
      params: { ...params },
    })
    message.success('测试发送成功')
    open.value = false
  } catch (e: any) {
    message.error(e?.message || '发送失败')
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <a-modal
    v-model:open="open"
    title="测试发送"
    :width="560"
    :confirm-loading="sending"
    ok-text="发送测试"
    @ok="handleSend"
  >
    <div class="space-y-4 py-2">
      <div>
        <div class="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
          接收人 <span class="text-rose-500">*</span>
        </div>
        <a-input v-model:value="receiver" :placeholder="receiverPlaceholder" :maxlength="256">
          <template #prefix>
            <Icon icon="carbon:user-multiple" class="text-slate-400" />
          </template>
        </a-input>
      </div>

      <div v-if="paramList.length > 0">
        <div class="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">变量值</div>
        <div class="space-y-2">
          <div v-for="p in paramList" :key="p.name">
            <div class="mb-1 text-xs text-slate-500 dark:text-slate-400">
              {{ p.label }}
              <span v-if="p.required" class="text-rose-500">*</span>
            </div>
            <a-input v-model:value="params[p.name]" size="small" :placeholder="`请输入${p.label}`" />
          </div>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<template>
  <a-drawer
    v-model:open="open"
    :title="`版本历史 · ${templateName || ''}`"
    :width="800"
    :destroy-on-close="true"
    @after-open-change="onOpenChange"
  >
    <a-spin :spinning="loading">
      <div v-if="versions.length === 0" class="py-12">
        <a-empty description="暂无版本记录" />
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="v in versions"
          :key="v.versionId"
          class="rounded-lg border transition-colors"
          :class="v.isCurrent === 1 ? 'border-blue-300 bg-blue-50/50' : 'border-gray-100 hover:border-gray-200'"
        >
          <div class="flex items-center justify-between p-4">
            <div class="flex items-center gap-3">
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
                :class="v.isCurrent === 1 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'"
              >
                v{{ v.version }}
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium"> 版本 v{{ v.version }} </span>
                  <a-tag v-if="v.isCurrent === 1" color="blue" class="!m-0"> 当前 </a-tag>
                </div>
                <div class="mt-0.5 text-xs text-gray-500">
                  {{ v.changelog || '无变更说明' }}
                </div>
                <div class="mt-0.5 text-xs text-gray-400">
                  {{ dayjs(v.createdAt).format('YYYY-MM-DD HH:mm:ss') }}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1">
              <a-button size="small" @click="handlePreview(v)"> 预览 </a-button>
              <a-button
                v-if="v.isCurrent !== 1"
                size="small"
                type="primary"
                ghost
                :loading="rollbacking === v.version"
                @click="handleRollback(v)"
              >
                回滚到此版本
              </a-button>
            </div>
          </div>
        </div>
      </div>
    </a-spin>

    <!-- 预览弹窗 -->
    <a-modal v-model:open="previewOpen" :title="`版本 v${previewVersion} 内容预览`" :width="960" :footer="null">
      <div class="max-h-[600px] overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
        <pre class="font-mono text-xs break-all whitespace-pre-wrap text-gray-700">{{ previewContent }}</pre>
      </div>
    </a-modal>
  </a-drawer>
</template>

<script setup lang="ts">
import { Modal, message } from 'antdv-next'
import { ref } from 'vue'

import dayjs from '~/utils/dayjs'

import { getGenTemplateDetail, rollbackGenTemplate, type GenTemplateVersion } from '../api'

defineOptions({ name: 'TemplateVersionDrawer' })

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  templateId: string | null
  templateName: string
}>()

const emit = defineEmits<{ success: [] }>()

const loading = ref(false)
const versions = ref<GenTemplateVersion[]>([])
const currentContent = ref<string>('')
const rollbacking = ref<number | null>(null)

/* 预览弹窗 */
const previewOpen = ref(false)
const previewVersion = ref(0)
const previewContent = ref('')

async function load() {
  if (!props.templateId) return
  loading.value = true
  try {
    const res: any = await getGenTemplateDetail(props.templateId)
    const d = res?.data ?? res
    versions.value = (d?.versions ?? []).sort((a: GenTemplateVersion, b: GenTemplateVersion) => b.version - a.version)
    currentContent.value = d?.currentContent ?? ''
  } finally {
    loading.value = false
  }
}

function onOpenChange(v: boolean) {
  if (!v) {
    versions.value = []
    currentContent.value = ''
    return
  }
  void load()
}

function handlePreview(v: GenTemplateVersion) {
  previewVersion.value = v.version
  // 由于接口只返回 currentContent，其他版本需要前端本地缓存或额外接口
  // 这里若 v.isCurrent === 1 用 currentContent，否则提示
  if (v.isCurrent === 1) {
    previewContent.value = currentContent.value
  } else {
    // 若项目后端能提供「按版本查内容」的接口，替换此调用
    previewContent.value = '（预览历史版本内容需要后端提供版本内容接口）'
  }
  previewOpen.value = true
}

function handleRollback(v: GenTemplateVersion) {
  Modal.confirm({
    title: '回滚版本',
    content: `确定回滚到 v${v.version}？当前版本将保留在历史中。`,
    okType: 'danger',
    async onOk() {
      if (!props.templateId) return
      rollbacking.value = v.version
      try {
        await rollbackGenTemplate(props.templateId, v.version)
        message.success(`已回滚到 v${v.version}`)
        await load()
        emit('success')
      } finally {
        rollbacking.value = null
      }
    },
  })
}
</script>

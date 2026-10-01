<template>
  <a-modal
    v-model:open="open"
    title="审批"
    :width="560"
    :confirm-loading="submitting"
    :ok-text="action === 'approve' ? '确认通过' : '确认驳回'"
    :ok-type="action === 'reject' ? 'danger' : 'primary'"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <div v-if="record" class="space-y-4">
      <a-descriptions :column="1" size="small" bordered>
        <a-descriptions-item label="任务">{{ record.title }}</a-descriptions-item>
        <a-descriptions-item label="节点">{{ record.nodeName }}</a-descriptions-item>
        <a-descriptions-item label="来源">
          <a-tag :color="SOURCE_MAP[record.source]?.color">
            {{ SOURCE_MAP[record.source]?.label }}
          </a-tag>
        </a-descriptions-item>
      </a-descriptions>

      <a-form-item label="是否通过" :label-col="{ span: 4 }" :colon="false">
        <a-radio-group v-model:value="action">
          <a-radio value="approve">通过</a-radio>
          <a-radio value="reject">驳回</a-radio>
        </a-radio-group>
      </a-form-item>
      <!-- 驳回原因分类 -->
      <a-form-item v-if="action === 'reject'" :colon="false" label="驳回原因分类" :label-col="{ span: 4 }">
        <Select v-model:value="reasonType" placeholder="请选择分类" :options="REJECT_REASON_OPTIONS" />
      </a-form-item>

      <!-- 备注 -->
      <a-form-item label="审批意见" :colon="false" :label-col="{ span: 4 }">
        <a-textarea
          v-model:value="comment"
          :rows="3"
          :maxlength="500"
          show-count
          :placeholder="action === 'reject' ? '请填写驳回原因（必填）' : '选填审批意见'"
        />
      </a-form-item>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { message, Select } from 'antdv-next'
import { ref, watch } from 'vue'

import type { TodoItem } from '~/api/workflow'

import { centerComplete } from '~/api/workflow'

import { SOURCE_MAP } from '../center/todo/constants'
import { REJECT_REASON_OPTIONS } from '../constant'

defineOptions({ name: 'ApproveModal' })

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  record: TodoItem | null
}>()

const emit = defineEmits<{ success: [] }>()

const action = ref<'approve' | 'reject'>('approve')
const comment = ref('')
const reasonType = ref<string>()
const submitting = ref(false)

watch(
  () => open.value,
  (val) => {
    if (val) {
      action.value = 'approve'
      comment.value = ''
      reasonType.value = undefined
    }
  },
)

async function handleOk() {
  if (!props.record) return

  if (action.value === 'reject') {
    if (!reasonType.value) {
      message.warning('请选择驳回原因分类')
      return
    }
    if (!comment.value.trim()) {
      message.warning('请填写驳回原因')
      return
    }
  }

  submitting.value = true
  try {
    await centerComplete({
      source: props.record.source,
      id: props.record.id,
      action: action.value,
      comment: comment.value || undefined,
      reasonType: reasonType.value,
    })
    message.success(action.value === 'approve' ? '审批通过' : '已驳回')
    open.value = false
    emit('success')
  } finally {
    submitting.value = false
  }
}

function handleCancel() {
  comment.value = ''
  reasonType.value = undefined
}
</script>

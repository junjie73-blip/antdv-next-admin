<template>
  <a-modal
    v-model:open="open"
    :title="isEditing ? '修改申请' : '发起审批'"
    :width="600"
    :confirm-loading="submitting"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <a-form
      ref="formRef"
      :model="formState"
      :rules="rules"
      :label-col="{ span: 5 }"
      :wrapper-col="{ span: 18 }"
      class="pt-2"
    >
      <a-form-item label="申请标题" name="title">
        <a-input v-model:value="formState.title" :maxlength="256" show-count placeholder="请输入申请标题" />
      </a-form-item>

      <a-form-item label="申请说明" name="content">
        <a-textarea
          v-model:value="formState.content"
          :rows="4"
          :maxlength="1000"
          show-count
          placeholder="请输入申请说明"
        />
      </a-form-item>

      <!-- ⭐ 编辑模式也展示业务数据 -->
      <a-form-item label="业务数据" name="formDataText">
        <a-textarea v-model:value="formState.formDataText" :rows="3" placeholder='{"amount": 4000}' />
        <div class="mt-1 text-xs text-gray-400">可选，JSON 格式</div>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import type { FormInstance, FormProps } from 'antdv-next'

import { message } from 'antdv-next'
import { ref, reactive, watch } from 'vue'

import type { ApprovalFlowRecord } from '../types'

import { createApproval, resubmitApproval } from '../api'

defineOptions({ name: 'ApprovalCreateModal' })

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  /** 传入则为重新提交模式 */
  record?: ApprovalFlowRecord | null
}>()

const emit = defineEmits<{
  success: []
}>()

const formRef = ref<FormInstance>()
const submitting = ref(false)
const isEditing = ref(false)

const formState = reactive({
  title: '',
  content: '',
  formDataText: '',
})

const rules: FormProps['rules'] = {
  title: [
    { required: true, message: '请输入申请标题', trigger: 'blur' },
    { max: 256, message: '标题不能超过 256 字', trigger: 'blur' },
  ],
}

watch(
  () => [open.value, props.record] as const,
  ([val, record]) => {
    if (!val) return
    if (record) {
      isEditing.value = true
      formState.title = record.title
      formState.content = record.content ?? ''
      // ⭐ 编辑模式也回填业务数据
      formState.formDataText = record.formData ? JSON.stringify(record.formData, null, 2) : ''
    } else {
      isEditing.value = false
      formState.title = ''
      formState.content = ''
      formState.formDataText = ''
    }
    formRef.value?.clearValidate()
  },
  { immediate: true },
)

async function handleOk() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  let formData: Record<string, unknown> | undefined
  if (formState.formDataText.trim()) {
    try {
      formData = JSON.parse(formState.formDataText)
    } catch {
      message.error('业务数据不是合法的 JSON')
      return
    }
  }

  const payload = {
    title: formState.title.trim(),
    content: formState.content.trim() || undefined,
    formData,
  }

  submitting.value = true
  try {
    if (isEditing.value && props.record) {
      await resubmitApproval(props.record.requestId, payload)
      message.success('重新提交成功')
    } else {
      await createApproval(payload)
      message.success('发起成功')
    }
    open.value = false
    emit('success')
  } finally {
    submitting.value = false
  }
}

function handleCancel() {
  formRef.value?.resetFields()
}
</script>

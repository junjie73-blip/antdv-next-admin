<template>
  <a-modal
    v-model:open="open"
    title="驳回申请"
    :width="520"
    :confirm-loading="submitting"
    ok-text="确认驳回"
    ok-type="danger"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <a-form
      ref="formRef"
      :model="formState"
      :rules="rules"
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 17 }"
      class="pt-2"
    >
      <a-form-item label="原因分类" name="reasonType">
        <Select v-model:value="formState.reasonType" placeholder="请选择分类" :options="reasonOptions" />
      </a-form-item>

      <a-form-item label="详细说明" name="remark">
        <a-textarea
          v-model:value="formState.remark"
          :rows="4"
          :maxlength="500"
          show-count
          placeholder="请填写驳回的详细说明（至少 5 个字）"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import type { FormInstance, FormProps, SelectProps } from 'antdv-next'

import { message, Select } from 'antdv-next'
import { ref, reactive, watch, computed } from 'vue'

import type { ApprovalFlowRecord } from '../types'

import { rejectApproval } from '../api'
import { REJECT_REASON_OPTIONS } from '../constants'
defineOptions({ name: 'ApprovalRejectModal' })

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  record?: ApprovalFlowRecord | null
}>()

const emit = defineEmits<{
  success: []
}>()

const formRef = ref<FormInstance>()
const submitting = ref(false)

const formState = reactive({
  reasonType: undefined as string | undefined,
  remark: '',
})

const reasonOptions = computed<SelectProps['options']>(() =>
  REJECT_REASON_OPTIONS.map((item) => ({
    label: item.label,
    value: item.value,
  })),
)

const rules: FormProps['rules'] = {
  reasonType: [{ required: true, message: '请选择驳回原因分类', trigger: 'change' }],
  remark: [
    { required: true, message: '请填写详细说明', trigger: 'blur' },
    { min: 5, message: '至少 5 个字', trigger: 'blur' },
  ],
}

watch(
  () => open.value,
  (val) => {
    if (val) {
      formState.reasonType = undefined
      formState.remark = ''
      formRef.value?.clearValidate()
    }
  },
)

async function handleOk() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  if (!props.record) return

  submitting.value = true
  try {
    await rejectApproval(props.record.requestId, {
      reasonType: formState.reasonType!,
      remark: formState.remark.trim(),
    })
    message.success('已驳回')
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

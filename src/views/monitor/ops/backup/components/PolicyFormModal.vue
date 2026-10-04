<script setup lang="ts">
import { message } from 'antdv-next'
import { pick } from 'es-toolkit'
import { nextTick, ref } from 'vue'

import { BasicForm, useForm } from '~/components/business/Form'

import type { BackupPolicy } from '../types'

import { savePolicy } from '../api'
import { POLICY_EDITABLE_FIELDS } from '../constants'
import { usePolicyFormSchemas } from '../schemas'

defineOptions({ name: 'PolicyFormModal' })

const emit = defineEmits<{ success: [] }>()

const currentRecord = ref<BackupPolicy>()

const visible = ref(false)
const submitting = ref(false)
const isEditing = ref(false)

const [registerForm, formMethods] = useForm({
  labelWidth: 100,
  schemas: usePolicyFormSchemas(),
})

async function open(record?: BackupPolicy): Promise<void> {
  visible.value = true
  isEditing.value = !!record?.policyId
  currentRecord.value = record
  await formMethods.resetFields()
  await nextTick()

  if (record) {
    await formMethods.setFieldsValue({
      ...pick(record, POLICY_EDITABLE_FIELDS),
      enabled: record.enabled === 1,
    })
  } else {
    await formMethods.setFieldsValue({ enabled: true })
  }
}

defineExpose({ open })

async function handleSubmit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  try {
    const values = await formMethods.validate()
    await savePolicy({
      policyId: isEditing.value ? currentRecord.value?.policyId : undefined,
      name: values.name,
      cron: values.cron,
      backupType: values.backupType,
      retainDays: values.retainDays,
      retainCount: values.retainCount,
      enabled: values.enabled ? 1 : 0,
      bucket: values.bucket ?? null,
      remark: values.remark ?? null,
    })
    message.success(isEditing.value ? '更新成功' : '创建成功')
    emit('success')
    visible.value = false
  } finally {
    submitting.value = false
  }
}

function handleCancel(): void {
  visible.value = false
}
</script>

<template>
  <a-modal
    v-model:open="visible"
    :title="isEditing ? '编辑备份策略' : '新增备份策略'"
    :width="640"
    :confirm-loading="submitting"
    ok-text="保存"
    cancel-text="取消"
    destroy-on-close
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <BasicForm @register="registerForm" :show-action-button-group="false">
      <template #cron-editor="{ model, field }">
        <CronEditor
          :model-value="model[field]"
          @update:model-value="(val) => formMethods.setFieldsValue({ [field]: val })"
        />
      </template>
    </BasicForm>
  </a-modal>
</template>

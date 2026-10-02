<template>
  <a-drawer
    v-model:open="open"
    :title="`编辑归档策略 · ${TABLE_LABEL[record?.tableName ?? ''] ?? record?.tableName ?? ''}`"
    :width="480"
    :destroy-on-close="true"
    @after-open-change="onOpenChange"
  >
    <template #extra>
      <a-space>
        <a-button @click="open = false">取消</a-button>
        <a-button type="primary" :loading="saving" @click="handleSave"> 保存 </a-button>
      </a-space>
    </template>

    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <a-form-item label="显示名" name="displayName">
        <a-input v-model:value="form.displayName" :maxlength="128" />
      </a-form-item>

      <a-form-item label="保留期（月）" name="retentionMonths">
        <a-input-number v-model:value="form.retentionMonths" :min="1" :max="120" class="w-full" />
        <div class="mt-1 text-xs text-gray-400">超过此期限的数据将被归档</div>
      </a-form-item>

      <a-form-item label="归档前上传对象存储" name="storageEnabled">
        <a-switch v-model:checked="form.storageEnabledBool" />
        <span class="ml-2 text-xs text-gray-400">关闭后仅删除，不保留备份</span>
      </a-form-item>

      <a-form-item label="批大小" name="batchSize">
        <a-input-number v-model:value="form.batchSize" :min="100" :max="100000" class="w-full" />
      </a-form-item>

      <a-form-item label="执行 Cron" name="cronExpression">
        <a-input v-model:value="form.cronExpression" placeholder="0 3 * * *" />
        <div class="mt-1 text-xs text-gray-400">默认每天 3:00，可自定义</div>
      </a-form-item>

      <a-form-item label="启用" name="enabled">
        <a-switch v-model:checked="form.enabledBool" />
      </a-form-item>

      <a-form-item label="备注" name="remark">
        <a-textarea v-model:value="form.remark" :rows="2" :maxlength="512" show-count />
      </a-form-item>
    </a-form>
  </a-drawer>
</template>

<script setup lang="ts">
import { message, type FormInstance, type FormProps } from 'antdv-next'
import { reactive, ref } from 'vue'

import type { ArchivePolicyRecord } from '../api'

import { updateArchivePolicy } from '../api'
import { TABLE_LABEL } from '../constants'

defineOptions({ name: 'ArchivePolicyEditorDrawer' })

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ record: ArchivePolicyRecord | null }>()
const emit = defineEmits<{ success: [] }>()

const formRef = ref<FormInstance>()
const saving = ref(false)

const form = reactive({
  displayName: '',
  retentionMonths: 6,
  storageEnabledBool: true,
  batchSize: 5000,
  cronExpression: '0 3 * * *',
  enabledBool: true,
  remark: '',
})

const rules: FormProps['rules'] = {
  retentionMonths: [{ required: true, message: '请输入保留期' }],
  cronExpression: [{ required: true, message: '请输入 Cron' }],
}

function onOpenChange(v: boolean) {
  if (!v) return
  formRef.value?.clearValidate()
  if (!props.record) return

  const r = props.record
  form.displayName = r.displayName
  form.retentionMonths = r.retentionMonths
  form.storageEnabledBool = r.storageEnabled === 1
  form.batchSize = r.batchSize
  form.cronExpression = r.cronExpression
  form.enabledBool = r.enabled === 1
  form.remark = r.remark ?? ''
}

async function handleSave() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  if (!props.record) return

  saving.value = true
  try {
    await updateArchivePolicy(props.record.tableName as any, {
      displayName: form.displayName,
      retentionMonths: form.retentionMonths,
      storageEnabled: form.storageEnabledBool ? 1 : 0,
      batchSize: form.batchSize,
      cronExpression: form.cronExpression,
      enabled: form.enabledBool ? 1 : 0,
      remark: form.remark || null,
    })
    message.success('保存成功')
    open.value = false
    emit('success')
  } finally {
    saving.value = false
  }
}
</script>

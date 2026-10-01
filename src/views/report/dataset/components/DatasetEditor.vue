<template>
  <a-modal
    v-model:open="open"
    :title="isEdit ? '编辑数据集' : '新建数据集'"
    :width="720"
    :confirm-loading="submitting"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <a-form
      ref="formRef"
      :model="formState"
      :rules="rules"
      :label-col="{ span: 4 }"
      :wrapper-col="{ span: 19 }"
      class="pt-2"
    >
      <a-form-item label="编码" name="datasetCode">
        <a-input v-model:value="formState.datasetCode" :disabled="isEdit" placeholder="如 user-list" />
      </a-form-item>

      <a-form-item label="名称" name="datasetName">
        <a-input v-model:value="formState.datasetName" placeholder="如 用户列表" />
      </a-form-item>

      <a-form-item label="分类" name="category">
        <Select
          v-model:value="formState.category"
          placeholder="选择分类"
          allow-clear
          :options="[
            { label: '业务', value: 'business' },
            { label: '财务', value: 'finance' },
            { label: '系统', value: 'system' },
          ]"
        />
      </a-form-item>

      <a-form-item label="描述" name="description">
        <a-input v-model:value="formState.description" placeholder="可选" />
      </a-form-item>

      <a-form-item label="SQL" name="sql">
        <a-textarea
          v-model:value="formState.sourceConfig.sql"
          :rows="8"
          placeholder="SELECT * FROM sys_user WHERE tenant_id = :tenantId"
          class="font-mono text-sm"
        />
        <div v-if="extractedParams.length" class="mt-2 text-xs text-gray-500">
          检测到 {{ extractedParams.length }} 个参数：
          <a-tag v-for="p in extractedParams" :key="p" color="blue" size="small" class="ml-1"> :{{ p }} </a-tag>
        </div>
      </a-form-item>

      <a-form-item label="超时">
        <a-input-number
          v-model:value="formState.sourceConfig.timeout"
          :min="1000"
          :max="300000"
          addon-after="ms"
          class="w-full"
        />
      </a-form-item>

      <a-form-item label="最大行数">
        <a-input-number v-model:value="formState.sourceConfig.maxRows" :min="1" :max="1000000" class="w-full" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { message, type FormInstance, type FormProps, Select } from 'antdv-next'
import { computed, reactive, ref, watch } from 'vue'

import { createDataset, getDatasetDetail, updateDataset } from '~/api/report'

import type { DatasetRecord } from '../types'

defineOptions({ name: 'DatasetEditor' })

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  record: DatasetRecord | null
}>()

const emit = defineEmits<{ success: [] }>()

const formRef = ref<FormInstance>()
const submitting = ref(false)

const formState = reactive({
  datasetCode: '',
  datasetName: '',
  description: '',
  category: undefined as string | undefined,
  sourceConfig: {
    sql: '',
    timeout: 30000,
    maxRows: 10000,
  },
})

const rules: FormProps['rules'] = {
  datasetCode: [
    { required: true, message: '请输入编码', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z][a-zA-Z0-9_-]*$/,
      message: '只允许字母开头，含字母数字下划线',
      trigger: 'blur',
    },
  ],
  datasetName: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  sql: [{ required: true, message: '请输入 SQL', trigger: 'blur' }],
}

const isEdit = computed(() => !!props.record)

const extractedParams = computed(() => {
  const sql = formState.sourceConfig.sql || ''
  const names = new Set<string>()
  const regex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(sql)) !== null) names.add(m[1]!)
  return [...names]
})

watch(
  () => [open.value, props.record] as const,
  async ([val, record]) => {
    if (!val) return
    if (record) {
      const detail = await getDatasetDetail(record.dataset_id).catch(() => null)
      const cfg = detail?.source_config ?? { sql: '', timeout: 30000, maxRows: 10000 }
      Object.assign(formState, {
        datasetCode: detail?.dataset_code ?? record.dataset_code,
        datasetName: detail?.dataset_name ?? record.dataset_name,
        description: detail?.description ?? '',
        category: detail?.category ?? undefined,
        sourceConfig: {
          sql: cfg.sql ?? '',
          timeout: cfg.timeout ?? 30000,
          maxRows: cfg.maxRows ?? 10000,
        },
      })
    } else {
      Object.assign(formState, {
        datasetCode: '',
        datasetName: '',
        description: '',
        category: undefined,
        sourceConfig: { sql: '', timeout: 30000, maxRows: 10000 },
      })
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

  const payload = {
    datasetCode: formState.datasetCode,
    datasetName: formState.datasetName,
    description: formState.description || undefined,
    category: formState.category || undefined,
    datasetType: 'sql',
    sourceConfig: formState.sourceConfig,
    params: extractedParams.value.map((name) => ({
      name,
      type: 'string',
      required: false,
    })),
  }

  submitting.value = true
  try {
    if (isEdit.value && props.record) {
      await updateDataset(props.record.dataset_id, payload)
      message.success('更新成功')
    } else {
      await createDataset(payload)
      message.success('创建成功')
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

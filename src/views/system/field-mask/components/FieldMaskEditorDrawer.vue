<template>
  <a-drawer
    v-model:open="open"
    :title="isEdit ? '编辑脱敏策略' : '新增脱敏策略'"
    :width="560"
    :destroy-on-close="true"
    @after-open-change="onOpenChange"
  >
    <template #footer>
      <a-space class="flex w-full justify-center">
        <a-button @click="open = false">
          <template #icon><Icon icon="lucide:minus"></Icon></template>
          取消</a-button
        >
        <a-button type="primary" :loading="saving" @click="handleSave">
          <template #icon><Icon icon="lucide:check"></Icon></template>
          保存
        </a-button>
      </a-space>
    </template>
    <PerfectScrollbar class="h-full">
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-form-item label="策略名称" name="name">
          <a-input v-model:value="form.name" placeholder="如：手机号脱敏" :maxlength="64" />
        </a-form-item>

        <a-form-item label="字段路径" name="field">
          <a-input v-model:value="form.field" placeholder="如：user.phone" :maxlength="128" />
          <div class="mt-1 text-xs text-gray-400">
            支持点号分隔的路径，如 <code>user.phone</code>、<code>data.contact.email</code>
          </div>
        </a-form-item>

        <a-form-item label="掩码类型" name="maskType">
          <Select v-model:value="form.maskType" :options="MASK_TYPE_OPTIONS" @change="handleTypeChange" />
        </a-form-item>

        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="保留前缀位数" name="keepPrefix">
              <a-input-number v-model:value="form.keepPrefix" :min="0" :max="20" class="w-full" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="保留后缀位数" name="keepSuffix">
              <a-input-number v-model:value="form.keepSuffix" :min="0" :max="20" class="w-full" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="替换字符" name="replaceChar">
          <a-input v-model:value="form.replaceChar" placeholder="*" :maxlength="1" class="w-32" />
        </a-form-item>

        <!-- 自定义类型时显示正则 -->
        <a-form-item v-if="form.maskType === 'custom'" label="自定义正则" name="pattern">
          <a-input v-model:value="form.pattern" placeholder="如：(\d{3})\d{4}(\d{4})" :maxlength="512" />
          <div class="mt-1 text-xs text-gray-400">将匹配到的部分替换为替换字符</div>
        </a-form-item>

        <!-- 实时预览 -->
        <a-form-item label="效果预览">
          <div class="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <div class="mb-2 text-xs text-gray-500">输入示例值查看脱敏效果：</div>
            <a-input v-model:value="sampleValue" placeholder="如：13800138000" class="mb-2" />
            <div class="flex items-center gap-2 text-sm">
              <span class="text-gray-500">输出：</span>
              <code class="rounded bg-white px-2 py-1 font-mono text-xs">
                {{ previewResult || '—' }}
              </code>
            </div>
          </div>
        </a-form-item>

        <a-form-item label="状态" name="status">
          <a-radio-group v-model:value="form.status" button-style="solid">
            <a-radio-button value="1">启用</a-radio-button>
            <a-radio-button value="0">禁用</a-radio-button>
          </a-radio-group>
        </a-form-item>

        <a-form-item label="描述" name="description">
          <a-textarea v-model:value="form.description" :rows="3" :maxlength="512" show-count placeholder="可选" />
        </a-form-item>
      </a-form>
    </PerfectScrollbar>
  </a-drawer>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message, Select, type FormInstance, type FormProps } from 'antdv-next'
import { computed, reactive, ref } from 'vue'

import { createFieldMask, getFieldMaskDetail, updateFieldMask, type FieldMaskRecord, type MaskType } from '../api'
import { MASK_TYPE_DEFAULTS, MASK_TYPE_OPTIONS, previewMask } from '../constants'

defineOptions({ name: 'FieldMaskEditorDrawer' })

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{ record: FieldMaskRecord | null }>()
const emit = defineEmits<{ success: [] }>()

const formRef = ref<FormInstance>()
const saving = ref(false)
const sampleValue = ref('')

const isEdit = computed(() => !!props.record)

const form = reactive<{
  name: string
  field: string
  maskType: MaskType
  pattern: string
  replaceChar: string
  keepPrefix: number
  keepSuffix: number
  description: string
  status: string
}>({
  name: '',
  field: '',
  maskType: 'phone',
  pattern: '',
  replaceChar: '*',
  keepPrefix: 3,
  keepSuffix: 4,
  description: '',
  status: '1',
})

const rules: FormProps['rules'] = {
  name: [{ required: true, message: '请输入策略名称', trigger: 'blur' }],
  field: [{ required: true, message: '请输入字段路径', trigger: 'blur' }],
  maskType: [{ required: true, message: '请选择掩码类型', trigger: 'change' }],
}

const previewResult = computed(() => {
  if (!sampleValue.value) return ''
  return previewMask(sampleValue.value, form.keepPrefix, form.keepSuffix, form.replaceChar)
})

function handleTypeChange(type: MaskType) {
  const dft = MASK_TYPE_DEFAULTS[type]
  if (dft) {
    form.keepPrefix = dft.keepPrefix
    form.keepSuffix = dft.keepSuffix
    form.replaceChar = dft.replaceChar
  }
}

async function onOpenChange(v: boolean) {
  if (!v) return
  formRef.value?.clearValidate()
  sampleValue.value = ''

  if (props.record) {
    const res: any = await getFieldMaskDetail(props.record.policyId).catch(() => null)
    const d = res?.data ?? res ?? props.record
    form.name = d.name
    form.field = d.field
    form.maskType = d.maskType
    form.pattern = d.pattern ?? ''
    form.replaceChar = d.replaceChar ?? '*'
    form.keepPrefix = d.keepPrefix ?? 3
    form.keepSuffix = d.keepSuffix ?? 4
    form.description = d.description ?? ''
    form.status = d.status ?? '1'
  } else {
    form.name = ''
    form.field = ''
    form.maskType = 'phone'
    form.pattern = ''
    form.replaceChar = '*'
    form.keepPrefix = 3
    form.keepSuffix = 4
    form.description = ''
    form.status = '1'
  }
}

async function handleSave() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  const payload: any = {
    name: form.name,
    field: form.field,
    maskType: form.maskType,
    replaceChar: form.replaceChar || '*',
    keepPrefix: form.keepPrefix,
    keepSuffix: form.keepSuffix,
    description: form.description || undefined,
    status: form.status,
  }
  if (form.maskType === 'custom') {
    payload.pattern = form.pattern || undefined
  }

  saving.value = true
  try {
    if (isEdit.value && props.record) {
      await updateFieldMask(props.record.policyId, payload)
      message.success('更新成功')
    } else {
      await createFieldMask(payload)
      message.success('创建成功')
    }
    open.value = false
    emit('success')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <a-drawer
    v-model:open="open"
    :title="isEdit ? '编辑流程' : '新建流程'"
    :width="720"
    :destroy-on-close="true"
    :footer-style="{ textAlign: 'right' }"
    @after-open-change="onOpenChange"
  >
    <a-form ref="formRef" :model="formState" :rules="rules" :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }">
      <a-form-item label="流程标识" name="defKey">
        <a-input v-model:value="formState.defKey" :disabled="isEdit" placeholder="如 leave-approval" />
        <div class="mt-1 text-xs text-gray-400">唯一标识，字母开头，只允许字母、数字、下划线、中划线</div>
      </a-form-item>

      <a-form-item label="流程名称" name="defName">
        <a-input v-model:value="formState.defName" placeholder="如 请假审批" />
      </a-form-item>

      <a-form-item label="分类" name="category">
        <Select
          v-model:value="formState.category"
          placeholder="选择分类"
          allow-clear
          :options="[
            { label: '人事', value: 'hr' },
            { label: '财务', value: 'finance' },
            { label: '采购', value: 'purchase' },
            { label: '其他', value: 'other' },
          ]"
        />
      </a-form-item>

      <a-form-item label="描述" name="description">
        <a-textarea v-model:value="formState.description" :rows="2" :maxlength="512" show-count placeholder="可选" />
      </a-form-item>

      <a-form-item label="流程定义" name="definition">
        <a-textarea
          v-model:value="formState.definitionText"
          :rows="12"
          class="font-mono text-sm"
          placeholder='{"id":"x","name":"x","nodes":[...],"edges":[...]}'
        />
        <div class="mt-1 text-xs text-gray-400">BPMN JSON 格式，包含 nodes / edges</div>
      </a-form-item>

      <a-form-item label="状态" name="status">
        <a-radio-group v-model:value="formState.status">
          <a-radio value="0">草稿</a-radio>
          <a-radio value="1">发布</a-radio>
        </a-radio-group>
      </a-form-item>
    </a-form>
  </a-drawer>
</template>

<script setup lang="ts">
import { message, type FormInstance, type FormProps, Select } from 'antdv-next'
import { computed, reactive, ref } from 'vue'

import { createDefinition, getDefinitionDetail, updateDefinition } from '~/api/workflow'

import type { DefinitionRecord } from '../types'

defineOptions({ name: 'DefinitionEditorDrawer' })

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  record: DefinitionRecord | null
}>()

const emit = defineEmits<{ success: [] }>()

const formRef = ref<FormInstance>()
const submitting = ref(false)

const formState = reactive({
  defKey: '',
  defName: '',
  category: undefined as string | undefined,
  description: '',
  definitionText: '',
  status: '0',
})

const isEdit = computed(() => !!props.record)

const rules: FormProps['rules'] = {
  defKey: [
    { required: true, message: '请输入流程标识', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z][a-zA-Z0-9_-]*$/,
      message: '只允许字母开头，含字母数字下划线中划线',
      trigger: 'blur',
    },
  ],
  defName: [{ required: true, message: '请输入流程名称', trigger: 'blur' }],
  definitionText: [{ required: true, message: '请输入流程定义', trigger: 'blur' }],
}

async function onOpenChange(val: boolean) {
  if (!val) return

  if (props.record) {
    // 编辑模式：拉最新详情
    const detail = await getDefinitionDetail(props.record.def_id).catch(() => null)
    if (detail) {
      formState.defKey = detail.def_key
      formState.defName = detail.def_name
      formState.category = detail.category ?? undefined
      formState.description = detail.description ?? ''
      formState.definitionText = JSON.stringify(detail.definition ?? {}, null, 2)
      formState.status = detail.status ?? '0'
    }
  } else {
    // 新建模式：给一份模板
    formState.defKey = ''
    formState.defName = ''
    formState.category = undefined
    formState.description = ''
    formState.definitionText = JSON.stringify(
      {
        id: 'new-flow',
        name: '新流程',
        nodes: [
          { id: 'start', type: 'start' },
          { id: 'approve', type: 'userTask', name: '审批', assignee: { type: 'initiator' } },
          { id: 'end', type: 'end' },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'approve' },
          { id: 'e2', source: 'approve', target: 'end' },
        ],
      },
      null,
      2,
    )
    formState.status = '0'
  }
  formRef.value?.clearValidate()
}

async function handleOk() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  // 校验 JSON
  let definition: any
  try {
    definition = JSON.parse(formState.definitionText)
  } catch {
    message.error('流程定义不是合法的 JSON')
    return
  }

  const payload = {
    defKey: formState.defKey,
    defName: formState.defName,
    category: formState.category,
    description: formState.description || undefined,
    definition,
    status: formState.status,
  }

  submitting.value = true
  try {
    if (isEdit.value && props.record) {
      await updateDefinition(props.record.def_id, payload)
      message.success('更新成功')
    } else {
      await createDefinition(payload)
      message.success('创建成功')
    }
    open.value = false
    emit('success')
  } finally {
    submitting.value = false
  }
}

/** 供父组件在抽屉底部按钮点击时调用 */
defineExpose({ handleOk })
</script>

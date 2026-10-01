<template>
  <div class="h-full overflow-y-auto p-4">
    <template v-if="selectedElement">
      <!-- 元素信息 -->
      <div class="mb-4 rounded-lg bg-gray-50 p-3">
        <div class="text-xs text-gray-500">当前选中</div>
        <div class="mt-1 text-sm font-medium text-gray-800">
          {{ elementLabel }}
        </div>
        <div class="mt-0.5 font-mono text-xs text-gray-400">
          {{ elementType }}
        </div>
      </div>

      <!-- form-create 动态表单 -->
      <form-create
        v-model="formData"
        v-model:api="formApi"
        :rule="formRules"
        :option="formOptions"
        @change="handleFormChange"
      />

      <!-- 表单字段配置（仅用户任务显示） -->
      <div v-if="isUserTask" class="mt-4 border-t border-gray-100 pt-4">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm font-medium text-gray-700">表单字段</span>
          <a-button type="link" size="small" @click="handleAddFormField">
            <template #icon><Icon icon="lucide:plus" /></template>
            添加
          </a-button>
        </div>

        <div v-if="formFields.length === 0" class="py-4 text-center text-xs text-gray-400">暂无表单字段</div>

        <div v-else class="space-y-2">
          <div v-for="(field, idx) in formFields" :key="idx" class="rounded-lg border border-gray-200 p-3">
            <div class="flex items-center justify-between">
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium text-gray-700">
                  {{ field.label || field.field }}
                </div>
                <div class="mt-0.5 text-xs text-gray-400">{{ field.type }} · {{ field.field }}</div>
              </div>
              <div class="flex items-center gap-1">
                <a-button type="text" size="small" @click="handleEditField(idx)">
                  <Icon icon="lucide:edit" />
                </a-button>
                <a-button type="text" size="small" danger @click="handleRemoveField(idx)">
                  <Icon icon="lucide:trash-2" />
                </a-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <a-empty v-else description="请选择流程节点" class="py-12" />
  </div>
</template>

<script setup lang="ts">
import type { Rule } from '@form-create/antdv-next'

import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'

import { buildRulesByElementType } from '../config/form-rules'

defineOptions({ name: 'PropertiesPanel' })

const props = defineProps<{
  selectedElement: any
}>()

const emit = defineEmits<{
  update: [props: Record<string, any>]
}>()

const formData = ref<Record<string, any>>({})
const formApi = ref<any>(null)

const formOptions = {
  labelWidth: 90,
  submitBtn: false,
  resetBtn: false,
}

const formRules = computed<Rule[]>(() => {
  if (!props.selectedElement) return []
  const type = props.selectedElement.type || props.selectedElement.businessObject?.$type || ''
  return buildRulesByElementType(type)
})

const elementType = computed(() => {
  return props.selectedElement?.businessObject?.$type ?? props.selectedElement?.type ?? ''
})

const elementLabel = computed(() => {
  return props.selectedElement?.businessObject?.name ?? props.selectedElement?.id ?? ''
})

const isUserTask = computed(() => {
  return elementType.value === 'bpmn:UserTask' || elementType.value === 'bpmn:ServiceTask'
})

/* 表单字段列表 */
const formFields = ref<Array<{ field: string; label: string; type: string }>>([])

/** 选中元素变化 → 同步表单数据 */
watch(
  () => props.selectedElement,
  (el) => {
    if (!el) {
      formData.value = {}
      formFields.value = []
      return
    }

    const bo = el.businessObject
    const props = readCustomProps(bo)

    formData.value = {
      name: bo.name ?? '',
      assigneeType: props.assigneeType ?? 'user',
      assigneeValue: props.assigneeValue ?? '',
      signType: props.signType ?? 'all',
      timeout: props.timeout ?? '',
      timeoutAction: props.timeoutAction ?? 'notify',
      priority: props.priority ?? 0,
      condition: props.condition ?? '',
    }

    // 解析表单字段
    if (props.formSchema) {
      try {
        formFields.value = JSON.parse(props.formSchema)
      } catch {
        formFields.value = []
      }
    } else {
      formFields.value = []
    }
  },
  { immediate: true },
)

/** 表单变化 → 同步到 BPMN 元素 */
function handleFormChange() {
  if (!props.selectedElement) return
  emit('update', { ...formData.value })
}

function handleAddFormField() {
  formFields.value.push({
    field: `field_${Date.now()}`,
    label: '新字段',
    type: 'input',
  })
}

function handleEditField(idx: number) {
  // TODO: 打开字段编辑弹窗
}

function handleRemoveField(idx: number) {
  formFields.value.splice(idx, 1)
}

/** 从 businessObject 读取自定义属性 */
function readCustomProps(bo: any): Record<string, any> {
  const ext = bo.extensionElements
  if (!ext?.values?.length) return {}

  for (const v of ext.values) {
    if (v.$type === 'workflow:CustomProps') {
      return {
        assigneeType: v.get('assigneeType'),
        assigneeValue: v.get('assigneeValue'),
        signType: v.get('signType'),
        timeout: v.get('timeout'),
        timeoutAction: v.get('timeoutAction'),
        priority: v.get('priority'),
        formSchema: v.get('formSchema'),
      }
    }
  }
  return {}
}
</script>

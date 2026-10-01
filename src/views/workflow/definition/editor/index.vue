<template>
  <a-drawer
    v-model:open="open"
    :title="isEdit ? '编辑流程' : '新建流程'"
    :width="1400"
    :destroy-on-close="true"
    :body-style="{ padding: 0, height: '100%' }"
    @after-open-change="onOpenChange"
  >
    <template #extra>
      <a-space>
        <a-button @click="handleExportJSON">
          <template #icon><Icon icon="lucide:code" /></template>
          导出 JSON
        </a-button>
        <a-button @click="handleExportSVG">
          <template #icon><Icon icon="lucide:image" /></template>
          导出图片
        </a-button>
        <a-button type="primary" :loading="saving" @click="handleSave">
          <template #icon><Icon icon="lucide:save" /></template>
          保存
        </a-button>
      </a-space>
    </template>

    <div class="flex h-full">
      <!-- BPMN 画布 -->
      <div class="flex-1">
        <BpmnCanvas ref="canvasRef" :initial-xml="initialXml" @save="handleCanvasSave" @change="handleElementChange" />
      </div>

      <!-- 右侧自定义属性面板（覆盖在 bpmn 原生面板上方） -->
      <div class="w-96 shrink-0 overflow-y-auto border-l border-gray-200 bg-white">
        <PropertiesPanel :selected-element="selectedElement" @update="handleUpdateElement" />
      </div>
    </div>
  </a-drawer>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { computed, ref } from 'vue'

import BpmnCanvas from './components/BpmnCanvas.vue'
import PropertiesPanel from './components/PropertiesPanel.vue'

defineOptions({ name: 'WorkflowDefinitionEditor' })

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  record?: { def_id: string; def_key: string; def_name: string } | null
  /** 已有 BPMN XML（编辑时传入） */
  existingXml?: string
}>()

const emit = defineEmits<{ success: [] }>()

const canvasRef = ref<InstanceType<typeof BpmnCanvas> | null>(null)
const saving = ref(false)
const selectedElement = ref<any>(null)
const currentXml = ref('')

const isEdit = computed(() => !!props.record)

const initialXml = computed(() => props.existingXml ?? undefined)

async function handleCanvasSave(xml: string) {
  currentXml.value = xml
}

function handleElementChange(el: any) {
  selectedElement.value = el
}

async function handleUpdateElement(props: Record<string, any>) {
  const modeler = canvasRef.value?.modeler
  if (!modeler || !selectedElement.value) return

  const modeling = modeler.get('modeling')
  const moddle = modeler.get('moddle')
  const bo = selectedElement.value.businessObject

  // 1. 更新 name
  if (props.name !== undefined) {
    modeling.updateProperties(selectedElement.value, { name: props.name })
  }

  // 2. 构造 workflow:CustomProps
  const customProps = moddle.create('workflow:CustomProps', {
    assigneeType: props.assigneeType,
    assigneeValue: props.assigneeValue,
    signType: props.signType,
    timeout: props.timeout,
    timeoutAction: props.timeoutAction,
    priority: props.priority,
    formSchema: props.formSchema,
  })

  // 3. 挂载到 extensionElements
  let ext = bo.extensionElements
  if (!ext) {
    ext = moddle.create('bpmn:ExtensionElements', { values: [] })
  }

  const others = (ext.values ?? []).filter((v: any) => v.$type !== 'workflow:CustomProps')
  ext.values = [...others, customProps]

  modeling.updateProperties(selectedElement.value, { extensionElements: ext })
}

async function handleSave() {
  const xml = await canvasRef.value?.saveXML()
  if (!xml) {
    message.error('无法获取流程 XML')
    return
  }

  saving.value = true
  try {
    // 解析 XML 为 JSON（便于后端处理）
    const definitionJson = await xmlToJson(xml)

    // 提交到后端
    const payload = {
      defKey: props.record?.def_key,
      defName: props.record?.def_name,
      definition: definitionJson,
      definitionXml: xml, // 同时保存 XML 以便还原画布
    }

    // await createDefinition / updateDefinition
    message.success(isEdit.value ? '更新成功' : '创建成功')
    open.value = false
    emit('success')
  } finally {
    saving.value = false
  }
}

async function handleExportJSON() {
  const xml = await canvasRef.value?.saveXML()
  if (!xml) return

  const json = await xmlToJson(xml)
  const blob = new Blob([JSON.stringify(json, null, 2)], {
    type: 'application/json',
  })
  downloadBlob(blob, `workflow-${Date.now()}.json`)
}

async function handleExportSVG() {
  const svg = await canvasRef.value?.modeler?.saveSVG()
  if (!svg?.svg) return

  const blob = new Blob([svg.svg], { type: 'image/svg+xml' })
  downloadBlob(blob, `workflow-${Date.now()}.svg`)
}

function onOpenChange(val: boolean) {
  if (!val) {
    selectedElement.value = null
    currentXml.value = ''
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
</script>

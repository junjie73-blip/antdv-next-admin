<template>
  <div class="flex h-full flex-col">
    <!-- 工具栏 -->
    <BpmnToolbar
      :modeler="modeler"
      @save="handleSave"
      @undo="handleUndo"
      @redo="handleRedo"
      @zoom-in="handleZoomIn"
      @zoom-out="handleZoomOut"
      @fit="handleFit"
    />

    <!-- 画布 + 属性面板 -->
    <div class="flex flex-1 overflow-hidden">
      <!-- 画布 -->
      <div ref="containerRef" class="flex-1 bg-white" />

      <!-- 属性面板 -->
      <div ref="propertiesPanelRef" class="w-80 shrink-0 overflow-y-auto border-l border-gray-200 bg-white" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'

import { useBpmnModeler } from '../composables/useBpmnModeler'
import BpmnToolbar from './BpmnToolbar.vue'

defineOptions({ name: 'BpmnCanvas' })

const props = defineProps<{
  initialXml?: string
}>()

const emit = defineEmits<{
  save: [xml: string]
  change: [element: any]
}>()

const { containerRef, propertiesPanelRef, modeler, selectedElement, init, saveXML, importXML } = useBpmnModeler()

async function handleSave() {
  const xml = await saveXML()
  emit('save', xml)
}

function handleUndo() {
  modeler.value?.get('commandStack').undo()
}

function handleRedo() {
  modeler.value?.get('commandStack').redo()
}

function handleZoomIn() {
  const canvas = modeler.value?.get('canvas')
  if (!canvas) return
  const current = canvas.zoom()
  canvas.zoom(Math.min(current + 0.1, 2))
}

function handleZoomOut() {
  const canvas = modeler.value?.get('canvas')
  if (!canvas) return
  const current = canvas.zoom()
  canvas.zoom(Math.max(current - 0.1, 0.2))
}

function handleFit() {
  modeler.value?.get('canvas').zoom('fit-viewport')
}

watch(selectedElement, (el) => {
  emit('change', el)
})

onMounted(async () => {
  await init(props.initialXml)
})

defineExpose({ importXML, saveXML, modeler })
</script>

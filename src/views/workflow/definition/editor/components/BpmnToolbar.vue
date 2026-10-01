<template>
  <div class="flex items-center gap-1 border-b border-gray-200 bg-white px-3 py-2">
    <!-- 撤销/重做 -->
    <a-button size="small" @click="emit('undo')" title="撤销">
      <template #icon><Icon icon="lucide:undo-2" /></template>
    </a-button>
    <a-button size="small" @click="emit('redo')" title="重做">
      <template #icon><Icon icon="lucide:redo-2" /></template>
    </a-button>

    <a-divider type="vertical" />

    <!-- 新增节点 -->
    <a-dropdown>
      <a-button size="small">
        <template #icon><Icon icon="lucide:plus" /></template>
        添加节点
      </a-button>
      <template #overlay>
        <a-menu @click="handleAddNode">
          <a-menu-item key="bpmn:UserTask"> <Icon icon="lucide:user" class="mr-2" /> 用户任务 </a-menu-item>
          <a-menu-item key="bpmn:ServiceTask"> <Icon icon="lucide:settings" class="mr-2" /> 服务任务 </a-menu-item>
          <a-menu-item key="bpmn:ExclusiveGateway">
            <Icon icon="lucide:git-branch" class="mr-2" /> 排他网关
          </a-menu-item>
          <a-menu-item key="bpmn:ParallelGateway"> <Icon icon="lucide:git-merge" class="mr-2" /> 并行网关 </a-menu-item>
          <a-menu-item key="bpmn:EndEvent"> <Icon icon="lucide:circle-stop" class="mr-2" /> 结束事件 </a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>

    <a-divider type="vertical" />

    <!-- 缩放 -->
    <a-button size="small" @click="emit('zoom-out')">
      <template #icon><Icon icon="lucide:zoom-out" /></template>
    </a-button>
    <a-button size="small" @click="emit('fit')">
      <template #icon><Icon icon="lucide:maximize" /></template>
    </a-button>
    <a-button size="small" @click="emit('zoom-in')">
      <template #icon><Icon icon="lucide:zoom-in" /></template>
    </a-button>

    <div class="flex-1" />

    <!-- 保存 -->
    <a-button type="primary" size="small" @click="emit('save')">
      <template #icon><Icon icon="lucide:save" /></template>
      保存
    </a-button>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineOptions({ name: 'BpmnToolbar' })

const props = defineProps<{
  modeler: any
}>()

const emit = defineEmits<{
  save: []
  undo: []
  redo: []
  'zoom-in': []
  'zoom-out': []
  fit: []
}>()

function handleAddNode({ key }: { key: string }) {
  const modeling = props.modeler?.get('modeling')
  const elementFactory = props.modeler?.get('elementFactory')
  const canvas = props.modeler?.get('canvas')

  if (!modeling || !elementFactory || !canvas) return

  const shape = elementFactory.createShape({ type: key })
  const rootElement = canvas.getRootElement()

  // 放在画布中心附近
  modeling.createShape(shape, { x: 400, y: 300 }, rootElement)
}
</script>

<template>
  <div v-if="!safeNodes.length" class="text-center text-gray-500">暂无审批节点</div>
  <div v-else class="h-[560px] w-full rounded-lg border border-gray-300">
    <VueFlow
      :nodes="flowNodes"
      :edges="flowEdges"
      :default-viewport="{ zoom: 1 }"
      :min-zoom="0.2"
      :max-zoom="2"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :elements-selectable="false"
      :fit-view-on-init="false"
      @init="onInit"
    >
      <template #node-approval="nodeProps">
        <ApprovalFlowNode :data="nodeProps.data" />
      </template>
      <Background pattern-color="#cbd5e1" :gap="20" />
      <!-- <Controls position="top-left" /> -->
      <!-- <MiniMap position="bottom-right" /> -->
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import type { VueFlowStore } from '@vue-flow/core'

import { Background } from '@vue-flow/background'
import { VueFlow, MarkerType } from '@vue-flow/core'
import { computed, ref, nextTick, watch } from 'vue'

import type { ApprovalNode } from '../../approval/workflow/types'

// import { Controls } from "@vue-flow/controls";
// import { MiniMap } from "@vue-flow/minimap";
import ApprovalFlowNode from './ApprovalFlowNode.vue'

defineOptions({ name: 'ApprovalFlowChart' })
const props = defineProps<{ nodes?: ApprovalNode[] | null }>()

const flowInstance = ref<VueFlowStore | null>(null)

function onInit(instance: VueFlowStore) {
  flowInstance.value = instance
  nextTick(() =>
    setTimeout(() => {
      instance.fitView({ padding: 0.25, duration: 400 })
    }, 50),
  )
}

/* 布局：每行 4 个，自动换行 */
const NODE_WIDTH = 200
const H_GAP = 100
const V_GAP = 140
const PER_ROW = 4

const safeNodes = computed<ApprovalNode[]>(() => {
  const raw = props.nodes
  if (!Array.isArray(raw)) return []
  return raw.filter((n) => n && typeof n === 'object' && !!n.nodeId).sort((a, b) => a.sequence - b.sequence)
})

const flowNodes = computed(() =>
  safeNodes.value.map((node, index) => {
    const row = Math.floor(index / PER_ROW)
    const col = index % PER_ROW
    return {
      id: node.nodeId,
      type: 'approval',
      position: {
        x: col * (NODE_WIDTH + H_GAP),
        y: row * V_GAP,
      },
      data: node,
      style: { width: `${NODE_WIDTH}px` },
    }
  }),
)

const flowEdges = computed(() => {
  const nodes = safeNodes.value
  const edges: any[] = []

  for (let i = 0; i < nodes.length - 1; i++) {
    const current = nodes[i]!
    const next = nodes[i + 1]!

    // 判断边颜色：基于当前节点状态
    let stroke = '#cbd5e1'
    let animated = false
    let edgeType = 'smoothstep'

    if (current.status === '1') {
      stroke = '#22c55e'
    } else if (current.status === '2') {
      // ⭐ 驳回后，连到下一条时用红色虚线，标识"重新开始"
      stroke = '#ef4444'
      animated = true
      edgeType = 'smoothstep'
    } else if (current.status === '0' && current.isCurrent === 1) {
      stroke = '#3b82f6'
      animated = true
    }

    edges.push({
      id: `e-${current.nodeId}-${next.nodeId}`,
      source: current.nodeId,
      target: next.nodeId,
      type: edgeType,
      animated,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: stroke,
      },
      style: { stroke, strokeWidth: 2 },
      label: current.status === '2' && next.round > current.round ? `第 ${next.round} 轮` : undefined,
      labelStyle: { fill: '#6b7280', fontSize: 11 },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.9 },
    })
  }
  return edges
})

watch(
  () => safeNodes.value.length,
  async () => {
    await nextTick()
    if (flowInstance.value) {
      setTimeout(() => {
        flowInstance.value!.fitView({ padding: 0.25, duration: 400 })
      }, 100)
    }
  },
)
</script>

<style>
.vue-flow__controls {
  border-radius: 8px;
  overflow: hidden;
}
.vue-flow__minimap {
  border-radius: 8px;
  overflow: hidden;
}
.vue-flow__handle {
  width: 8px !important;
  height: 8px !important;
  background: transparent !important;
  border: none !important;
  opacity: 0 !important;
}
</style>

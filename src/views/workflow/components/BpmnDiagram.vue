<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'

import type { WfDefinitionJSON, WfNode, WfEdge } from '~/api'

defineOptions({ name: 'BpmnDiagram' })

const props = defineProps<{
  definition: WfDefinitionJSON
  /** 节点状态：active / completed / rejected / pending */
  nodeStatus?: Record<string, string>
  /** 高亮路径 */
  activeEdges?: string[]
}>()

/* ============================================================
 * 简单布局：从左到右，按 BFS 层级
 * ============================================================ */
const NODE_W = 160
const NODE_H = 56
const GAP_X = 80
const GAP_Y = 40

interface LayoutNode {
  node: WfNode
  x: number
  y: number
}

interface LayoutEdge {
  edge: WfEdge
  from: LayoutNode
  to: LayoutNode
}

const { layoutNodes, layoutEdges, canvasW, canvasH } = computedLayout()

function computedLayout() {
  const nodes = props.definition.nodes ?? []
  const edges = props.definition.edges ?? []

  // 找 start
  const start = nodes.find((n) => n.type === 'start') ?? nodes[0]
  if (!start) {
    return { layoutNodes: [], layoutEdges: [], canvasW: 0, canvasH: 0 }
  }

  // BFS 分层
  const adj: Record<string, string[]> = {}
  for (const e of edges) {
    ;(adj[e.source] ??= []).push(e.target)
  }

  const level: Record<string, number> = {}
  const queue: Array<{ id: string; lv: number }> = [{ id: start.id, lv: 0 }]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const { id, lv } = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    level[id] = lv
    for (const next of adj[id] ?? []) {
      queue.push({ id: next, lv: lv + 1 })
    }
  }

  // 未访问的节点（孤岛）放最后
  for (const n of nodes) {
    if (!(n.id in level)) level[n.id] = 0
  }

  // 按 level 分组
  const groups: Record<number, WfNode[]> = {}
  for (const n of nodes) {
    ;(groups[level[n.id]] ??= []).push(n)
  }

  // 计算坐标
  const positions: Record<string, { x: number; y: number }> = {}
  let maxY = 0

  for (const [lvStr, list] of Object.entries(groups)) {
    const lv = Number(lvStr)
    const x = 40 + lv * (NODE_W + GAP_X)
    const totalH = list.length * NODE_H + (list.length - 1) * GAP_Y
    const startY = 40 + Math.max(0, (300 - totalH) / 2)

    list.forEach((n, i) => {
      positions[n.id] = { x, y: startY + i * (NODE_H + GAP_Y) }
      maxY = Math.max(maxY, startY + i * (NODE_H + GAP_Y) + NODE_H)
    })
  }

  const layoutNodes: LayoutNode[] = nodes.map((n) => ({
    node: n,
    ...positions[n.id],
  }))

  const map = new Map(layoutNodes.map((ln) => [ln.node.id, ln]))
  const layoutEdges: LayoutEdge[] = edges
    .map((e) => ({
      edge: e,
      from: map.get(e.source)!,
      to: map.get(e.target)!,
    }))
    .filter((e) => e.from && e.to)

  return {
    layoutNodes,
    layoutEdges,
    canvasW: 40 + Object.keys(groups).length * (NODE_W + GAP_X),
    canvasH: maxY + 40,
  }
}

/* ============================================================
 * 节点视觉
 * ============================================================ */
function nodeStyle(node: WfNode) {
  const status = props.nodeStatus?.[node.id] ?? 'pending'

  const base = {
    fill: '#ffffff',
    stroke: '#e5e7eb',
    text: '#374151',
    icon: 'ant-design:user-outlined',
  }

  switch (node.type) {
    case 'start':
      return { ...base, icon: 'ant-design:play-circle-outlined' }
    case 'end':
      return { ...base, icon: 'ant-design:check-circle-outlined' }
    case 'exclusiveGateway':
      return { ...base, icon: 'ant-design:branches-outlined' }
    case 'parallelGateway':
      return { ...base, icon: 'ant-design:partition-outlined' }
    case 'inclusiveGateway':
      return { ...base, icon: 'ant-design:apartment-outlined' }
    case 'serviceTask':
      return { ...base, icon: 'ant-design:thunderbolt-outlined' }
    case 'countersignTask':
      return { ...base, icon: 'ant-design:team-outlined' }
  }

  // 状态色覆盖
  if (status === 'active') {
    return {
      fill: '#eff6ff',
      stroke: '#3b82f6',
      text: '#1d4ed8',
      icon: base.icon,
    }
  }
  if (status === 'completed') {
    return {
      fill: '#ecfdf5',
      stroke: '#10b981',
      text: '#047857',
      icon: 'ant-design:check-outlined',
    }
  }
  if (status === 'rejected') {
    return {
      fill: '#fef2f2',
      stroke: '#ef4444',
      text: '#b91c1c',
      icon: 'ant-design:close-outlined',
    }
  }
  return base
}

/* ============================================================
 * 缩放/拖拽
 * ============================================================ */
const scale = ref(1)
const offset = ref({ x: 0, y: 0 })
const dragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  scale.value = Math.max(0.4, Math.min(2, scale.value + delta))
}

function onMouseDown(e: MouseEvent) {
  dragging.value = true
  dragStart.value = { x: e.clientX - offset.value.x, y: e.clientY - offset.value.y }
}
function onMouseMove(e: MouseEvent) {
  if (!dragging.value) return
  offset.value = { x: e.clientX - dragStart.value.x, y: e.clientY - dragStart.value.y }
}
function onMouseUp() {
  dragging.value = false
}
function reset() {
  scale.value = 1
  offset.value = { x: 0, y: 0 }
}

/* ============================================================
 * 贝塞尔曲线路径
 * ============================================================ */
function edgePath(edge: LayoutEdge): string {
  const x1 = edge.from.x + NODE_W
  const y1 = edge.from.y + NODE_H / 2
  const x2 = edge.to.x
  const y2 = edge.to.y + NODE_H / 2
  const cx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`
}

function edgeColor(edge: LayoutEdge) {
  return props.activeEdges?.includes(edge.edge.id) ? '#3b82f6' : '#d1d5db'
}
</script>

<template>
  <div class="relative overflow-hidden rounded-xl border border-gray-200/70 bg-gradient-to-b from-gray-50/50 to-white">
    <!-- 工具栏 -->
    <div
      class="absolute top-4 right-4 z-10 flex items-center gap-1 rounded-lg border border-gray-200 bg-white/90 p-1 shadow-sm backdrop-blur"
    >
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100"
        @click="scale = Math.min(2, scale + 0.1)"
      >
        <Icon icon="ant-design:zoom-in-outlined" />
      </button>
      <span class="min-w-[3rem] text-center text-xs text-gray-600 tabular-nums"> {{ Math.round(scale * 100) }}% </span>
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100"
        @click="scale = Math.max(0.4, scale - 0.1)"
      >
        <Icon icon="ant-design:zoom-out-outlined" />
      </button>
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100"
        @click="reset"
      >
        <Icon icon="ant-design:compress-outlined" />
      </button>
    </div>

    <!-- 画布 -->
    <div
      class="h-[420px] cursor-grab overflow-hidden"
      :class="{ 'cursor-grabbing': dragging }"
      @wheel.prevent="onWheel"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
    >
      <svg
        :width="canvasW"
        :height="canvasH"
        :viewBox="`${-offset.x / scale} ${-offset.y / scale} ${1200 / scale} ${600 / scale}`"
        preserveAspectRatio="xMidYMid meet"
        class="h-full w-full"
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#9ca3af" />
          </marker>
          <marker
            id="arrow-active"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
          </marker>
        </defs>

        <!-- 边 -->
        <g>
          <path
            v-for="e in layoutEdges"
            :key="e.edge.id"
            :d="edgePath(e)"
            :stroke="edgeColor(e)"
            :marker-end="activeEdges?.includes(e.edge.id) ? 'url(#arrow-active)' : 'url(#arrow)'"
            stroke-width="1.5"
            fill="none"
          />
          <text
            v-for="e in layoutEdges.filter((x) => x.edge.condition)"
            :key="`c-${e.edge.id}`"
            :x="(e.from.x + NODE_W + e.to.x) / 2"
            :y="(e.from.y + e.to.y) / 2 + NODE_H / 2 - 6"
            text-anchor="middle"
            class="fill-gray-500 text-[10px]"
          >
            {{ e.edge.condition }}
          </text>
        </g>

        <!-- 节点 -->
        <g v-for="ln in layoutNodes" :key="ln.node.id">
          <rect
            :x="ln.x"
            :y="ln.y"
            :width="NODE_W"
            :height="NODE_H"
            :rx="8"
            :fill="nodeStyle(ln.node).fill"
            :stroke="nodeStyle(ln.node).stroke"
            stroke-width="1.5"
            class="transition-all"
          />

          <!-- 图标 -->
          <g :transform="`translate(${ln.x + 12}, ${ln.y + NODE_H / 2 - 8})`">
            <foreignObject width="16" height="16">
              <Icon :icon="nodeStyle(ln.node).icon" :style="{ color: nodeStyle(ln.node).stroke }" />
            </foreignObject>
          </g>

          <!-- 文本 -->
          <text :x="ln.x + 36" :y="ln.y + NODE_H / 2 - 4" :fill="nodeStyle(ln.node).text" class="text-xs font-medium">
            {{ ln.node.name ?? ln.node.id }}
          </text>
          <text :x="ln.x + 36" :y="ln.y + NODE_H / 2 + 12" fill="#9ca3af" class="text-[10px]">
            {{ ln.node.type }}
          </text>
        </g>
      </svg>
    </div>

    <!-- 图例 -->
    <div
      class="absolute bottom-4 left-4 flex items-center gap-4 rounded-lg border border-gray-200 bg-white/90 px-3 py-1.5 text-xs shadow-sm backdrop-blur"
    >
      <span class="flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 rounded-sm border border-blue-500 bg-blue-50" />
        <span class="text-gray-600">进行中</span>
      </span>
      <span class="flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 rounded-sm border border-emerald-500 bg-emerald-50" />
        <span class="text-gray-600">已完成</span>
      </span>
      <span class="flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 rounded-sm border border-rose-500 bg-rose-50" />
        <span class="text-gray-600">已驳回</span>
      </span>
      <span class="flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 rounded-sm border border-gray-200 bg-white" />
        <span class="text-gray-600">未开始</span>
      </span>
    </div>
  </div>
</template>

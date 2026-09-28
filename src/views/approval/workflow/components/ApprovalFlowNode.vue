<template>
  <div :class="nodeWrapperClassName">
    <div class="flex items-center gap-2">
      <div :class="iconWrapperClassName">
        <Icon icon="lucide:user" v-if="isApplicant" class="h-4 w-4 text-white" />
        <Icon icon="lucide:check" v-if="status === '1'" class="h-4 w-4 text-white" />
        <Icon icon="lucide:x" v-else-if="status === '2'" class="h-4 w-4 text-white" />
        <Icon icon="lucide:minus" v-else-if="status === '3'" class="h-4 w-4 text-gray-400" />
        <Icon icon="lucide:clock" v-else :class="['h-4 w-4', isCurrent ? 'text-white' : 'text-gray-500']" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1">
          <span class="truncate text-sm font-semibold text-gray-800">
            {{ isApplicant ? '发起申请' : (data?.deptName ?? '未知部门') }}
          </span>
          <span v-if="!isApplicant && round > 1" class="shrink-0 rounded bg-gray-100 px-1 text-[10px] text-gray-500">
            R{{ round }}
          </span>
        </div>
        <div :class="statusTextClassName">
          {{ isApplicant ? '已提交' : statusLabel }}
        </div>
      </div>
    </div>
    <div v-if="isApplicant && data?.applicantName" class="mt-1.5 truncate text-xs text-gray-500">
      发起人：{{ data.applicantName }}
    </div>
    <div v-else-if="data?.approverName" class="mt-1.5 truncate text-xs text-gray-500">
      审批人：{{ data.approverName }}
    </div>
    <div
      v-if="status === '2' && data.rejectReason"
      class="mt-1.5 line-clamp-2 text-xs text-red-500"
      :title="data.rejectReason"
    >
      驳回：[{{ getRejectReasonLabel(data?.rejectReasonType) }}]：{{ data.rejectReason }}
    </div>
    <div v-if="data.approvedAt" class="mt-1 text-[11px] text-gray-400">
      {{ dayjs(data.approvedAt).format('YYYY-MM-DD HH:mm:ss') }}
    </div>

    <!-- ⚠️ 保留尺寸，不要 width:0 -->
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Handle, Position } from '@vue-flow/core'
import { computed } from 'vue'

import { cn } from '~/utils'
import dayjs from '~/utils/dayjs'

import type { ApprovalNode } from '../types'

import { getRejectReasonLabel } from '../constants'

defineOptions({ name: 'ApprovalFlowNode' })

const props = defineProps<{ data: ApprovalNode }>()
const isApplicant = computed(() => props.data?.isApplicant === true)
const status = computed(() => props.data.status)
const isCurrent = computed(() => props.data.isCurrent === 1)
const round = computed(() => props.data?.round ?? 1)
const statusLabel = computed(() => {
  if (status.value === '1') return '已通过'
  if (status.value === '2') return '已驳回'
  if (status.value === '3') return '已失效'
  return isCurrent.value ? '审批中' : '待审批'
})

const nodeWrapperClassName = computed(() =>
  cn(
    'rounded-lg border-2 px-4 py-3',
    'w-[200px]',
    'bg-white transition-all duration-300',
    isApplicant.value && 'border-slate-300 bg-slate-50',
    !isApplicant.value && status.value === '2' && 'border-red-400 bg-red-50 shadow-lg shadow-red-100',
    !isApplicant.value && status.value === '1' && 'border-green-300',
    !isApplicant.value && status.value === '3' && 'border-gray-200 opacity-50',
    !isApplicant.value &&
      status.value === '0' &&
      isCurrent.value &&
      'border-blue-500 bg-blue-50 shadow-lg shadow-blue-100',
    !isApplicant.value && status.value === '0' && !isCurrent.value && 'border-gray-300',
  ),
)

const iconWrapperClassName = computed(() =>
  cn(
    'flex items-center justify-center w-6 h-6 rounded-full shrink-0',
    isApplicant.value && 'bg-slate-500',
    !isApplicant.value && status.value === '1' && 'bg-green-500',
    !isApplicant.value && status.value === '2' && 'bg-red-500',
    !isApplicant.value && status.value === '3' && 'bg-gray-200',
    !isApplicant.value && status.value === '0' && isCurrent.value && 'bg-blue-500 animate-pulse',
    !isApplicant.value && status.value === '0' && !isCurrent.value && 'bg-gray-100',
  ),
)

const statusTextClassName = computed(() =>
  cn(
    'text-xs',
    isApplicant.value && 'text-slate-500',
    !isApplicant.value && status.value === '2' && 'text-red-500 font-medium',
    !isApplicant.value && status.value === '1' && 'text-green-600',
    !isApplicant.value && status.value === '0' && isCurrent.value && 'text-blue-600 font-medium',
    !isApplicant.value && status.value === '0' && !isCurrent.value && 'text-gray-400',
    !isApplicant.value && status.value === '3' && 'text-gray-400',
  ),
)
</script>

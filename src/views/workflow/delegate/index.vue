<template>
  <div class="space-y-4">
    <a-card :bordered="false">
      <a-tabs v-model:active-key="activeTab" @change="handleTabChange">
        <a-tab-pane key="mine" tab="我创建的" />
        <a-tab-pane key="acting" tab="我代理的" />
      </a-tabs>

      <BasicTable
        :columns="delegateColumns"
        :api="fetchApi"
        :immediate="true"
        :use-search-form="false"
        :action-column="actionColumn"
        :row-key="(r: WfDelegateItem) => r.delegateId"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button v-if="activeTab === 'mine'" type="primary" @click="handleCreate">
            <template #icon><Icon icon="lucide:plus" class="h-4 w-4" /></template>
            新建委托
          </a-button>
        </template>

        <template #cell-enabled="{ record }">
          <a-tag :color="record.enabled === 1 ? 'green' : 'default'">
            {{ record.enabled === 1 ? '生效中' : '已停用' }}
          </a-tag>
        </template>

        <template #cell-scope="{ record }">
          <a-tag>{{ record.scope === 'all' ? '全部流程' : '指定流程' }}</a-tag>
        </template>

        <template #cell-defKeys="{ record }">
          <template v-if="record.defKeys && record.defKeys.length > 0">
            <a-tag v-for="k in record.defKeys.slice(0, 3)" :key="k">{{ k }}</a-tag>
            <a-tag v-if="record.defKeys.length > 3">+{{ record.defKeys.length - 3 }}</a-tag>
          </template>
          <span v-else class="text-gray-400">全部</span>
        </template>

        <template #cell-startAt="{ record }">
          {{ dayjs(record.startAt).format('YYYY-MM-DD HH:mm') }}
        </template>
        <template #cell-endAt="{ record }">
          {{ dayjs(record.endAt).format('YYYY-MM-DD HH:mm') }}
        </template>

        <template #action="{ record }">
          <TableAction :actions="getDelegateActions(record as WfDelegateItem, actionCtx)" />
        </template>
      </BasicTable>
    </a-card>

    <DelegateEditorDrawer v-model:open="editorOpen" :record="currentRecord" @success="onSuccess" />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { ref } from 'vue'

import type { WfDelegateItem } from '~/api/workflow'

import { deleteDelegate, getActingDelegates, getMyDelegates, revokeDelegate } from '~/api/workflow'
import { TableAction, useTable } from '~/components/business/Table'
import dayjs from '~/utils/dayjs'

import { getDelegateActions, type DelegateActionContext } from './actions'
import { delegateColumns } from './columns'
import DelegateEditorDrawer from './components/DelegateEditorDrawer.vue'

defineOptions({ name: 'WorkflowDelegate' })

type TabKey = 'mine' | 'acting'
const activeTab = ref<TabKey>('mine')
const [tableRegister, tableMethods] = useTable()
const editorOpen = ref(false)
const currentRecord = ref<WfDelegateItem | null>(null)

const actionColumn = { width: 220, fixed: 'right' as const, align: 'center' as const }

async function fetchApi(params: any) {
  const fn = activeTab.value === 'mine' ? getMyDelegates : getActingDelegates
  return await fn(params)
}

function handleTabChange() {
  tableMethods.value?.reload?.()
}

function handleCreate() {
  currentRecord.value = null
  editorOpen.value = true
}

const actionCtx: DelegateActionContext = {
  onEdit(record) {
    currentRecord.value = record
    editorOpen.value = true
  },
  async onRevoke(record) {
    await revokeDelegate(record.delegateId)
    message.success('已撤销')
    await tableMethods.value?.reload?.()
  },
  async onDelete(record) {
    await deleteDelegate(record.delegateId)
    message.success('已删除')
    await tableMethods.value?.reload?.()
  },
}

async function onSuccess() {
  await tableMethods.value?.reload?.()
}
</script>

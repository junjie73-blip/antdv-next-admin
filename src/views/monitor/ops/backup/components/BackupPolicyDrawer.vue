<script setup lang="ts">
import { message } from 'antdv-next'
import { pick } from 'es-toolkit'
import { computed, ref, watch } from 'vue'

import { BasicTable, TableAction, useTable } from '~/components/business/Table'

import type { BackupPolicy } from '../types'

import { getPolicyActions } from '../actions'
import { deletePolicy, listPolicies, savePolicy } from '../api'
import { policyColumns, policyActionColumn } from '../columns'
import { BACKUP_TYPE_MAP, POLICY_EDITABLE_FIELDS, POLICY_ROW_KEY } from '../constants'
import PolicyFormModal from './PolicyFormModal.vue'

defineOptions({ name: 'BackupPolicyDrawer' })

const open = defineModel<boolean>('open', { default: false })

const [tableRegister, tableMethods] = useTable()
const policyModalRef = ref<InstanceType<typeof PolicyFormModal> | null>(null)
const togglingIds = ref<Set<string>>(new Set())

/** 抽屉打开时重新加载列表 */
async function fetchApi() {
  const list = await listPolicies()
  return { list, total: list.length }
}

/* ============================================================
 * 新增 / 编辑 / 删除
 * ============================================================ */

function handleAdd(): void {
  policyModalRef.value?.open()
}

function handleEdit(record: BackupPolicy): void {
  policyModalRef.value?.open(record)
}

async function handleDelete(record: BackupPolicy): Promise<void> {
  if (!record.policyId) return
  await deletePolicy(record.policyId)
  message.success('已删除')
  tableMethods.value?.reload()
}

const actionCtx = {
  onEdit: handleEdit,
  onDelete: handleDelete,
}

/* ============================================================
 * 启用 / 禁用
 * ============================================================ */

async function handleToggleEnabled(record: BackupPolicy, enabled: boolean): Promise<void> {
  if (!record.policyId || togglingIds.value.has(record.policyId)) return

  togglingIds.value.add(record.policyId)
  try {
    await savePolicy({
      ...pick(record, POLICY_EDITABLE_FIELDS),
      enabled: enabled ? 1 : 0,
    })
    message.success(enabled ? '已启用' : '已禁用')
    tableMethods.value?.reload()
  } finally {
    togglingIds.value.delete(record.policyId)
  }
}

function handleSuccess(): void {
  tableMethods.value?.reload()
}

/* ============================================================
 * 样式
 * ============================================================ */

const drawerTitle = computed(() => '备份策略管理')
</script>

<template>
  <a-drawer v-model:open="open" :title="drawerTitle" :width="900" :body-style="{ padding: '16px' }" destroy-on-close>
    <div class="space-y-4">
      <div class="flex justify-end"></div>

      <BasicTable
        :columns="policyColumns"
        :api="fetchApi"
        :immediate="true"
        :action-column="policyActionColumn"
        :row-key="POLICY_ROW_KEY"
        :pagination="false"
        :scroll="{ x: 700 }"
        size="small"
        :show-table-setting="false"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button type="primary" @click="handleAdd"> 新增策略 </a-button>
        </template>
        <template #cell-backup_type="{ record }">
          <a-tag>{{ BACKUP_TYPE_MAP[record.backupType] ?? record.backupType }}</a-tag>
        </template>

        <template #cell-enabled="{ record }">
          <a-switch
            :checked="record.enabled === 1"
            :loading="togglingIds.has(record.policyId)"
            size="small"
            @change="(v: boolean) => handleToggleEnabled(record as BackupPolicy, v)"
          />
        </template>

        <template #action="{ record }">
          <TableAction :actions="getPolicyActions(record as BackupPolicy, actionCtx)" />
        </template>
      </BasicTable>
    </div>

    <PolicyFormModal ref="policyModalRef" @success="handleSuccess" />
  </a-drawer>
</template>

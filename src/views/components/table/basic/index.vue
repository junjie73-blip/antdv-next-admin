<script setup lang="ts">
import type { BasicColumn } from '@/components/business/Table'

import { ref } from 'vue'
import { BasicTable, useTable } from '@/components/business/Table'
import { cn } from '@/utils/cn'

const containerClassName = cn('space-y-6')
const toolbarClassName = cn('mb-4', 'flex', 'justify-between', 'items-center')
const descriptionClassName = cn('text-sm', 'text-gray-500')
const monoClassName = cn('font-mono')
const labelClassName = cn('text-sm', 'text-gray-500', 'mb-2')
const fullWidthStyle = { width: '100%' }

const statusColorMap: Record<string, string> = {
  active: 'green',
  leave: 'blue',
  resigned: 'default',
}

const orderStatusColorMap: Record<string, string> = {
  completed: 'green',
  processing: 'blue',
  pending: 'orange',
  cancelled: 'red',
}

const typeColorMap: Record<string, string> = {
  company: 'purple',
  department: 'blue',
  team: 'green',
}

const basicData = [
  { key: 1, name: 'Zhang San', age: 28, department: 'Engineering', status: 'active', email: 'zhangsan@example.com', salary: 18000 },
  { key: 2, name: 'Li Si', age: 32, department: 'Product', status: 'active', email: 'lisi@example.com', salary: 22000 },
  { key: 3, name: 'Wang Wu', age: 24, department: 'Design', status: 'leave', email: 'wangwu@example.com', salary: 15000 },
  { key: 4, name: 'Zhao Liu', age: 35, department: 'Marketing', status: 'active', email: 'zhaoliu@example.com', salary: 25000 },
  { key: 5, name: 'Qian Qi', age: 29, department: 'Engineering', status: 'resigned', email: 'qianqi@example.com', salary: 20000 },
  { key: 6, name: 'Sun Ba', age: 31, department: 'Operations', status: 'active', email: 'sunba@example.com', salary: 17000 },
  { key: 7, name: 'Zhou Jiu', age: 27, department: 'Engineering', status: 'active', email: 'zhoujiu@example.com', salary: 19000 },
  { key: 8, name: 'Wu Shi', age: 33, department: 'Product', status: 'leave', email: 'wushi@example.com', salary: 21000 },
]

const basicColumns: BasicColumn[] = [
  { title: 'Name', dataIndex: 'name', key: 'name', sorter: true, width: 120 },
  { title: 'Age', dataIndex: 'age', key: 'age', sorter: true, width: 80, align: 'center' },
  {
    title: 'Department',
    dataIndex: 'department',
    key: 'department',
    filters: [
      { text: 'Engineering', value: 'Engineering' },
      { text: 'Product', value: 'Product' },
      { text: 'Design', value: 'Design' },
      { text: 'Marketing', value: 'Marketing' },
      { text: 'Operations', value: 'Operations' },
    ],
    onFilter: (value, record) => record.department === value,
  },
  { title: 'Status', dataIndex: 'status', key: 'status', width: 100, align: 'center' },
  { title: 'Email', dataIndex: 'email', key: 'email', ellipsis: true },
  { title: 'Salary', dataIndex: 'salary', key: 'salary', sorter: (a: any, b: any) => a.salary - b.salary, width: 120, align: 'right' },
]

const basicSelectedKeys = ref<(string | number)[]>([])

const [registerBasic, basicTableRef] = useTable({
  columns: basicColumns,
  dataSource: basicData,
  rowSelection: {
    onChange: (keys) => { basicSelectedKeys.value = keys },
  },
  bordered: true,
  rowKey: 'key',
  size: 'middle',
})

function handleBasicRefresh() {
  basicTableRef.value?.setLoading(true)
  setTimeout(() => {
    basicTableRef.value?.setLoading(false)
    message.success('Refreshed')
  }, 1500)
}

function handleBulkAction() {
  const rows = basicTableRef.value?.getSelectRows() || []
  message.info(`Selected ${rows.length} records`)
}

const paginationData = [
  { key: 1, id: 'ORD-001', customer: 'Client A', amount: 2999, status: 'completed', date: '2024-01-15' },
  { key: 2, id: 'ORD-002', customer: 'Client B', amount: 5800, status: 'processing', date: '2024-01-16' },
  { key: 3, id: 'ORD-003', customer: 'Client C', amount: 1200, status: 'completed', date: '2024-01-16' },
  { key: 4, id: 'ORD-004', customer: 'Client D', amount: 4500, status: 'pending', date: '2024-01-17' },
  { key: 5, id: 'ORD-005', customer: 'Client E', amount: 3200, status: 'completed', date: '2024-01-17' },
  { key: 6, id: 'ORD-006', customer: 'Client F', amount: 6800, status: 'processing', date: '2024-01-18' },
  { key: 7, id: 'ORD-007', customer: 'Client G', amount: 1500, status: 'cancelled', date: '2024-01-18' },
  { key: 8, id: 'ORD-008', customer: 'Client H', amount: 8900, status: 'completed', date: '2024-01-19' },
]

const paginationColumns: BasicColumn[] = [
  { title: 'Order ID', dataIndex: 'id', key: 'id', width: 120 },
  { title: 'Customer', dataIndex: 'customer', key: 'customer' },
  { title: 'Amount', dataIndex: 'amount', key: 'amount', width: 120, align: 'right' },
  { title: 'Status', dataIndex: 'status', key: 'status', width: 120, align: 'center' },
  { title: 'Date', dataIndex: 'date', key: 'date', width: 130 },
]

function paginationMockApi(params: { page?: number, pageSize?: number }) {
  const { page = 1, pageSize = 3 } = params
  const start = (page - 1) * pageSize
  const end = start + pageSize
  return Promise.resolve({
    items: paginationData.slice(start, end),
    total: paginationData.length,
  })
}

const [registerPagination] = useTable({
  columns: paginationColumns,
  api: paginationMockApi,
  pagination: {
    pageSize: 3,
    showSizeChanger: true,
    showTotal: (total: number) => `Total ${total} records`,
  },
  rowKey: 'key',
})

const treeData = [
  {
    key: 1,
    name: 'HQ',
    type: 'company',
    children: [
      {
        key: 11,
        name: 'Engineering Dept',
        type: 'department',
        children: [
          { key: 111, name: 'Frontend Team', type: 'team', memberCount: 12 },
          { key: 112, name: 'Backend Team', type: 'team', memberCount: 8 },
        ],
      },
      {
        key: 12,
        name: 'Product Dept',
        type: 'department',
        children: [
          { key: 121, name: 'PM Team', type: 'team', memberCount: 5 },
        ],
      },
    ],
  },
]

const treeColumns: BasicColumn[] = [
  { title: 'Name', dataIndex: 'name', key: 'name' },
  { title: 'Type', dataIndex: 'type', key: 'type', width: 120, align: 'center' },
  { title: 'Members', dataIndex: 'memberCount', key: 'memberCount', width: 100, align: 'center' },
]

const [registerTree] = useTable({
  columns: treeColumns,
  dataSource: treeData,
  defaultExpandAllRows: true,
  rowKey: 'key',
})

const [registerEmpty] = useTable({
  columns: basicColumns,
  dataSource: [],
  rowKey: 'key',
})

const [registerLoading] = useTable({
  columns: basicColumns,
  dataSource: [],
  loading: true,
  rowKey: 'key',
})
</script>

<template>
  <div :class="containerClassName">
    <a-card
      title="Basic Table"
      variant="borderless"
    >
      <div :class="toolbarClassName">
        <span :class="descriptionClassName">Sorting, filtering, loading, and selection support</span>
        <a-space>
          <a-button
            type="primary"
            size="small"
            @click="handleBasicRefresh"
          >
            Refresh
          </a-button>
          <a-button
            size="small"
            :disabled="basicSelectedKeys.length === 0"
            @click="handleBulkAction"
          >
            Bulk Action
          </a-button>
        </a-space>
      </div>
      <BasicTable @register="registerBasic">
        <template #cell-status="{ record }">
          <a-tag :color="statusColorMap[record?.status] || 'default'">
            {{ record?.status }}
          </a-tag>
        </template>
        <template #cell-salary="{ record }">
          <span :class="monoClassName">¥{{ record?.salary?.toLocaleString() ?? '-' }}</span>
        </template>
      </BasicTable>
    </a-card>

    <a-card
      title="Pagination"
      variant="borderless"
    >
      <BasicTable @register="registerPagination">
        <template #cell-status="{ record }">
          <a-tag :color="orderStatusColorMap[record?.status] || 'default'">
            {{ record?.status }}
          </a-tag>
        </template>
        <template #cell-amount="{ record }">
          <span :class="monoClassName">¥{{ record?.amount?.toLocaleString() ?? '-' }}</span>
        </template>
      </BasicTable>
    </a-card>

    <a-card
      title="Expandable / Tree Data"
      variant="borderless"
    >
      <BasicTable @register="registerTree">
        <template #cell-type="{ record }">
          <a-tag :color="typeColorMap[record?.type] || 'default'">
            {{ record?.type }}
          </a-tag>
        </template>
        <template #cell-memberCount="{ record }">
          <span>{{ record?.memberCount ?? '-' }}</span>
        </template>
      </BasicTable>
    </a-card>

    <a-card
      title="Empty &amp; Loading States"
      variant="borderless"
    >
      <a-space
        direction="vertical"
        :size="16"
        :style="fullWidthStyle"
      >
        <div>
          <p :class="labelClassName">
            Loading state
          </p>
          <BasicTable @register="registerLoading" />
        </div>
        <div>
          <p :class="labelClassName">
            Empty state
          </p>
          <BasicTable @register="registerEmpty" />
        </div>
      </a-space>
    </a-card>
  </div>
</template>

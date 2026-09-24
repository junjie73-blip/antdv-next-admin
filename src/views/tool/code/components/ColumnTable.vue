<script setup lang="ts">
import { Button, Space } from 'antdv-next'
import { computed } from 'vue'

import type { GenTableColumn } from '../types'

import { HTML_TYPE_OPTIONS, PG_TYPE_OPTIONS, QUERY_TYPE_OPTIONS, TS_TYPE_OPTIONS } from '../constants'

defineOptions({ name: 'GeneratorColumnTable' })

const columns = defineModel<GenTableColumn[]>('columns', { required: true })

const tableColumns = computed(() => [
  { title: '字段名', dataIndex: 'columnName', width: 160, fixed: 'left' as const },
  { title: '字段描述', dataIndex: 'columnComment', width: 140 },
  { title: '物理类型', dataIndex: 'columnType', width: 120 },
  { title: '长度', dataIndex: 'length', width: 90 },
  { title: 'TS类型', dataIndex: 'tsType', width: 110 },
  { title: '属性名', dataIndex: 'fieldName', width: 140 },
  { title: '主键', dataIndex: 'isPk', width: 60 },
  { title: '必填', dataIndex: 'isRequired', width: 60 },
  { title: '新增', dataIndex: 'isInsert', width: 60 },
  { title: '编辑', dataIndex: 'isEdit', width: 60 },
  { title: '列表', dataIndex: 'isList', width: 60 },
  { title: '查询', dataIndex: 'isQuery', width: 60 },
  { title: '查询方式', dataIndex: 'queryType', width: 120 },
  { title: '表单控件', dataIndex: 'htmlType', width: 120 },
  { title: '字典', dataIndex: 'dictType', width: 140 },
  { title: '操作', key: 'action', width: 120, fixed: 'right' as const },
])

function addRow() {
  columns.value.push({
    columnName: '',
    columnComment: '',
    columnType: 'varchar',
    length: 64,
    tsType: 'string',
    fieldName: '',
    isPk: '0',
    isIncrement: '0',
    isRequired: '0',
    isInsert: '1',
    isEdit: '1',
    isList: '1',
    isQuery: '0',
    isSort: '0',
    queryType: 'EQ',
    htmlType: 'input',
    dictType: null,
  })
}

function removeRow(index: number) {
  columns.value.splice(index, 1)
}

function moveUp(index: number) {
  if (index === 0) return
  const arr = columns.value
  ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
}
function filterColumnType(input: string, option: { label: string; value: string }) {
  return option.value.toLowerCase().includes(input.toLowerCase())
}
</script>

<template>
  <div>
    <div class="mb-2 flex items-center justify-between">
      <span class="text-sm text-gray-500 dark:text-gray-400"> 字段配置（可添加 / 删除 / 上下移动） </span>
      <Button size="small" @click="addRow">添加字段</Button>
    </div>

    <a-table
      :data-source="columns"
      :columns="tableColumns"
      :pagination="false"
      size="small"
      :scroll="{ x: 1700, y: 'calc(100vh - 360px)' }"
      row-key="columnName"
    >
      <template #bodyCell="{ column, record, index }">
        <!-- 字段名 -->
        <template v-if="column.dataIndex === 'columnName'">
          <a-input v-model:value="record.columnName" size="small" placeholder="user_name" />
        </template>

        <!-- 字段描述 -->
        <template v-else-if="column.dataIndex === 'columnComment'">
          <a-input v-model:value="record.columnComment" size="small" placeholder="用户名" />
        </template>

        <template v-else-if="column.dataIndex === 'columnType'">
          <a-select
            v-model:value="record.columnType"
            size="small"
            :options="PG_TYPE_OPTIONS"
            :show-search="true"
            :filter-option="filterColumnType"
            class="w-full"
            placeholder="varchar(64)"
            allow-clear
            :dropdown-style="{ minWidth: '200px' }"
          />
        </template>

        <!-- TS 类型 -->
        <template v-else-if="column.dataIndex === 'tsType'">
          <a-select v-model:value="record.tsType" size="small" :options="[...TS_TYPE_OPTIONS]" class="w-full" />
        </template>

        <!-- 属性名 -->
        <template v-else-if="column.dataIndex === 'fieldName'">
          <a-input v-model:value="record.fieldName" size="small" placeholder="userName" />
        </template>

        <!-- 开关类字段 -->
        <template
          v-else-if="['isPk', 'isRequired', 'isInsert', 'isEdit', 'isList', 'isQuery'].includes(column.dataIndex)"
        >
          <a-switch v-model:checked="record[column.dataIndex]" size="small" checked-value="1" un-checked-value="0" />
        </template>

        <!-- 查询方式 -->
        <template v-else-if="column.dataIndex === 'queryType'">
          <a-select
            v-model:value="record.queryType"
            size="small"
            :options="QUERY_TYPE_OPTIONS"
            :disabled="record.isQuery !== '1'"
            class="w-full"
          />
        </template>

        <!-- 表单控件 -->
        <template v-else-if="column.dataIndex === 'htmlType'">
          <a-select v-model:value="record.htmlType" size="small" :options="HTML_TYPE_OPTIONS" class="w-full" />
        </template>

        <!-- 字典 -->
        <template v-else-if="column.dataIndex === 'dictType'">
          <a-input v-model:value="record.dictType" size="small" placeholder="sys_status" />
        </template>

        <!-- 操作 -->
        <template v-else-if="column.key === 'action'">
          <Space size="small">
            <a-button type="link" size="small" :disabled="index === 0" @click="moveUp(index)"> 上移 </a-button>
            <a-button type="link" size="small" danger @click="removeRow(index)"> 删除 </a-button>
          </Space>
        </template>
      </template>
    </a-table>
  </div>
</template>

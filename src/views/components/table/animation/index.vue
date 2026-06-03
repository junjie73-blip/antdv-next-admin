<script setup lang="ts">
import type { BasicColumn } from '@/components/business/Table'
import { ref } from 'vue'
import { BasicTable, useTable } from '@/components/business/Table'
import { cn } from '@/utils/cn'

const containerClassName = cn('space-y-6')
const toolbarClassName = cn('mt-4', 'flex', 'gap-2')
const infoClassName = cn('mb-4')
const skeletonContentClassName = cn('p-4', 'bg-gray-50', 'rounded')

const tableData = ref([
  { id: 1, name: '张三', age: 28, department: '技术部', status: '在职', email: 'zhangsan@example.com' },
  { id: 2, name: '李四', age: 32, department: '产品部', status: '在职', email: 'lisi@example.com' },
  { id: 3, name: '王五', age: 24, department: '设计部', status: '休假', email: 'wangwu@example.com' },
  { id: 4, name: '赵六', age: 35, department: '市场部', status: '在职', email: 'zhaoliu@example.com' },
  { id: 5, name: '钱七', age: 29, department: '技术部', status: '离职', email: 'qianqi@example.com' },
])

const animationColumns: BasicColumn[] = [
  { title: '姓名', dataIndex: 'name', key: 'name' },
  { title: '年龄', dataIndex: 'age', key: 'age' },
  { title: '部门', dataIndex: 'department', key: 'department' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '邮箱', dataIndex: 'email', key: 'email' },
]

const loading = ref(false)

const [registerBasic, basicTableRef] = useTable({
  columns: animationColumns,
  dataSource: tableData.value,
  loading: false,
  rowKey: 'id',
})

const [registerAnimated] = useTable({
  columns: animationColumns,
  dataSource: tableData.value,
  rowKey: 'id',
})

function handleRefresh() {
  basicTableRef.value?.setLoading(true)
  setTimeout(() => {
    basicTableRef.value?.setLoading(false)
  }, 2000)
}
</script>

<template>
  <div :class="containerClassName">
    <a-card title="基础表格">
      <BasicTable @register="registerBasic">
        <template #cell-status="{ record }">
          <a-tag :color="record?.status === '在职' ? 'green' : record?.status === '休假' ? 'blue' : 'default'">
            {{ record?.status }}
          </a-tag>
        </template>
      </BasicTable>

      <div :class="toolbarClassName">
        <a-button
          type="primary"
          @click="handleRefresh"
        >
          刷新数据
        </a-button>
      </div>
    </a-card>

    <a-card title="骨架屏加载动画">
      <a-alert
        message="点击下方按钮查看加载状态"
        type="info"
        show-icon
        :class="infoClassName"
      />

      <a-skeleton
        :loading="loading"
        active
        :paragraph="{ rows: 5 }"
      >
        <div :class="skeletonContentClassName">
          <p>这是表格的实际内容，当 loading 为 true 时会显示骨架屏</p>
        </div>
      </a-skeleton>

      <div :class="toolbarClassName">
        <a-button
          :type="loading ? 'default' : 'primary'"
          @click="loading = !loading"
        >
          {{ loading ? '停止加载' : '开始加载' }}
        </a-button>
      </div>
    </a-card>

    <a-card title="行动画效果">
      <a-alert
        message="添加/删除行时会有平滑的过渡动画效果"
        type="success"
        show-icon
        :class="infoClassName"
      />

      <BasicTable @register="registerAnimated" />
    </a-card>
  </div>
</template>

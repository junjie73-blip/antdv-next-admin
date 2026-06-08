<script setup lang="ts">
import type { BasicColumn } from '@/components/business/Table/types'
import type { TreeDataNode } from '@/components/business/TreeTable'

import { ref } from 'vue'
import { TreeTable } from '@/components/business/TreeTable'
import { cn } from '@/utils/cn'

const containerClassName = cn('h-full flex flex-col')
const pageHeaderClassName = cn('text-lg font-bold text-gray-800 dark:text-white flex-shrink-0')
const cardClassName = cn('flex-1 min-h-0')

const orgTree: TreeDataNode[] = [
  {
    key: 'dept-1',
    title: '总公司',
    children: [
      {
        key: 'dept-1-1',
        title: '技术部',
        children: [
          { key: 'dept-1-1-1', title: '前端开发组' },
          { key: 'dept-1-1-2', title: '后端开发组' },
          { key: 'dept-1-1-3', title: '测试组' },
        ],
      },
      {
        key: 'dept-1-2',
        title: '产品部',
        children: [
          { key: 'dept-1-2-1', title: '产品设计组' },
          { key: 'dept-1-2-2', title: '用户研究组' },
        ],
      },
      {
        key: 'dept-1-3',
        title: '市场部',
        children: [
          { key: 'dept-1-3-1', title: '品牌推广组' },
          { key: 'dept-1-3-2', title: '渠道运营组' },
        ],
      },
      { key: 'dept-1-4', title: '财务部' },
      { key: 'dept-1-5', title: '人事部' },
    ],
  },
]

const mockEmployees: Record<string, Array<Record<string, any>>> = {
  'dept-1-1-1': [
    { id: 1, name: '张三', position: '前端开发工程师', email: 'zhangsan@example.com', status: '在职', joinDate: '2023-01-15' },
    { id: 2, name: '李四', position: '高级前端工程师', email: 'lisi@example.com', status: '在职', joinDate: '2022-06-01' },
    { id: 3, name: '王五', position: '前端实习生', email: 'wangwu@example.com', status: '试用', joinDate: '2025-03-10' },
  ],
  'dept-1-1-2': [
    { id: 4, name: '赵六', position: '后端架构师', email: 'zhaoliu@example.com', status: '在职', joinDate: '2021-08-20' },
    { id: 5, name: '孙七', position: 'Java开发工程师', email: 'sunqi@example.com', status: '在职', joinDate: '2023-04-12' },
    { id: 6, name: '周八', position: 'Go开发工程师', email: 'zhouba@example.com', status: '离职', joinDate: '2022-11-30' },
  ],
  'dept-1-1-3': [
    { id: 7, name: '吴九', position: '测试主管', email: 'wujiu@example.com', status: '在职', joinDate: '2021-03-15' },
    { id: 8, name: '郑十', position: '自动化测试工程师', email: 'zhengshi@example.com', status: '在职', joinDate: '2023-09-01' },
  ],
  'dept-1-2-1': [
    { id: 9, name: '冯十一', position: 'UI设计师', email: 'fengshiyi@example.com', status: '在职', joinDate: '2024-01-10' },
    { id: 10, name: '陈十二', position: '交互设计师', email: 'chenshier@example.com', status: '在职', joinDate: '2023-07-20' },
  ],
  'dept-1-2-2': [
    { id: 11, name: '褚十三', position: '用户研究员', email: 'chushisan@example.com', status: '在职', joinDate: '2024-05-15' },
  ],
  'dept-1-3-1': [
    { id: 12, name: '卫十四', position: '品牌经理', email: 'weishisi@example.com', status: '在职', joinDate: '2022-02-28' },
  ],
  'dept-1-3-2': [
    { id: 13, name: '蒋十五', position: '渠道运营专员', email: 'jiangshiwu@example.com', status: '在职', joinDate: '2024-08-16' },
  ],
  'dept-1-4': [
    { id: 14, name: '沈十六', position: '财务主管', email: 'shenshiliu@example.com', status: '在职', joinDate: '2021-06-10' },
    { id: 15, name: '韩十七', position: '会计', email: 'hanshiqi@example.com', status: '在职', joinDate: '2023-10-25' },
  ],
  'dept-1-5': [
    { id: 16, name: '杨十八', position: 'HR经理', email: 'yangshiba@example.com', status: '在职', joinDate: '2022-04-05' },
    { id: 17, name: '朱十九', position: '招聘专员', email: 'zhushijiu@example.com', status: '在职', joinDate: '2024-02-14' },
  ],
  'dept-1-1': [],
  'dept-1-2': [],
  'dept-1-3': [],
  'dept-1': [],
}

const columns: BasicColumn[] = [
  { title: '姓名', dataIndex: 'name', key: 'name', width: 120 },
  { title: '职位', dataIndex: 'position', key: 'position', width: 160 },
  { title: '邮箱', dataIndex: 'email', key: 'email', width: 220 },
  { title: '入职日期', dataIndex: 'joinDate', key: 'joinDate', width: 120 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
]

const currentDept = ref('')

async function fetchTableData(params: { treeKey: string, page: number, pageSize: number }) {
  currentDept.value = params.treeKey

  await new Promise(resolve => setTimeout(resolve, 300))

  const allData = mockEmployees[params.treeKey] || []
  const start = (params.page - 1) * params.pageSize
  const end = start + params.pageSize
  const list = allData.slice(start, end)

  return {
    list,
    total: allData.length,
  }
}

function handleTreeSelect(key: string, node: TreeDataNode) {
  message.info(`已选择: ${node.title}`)
}
</script>

<template>
  <div :class="containerClassName">
    <div :class="pageHeaderClassName">
      TreeTable 树表格组件
    </div>

    <a-card
      variant="borderless"
      title="组织架构 - 员工管理"
      class="rounded-xl"
      :class="cardClassName"
    >
      <TreeTable
        tree-title="组织架构"
        :tree-data="orgTree"
        table-title="员工列表"
        :table-columns="columns"
        :table-api="fetchTableData"
        table-row-key="id"
        :tree-width="280"
        @treeSelect="handleTreeSelect"
      />
    </a-card>
  </div>
</template>

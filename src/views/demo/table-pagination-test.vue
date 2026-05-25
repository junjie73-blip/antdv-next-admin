<script setup lang="ts">
import type { BasicColumn } from '@/components/business/Table'
import { Alert, Button, Card, Space } from 'antdv-next'
import { ref } from 'vue'
import { BasicTable, useTable } from '@/components/business/Table'

/**
 * 表格分页测试页面
 * 用于测试分页数量与表格数据同步问题
 */

// 模拟数据生成
function generateData(page: number, pageSize: number, total: number) {
  const start = (page - 1) * pageSize
  const end = Math.min(start + pageSize, total)
  const data = []

  for (let i = start; i < end; i++) {
    data.push({
      id: `${i + 1}`,
      name: `用户 ${i + 1}`,
      age: 20 + (i % 50),
      email: `user${i + 1}@example.com`,
      address: `地址 ${i + 1}`,
    })
  }

  return data
}

// 列配置
const columns: BasicColumn[] = [
  {
    title: 'ID',
    dataIndex: 'id',
    key: 'id',
    width: 80,
  },
  {
    title: '姓名',
    dataIndex: 'name',
    key: 'name',
    width: 120,
  },
  {
    title: '年龄',
    dataIndex: 'age',
    key: 'age',
    width: 80,
  },
  {
    title: '邮箱',
    dataIndex: 'email',
    key: 'email',
    width: 200,
  },
  {
    title: '地址',
    dataIndex: 'address',
    key: 'address',
  },
]

// 当前测试场景
const currentTest = ref('')
const testResult = ref('')

// 模拟 API 请求
function mockApi(params: any) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const { page = 1, pageSize = 10 } = params
      const total = 100 // 模拟总数据量
      const data = generateData(page, pageSize, total)

      console.log('[Mock API] 请求参数:', params)
      console.log('[Mock API] 返回数据条数:', data.length)
      console.log('[Mock API] 当前页数据:', data.map(d => d.id).join(', '))

      resolve({
        items: data,
        total,
        page,
        pageSize,
      })
    }, 500)
  })
}

// 使用 useTable
const [registerTable, { reload, setPagination, getPaginationRef }] = useTable({
  title: '分页测试表格',
  columns,
  api: mockApi,
  pagination: {
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number) => `共 ${total} 条`,
  },
  rowKey: 'id',
})

// 测试场景 1：正常分页
async function testNormalPagination() {
  currentTest.value = '正常分页测试'
  testResult.value = '正在测试...'
  console.log('=== 测试场景 1：正常分页 ===')

  await reload()

  const pagination = getPaginationRef()
  testResult.value = `当前页: ${pagination?.current}, 每页条数: ${pagination?.pageSize}, 总条数: ${pagination?.total}`
  console.log('分页信息:', pagination)
}

// 测试场景 2：切换每页条数
async function testChangePageSize() {
  currentTest.value = '切换每页条数测试'
  testResult.value = '正在测试...'
  console.log('=== 测试场景 2：切换每页条数 ===')

  // 先切换到第 2 页
  setPagination({ current: 2, pageSize: 20 })
  await reload()

  const pagination = getPaginationRef()
  testResult.value = `切换后 - 当前页: ${pagination?.current}, 每页条数: ${pagination?.pageSize}, 总条数: ${pagination?.total}`
  console.log('分页信息:', pagination)
}

// 测试场景 3：快速切换页码
async function testQuickPageChange() {
  currentTest.value = '快速切换页码测试'
  testResult.value = '正在测试...'
  console.log('=== 测试场景 3：快速切换页码 ===')

  // 快速切换到第 5 页
  setPagination({ current: 5 })
  await reload()

  const pagination = getPaginationRef()
  testResult.value = `快速切换后 - 当前页: ${pagination?.current}, 每页条数: ${pagination?.pageSize}`
  console.log('分页信息:', pagination)
}

// 测试场景 4：数据量变化（模拟总数据变化）
let mockTotal = 100
async function testDataChange() {
  currentTest.value = '数据量变化测试'
  testResult.value = '正在测试...'
  console.log('=== 测试场景 4：数据量变化 ===')

  // 模拟数据量变化
  mockTotal = mockTotal === 100 ? 50 : 100

  await reload()

  const pagination = getPaginationRef()
  testResult.value = `数据量变化后 - 总条数: ${pagination?.total}, 当前页: ${pagination?.current}`
  console.log('分页信息:', pagination)
}

// 测试场景 5：分页器尺寸测试
function testPaginationSize() {
  currentTest.value = '分页器尺寸测试'
  console.log('=== 测试场景 5：分页器尺寸 ===')
  console.log('检查分页器是否使用 middle 尺寸，而不是被 ConfigProvider 覆盖为 small')
  testResult.value = '请检查分页器的 class，应该包含 ant-pagination-middle，而不是 ant-pagination-small'
}
</script>

<template>
  <div class="p-6">
    <Card title="表格分页测试">
      <Alert
        v-if="currentTest"
        :message="`当前测试: ${currentTest}`"
        :description="testResult"
        type="info"
        show-icon
        class="mb-4"
      />

      <Space class="mb-4">
        <Button
          type="primary"
          @click="testNormalPagination"
        >
          测试正常分页
        </Button>
        <Button @click="testChangePageSize">
          测试切换每页条数
        </Button>
        <Button @click="testQuickPageChange">
          测试快速切换页码
        </Button>
        <Button @click="testDataChange">
          测试数据量变化
        </Button>
        <Button @click="testPaginationSize">
          测试分页器尺寸
        </Button>
      </Space>

      <BasicTable @register="registerTable" />
    </Card>
  </div>
</template>

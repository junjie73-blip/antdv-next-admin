<script setup lang="ts">
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@antdv-next/icons'
import { message } from 'antdv-next'
import { ref } from 'vue'

defineOptions({
  name: 'SystemRole',
})

const loading = ref(false)
const searchText = ref('')

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '角色名称', dataIndex: 'name', key: 'name' },
  { title: '角色编码', dataIndex: 'code', key: 'code' },
  { title: '描述', dataIndex: 'description', key: 'description' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 200, fixed: 'right' as const },
]

const dataSource = ref([
  { id: 1, name: '超级管理员', code: 'admin', description: '拥有所有权限', status: '启用', createdAt: '2024-01-01 10:00:00' },
  { id: 2, name: '普通用户', code: 'user', description: '普通用户权限', status: '启用', createdAt: '2024-01-02 11:00:00' },
  { id: 3, name: '访客', code: 'guest', description: '只读权限', status: '启用', createdAt: '2024-01-03 12:00:00' },
])

function handleAdd() {
  message.info('新增角色')
}

function handleEdit(record: any) {
  message.info(`编辑角色: ${record.name}`)
}

function handleDelete(record: any) {
  message.warning(`删除角色: ${record.name}`)
}

function handlePermission(record: any) {
  message.info(`配置权限: ${record.name}`)
}
</script>

<template>
  <div class="space-y-4">
    <a-card
      title="角色管理"
      class="shadow-sm"
    >
      <template #extra>
        <a-space>
          <a-input
            v-model:value="searchText"
            placeholder="搜索角色名称"
            allow-clear
          >
            <template #prefix>
              <SearchOutlined />
            </template>
          </a-input>
          <a-button
            type="primary"
            @click="handleAdd"
          >
            <template #icon>
              <PlusOutlined />
            </template>
            新增角色
          </a-button>
        </a-space>
      </template>

      <a-table
        :columns="columns"
        :data-source="dataSource"
        :loading="loading"
        :pagination="{ pageSize: 10 }"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === '启用' ? 'green' : 'red'">
              {{ record.status }}
            </a-tag>
          </template>
          <template v-if="column.key === 'action'">
            <a-space>
              <a-button
                type="link"
                size="small"
                @click="handleEdit(record)"
              >
                <template #icon>
                  <EditOutlined />
                </template>
                编辑
              </a-button>
              <a-button
                type="link"
                size="small"
                @click="handlePermission(record)"
              >
                权限
              </a-button>
              <a-popconfirm
                title="确定要删除此角色吗？"
                @confirm="handleDelete(record)"
              >
                <a-button
                  type="link"
                  size="small"
                  danger
                >
                  <template #icon>
                    <DeleteOutlined />
                  </template>
                  删除
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

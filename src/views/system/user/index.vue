<script setup lang="ts">
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@antdv-next/icons'
import { message } from 'antdv-next'
import { ref } from 'vue'

defineOptions({
  name: 'SystemUser',
})

const loading = ref(false)
const searchText = ref('')

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '用户名', dataIndex: 'username', key: 'username' },
  { title: '昵称', dataIndex: 'nickname', key: 'nickname' },
  { title: '邮箱', dataIndex: 'email', key: 'email' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 150, fixed: 'right' as const },
]

const dataSource = ref([
  { id: 1, username: 'admin', nickname: '管理员', email: 'admin@example.com', status: '启用', createdAt: '2024-01-01 10:00:00' },
  { id: 2, username: 'user1', nickname: '用户1', email: 'user1@example.com', status: '启用', createdAt: '2024-01-02 11:00:00' },
  { id: 3, username: 'user2', nickname: '用户2', email: 'user2@example.com', status: '禁用', createdAt: '2024-01-03 12:00:00' },
])

function handleAdd() {
  message.info('新增用户')
}

function handleEdit(record: any) {
  message.info(`编辑用户: ${record.username}`)
}

function handleDelete(record: any) {
  message.warning(`删除用户: ${record.username}`)
}

function handleSearch() {
  message.info(`搜索: ${searchText.value}`)
}
</script>

<template>
  <div class="space-y-4">
    <a-card
      title="用户管理"
      class="shadow-sm"
    >
      <template #extra>
        <a-space>
          <a-input
            v-model:value="searchText"
            placeholder="搜索用户名"
            allow-clear
            @pressEnter="handleSearch"
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
            新增用户
          </a-button>
        </a-space>
      </template>

      <a-table
        :columns="columns"
        :data-source="dataSource"
        :loading="loading"
        :pagination="{ pageSize: 10, showSizeChanger: true, showQuickJumper: true }"
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
              <a-popconfirm
                title="确定要删除此用户吗？"
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

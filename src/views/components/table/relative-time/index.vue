<script setup lang="ts">
import type { BasicColumn } from '@/components/business/Table'
import { ref } from 'vue'
import { BasicTable, useTable } from '@/components/business/Table'
import { cn } from '@/utils/cn'

const containerClassName = cn('space-y-6')

const timelineData = ref([
  { id: 1, title: '发布新文章', event: '发布新文章', time: '2024-01-15T10:30:00Z', author: '张三', category: '技术分享', status: 'published' },
  { id: 2, title: '代码审查完成', event: '代码审查完成', time: '2024-01-14T16:45:00Z', author: '李四', category: '开发工作', status: 'completed' },
  { id: 3, title: '项目启动会议', event: '项目启动会议', time: '2024-01-13T09:00:00Z', author: '王五', category: '项目管理', status: 'pending' },
  { id: 4, title: 'Bug 修复', event: 'Bug 修复', time: '2024-01-12T14:20:00Z', author: '赵六', category: '问题追踪', status: 'resolved' },
  { id: 5, title: '需求评审', event: '需求评审', time: '2024-01-11T11:15:00Z', author: '钱七', category: '产品规划', status: 'reviewing' },
])

function getDotClassName(status: string) {
  return cn(
    'w-3', 'h-3', 'rounded-full', 'mt-1.5',
    {
      'bg-green-500': status === 'published' || status === 'completed' || status === 'resolved',
      'bg-blue-500': status === 'pending' || status === 'reviewing',
    },
  )
}

const eventTitleClassName = cn('font-medium')
const eventTimeClassName = cn('text-gray-500', 'text-sm')

const tableColumns: BasicColumn[] = [
  { title: '事件', dataIndex: 'event', key: 'event' },
  { title: '作者', dataIndex: 'author', key: 'author', width: 80 },
  { title: '分类', dataIndex: 'category', key: 'category', width: 100 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '时间', dataIndex: 'time', key: 'time', width: 180 },
]

const statusColorMap: Record<string, string> = {
  published: 'success',
  completed: 'success',
  resolved: 'success',
  pending: 'processing',
  reviewing: 'warning',
}

const [registerRelative] = useTable({
  columns: tableColumns,
  dataSource: timelineData.value,
  rowKey: 'id',
})
</script>

<template>
  <div :class="containerClassName">
    <a-card title="基础用法">
      <a-timeline>
        <a-timeline-item v-for="item in timelineData" :key="item.id">
          <template #dot>
            <div :class="getDotClassName(item.status)" />
          </template>
          <p :class="eventTitleClassName">{{ item.event }}</p>
          <p :class="eventTimeClassName">{{ item.time }}</p>
        </a-timeline-item>
      </a-timeline>
    </a-card>

    <a-card title="自定义颜色和位置">
      <a-timeline mode="left">
        <a-timeline-item color="green">
          <p :class="eventTitleClassName">创建服务成功</p>
          <p :class="eventTimeClassName">2015-09-01</p>
        </a-timeline-item>
        <a-timeline-item color="green">
          <p :class="eventTitleClassName">通过审核</p>
          <p :class="eventTimeClassName">2015-09-01</p>
        </a-timeline-item>
        <a-timeline-item color="red">
          <p :class="eventTitleClassName">活动开始报名</p>
          <p :class="eventTimeClassName">2015-09-10</p>
        </a-timeline-item>
        <a-timeline-item>
          <p :class="eventTitleClassName">活动进行中</p>
          <p :class="eventTimeClassName">2015-09-15</p>
          <a-tag color="blue">进行中</a-tag>
        </a-timeline-item>
        <a-timeline-item color="gray">
          <p :class="eventTitleClassName">活动结束</p>
          <p :class="eventTimeClassName">2015-12-31</p>
        </a-timeline-item>
      </a-timeline>
    </a-card>

    <a-card title="表格中的相对时间">
      <BasicTable @register="registerRelative">
        <template #cell-status="{ record }">
          <a-tag :color="statusColorMap[record?.status] || 'default'">
            {{ record?.status }}
          </a-tag>
        </template>
        <template #cell-time="{ record }">
          <span>{{ record?.time ? new Date(record.time).toLocaleString('zh-CN') : '-' }}</span>
        </template>
      </BasicTable>
    </a-card>
  </div>
</template>
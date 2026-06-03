# 消息通知

消息通知模块是系统内部的消息中心，统一管理公告、通知、待办三大类消息。该模块提供未读提醒、分类筛选、批量标记已读、消息详情查看等功能，帮助用户高效处理各类系统消息。

## 功能概述

| 功能 | 说明 |
|------|------|
| **消息分类** | 支持公告/通知/待办三种消息类型，各有专属颜色标识 |
| **已读未读标记** | 未读消息带蓝色圆点提示，支持单条/批量标记已读 |
| **Tab 页签切换** | 5 个 Tab：全部/未读/公告/通知/待办 |
| **统计卡片** | 4 个可点击的统计卡片，点击跳转到对应分类 |
| **优先级标识** | 三级优先级：普通(蓝)/重要(橙)/紧急(红) |
| **自动标记已读** | 查看消息详情时自动标记为已读 |
| **批量操作** | 支持全部已读、单条删除等批量操作 |

## 5 个 Tab 页签

```vue
<a-tabs v-model:active-key="activeTabKey" @change="handleTabChange">
  <a-tab-pane key="all" tab="全部消息" />
  <a-tab-pane key="unread" tab="未读消息" />
  <a-tab-pane key="1" tab="系统公告" />
  <a-tab-pane key="2" tab="通知消息" />
  <a-tab-pane key="3" tab="待办提醒" />
</a-tabs>
```

**Tab 切换过滤逻辑：**

```typescript
const activeTabKey = ref<string>('all')  // 默认显示全部

// 计算属性：根据当前 Tab 动态过滤数据
const filteredData = computed(() => {
  switch (activeTabKey.value) {
    case 'all':
      return allData.value                    // 全部消息
    case 'unread':
      return allData.value.filter(n => n.status === 0)  // 未读消息
    default:
      // 数字类型对应消息类型（1=公告, 2=通知, 3=待办）
      const typeNum = Number(activeTabKey.value)
      return allData.value.filter(n => n.type === typeNum)
  }
})

// Tab 切换事件处理
function handleTabChange(key: string) {
  activeTabKey.value = key
  tableMethods.value?.reload()  // 重新加载表格数据
}
```

## 4 个统计卡片

顶部 4 个统计卡片，支持点击跳转到对应 Tab：

```vue
<div class="grid grid-cols-4 gap-4">
  <!-- 未读消息数量（可点击跳转） -->
  <a-card :class="cardClassName" size="small" hoverable @click="handleTabChange('unread')">
    <a-statistic title="未读消息" :value="unreadCount" suffix="条">
      <template #prefix>
        <Icon icon="carbon:notification-new" class="text-blue-500 text-lg mr-1" />
      </template>
    </a-statistic>
  </a-card>

  <!-- 系统公告数量 -->
  <a-card :class="cardClassName" size="small" hoverable @click="handleTabChange('1')">
    <a-statistic title="系统公告" :value="systemCount" suffix="条">
      <template #prefix>
        <Icon icon="carbon:megaphone" class="text-green-500 text-lg mr-1" />
      </template>
    </a-statistic>
  </a-card>

  <!-- 通知消息数量 -->
  <a-card :class="cardClassName" size="small" hoverable @click="handleTabChange('2')">
    <a-statistic title="通知消息" :value="noticeCount" suffix="条">
      <template #prefix>
        <Icon icon="carbon:email" class="text-orange-500 text-lg mr-1" />
      </template>
    </a-statistic>
  </a-card>

  <!-- 待办提醒数量 -->
  <a-card :class="cardClassName" size="small" hoverable @click="handleTabChange('3')">
    <a-statistic title="待办提醒" :value="todoCount" suffix="条">
      <template #prefix>
        <Icon icon="carbon:task" class="text-purple-500 text-lg mr-1" />
      </template>
    </a-statistic>
  </a-card>
</div>
```

**统计计算逻辑：**

```typescript
// 响应式计算各分类的数量
const unreadCount = computed(() => allData.value.filter(n => n.status === 0).length)
const systemCount = computed(() => allData.value.filter(n => n.type === 1).length)
const noticeCount = computed(() => allData.value.filter(n => n.type === 2).length)
const todoCount = computed(() => allData.value.filter(n => n.type === 3).length)
```

## 消息优先级

三级优先级体系，使用颜色和文字双重标识：

```typescript
const priorityMap: Record<number, { label: string; color: string }> = {
  0: { label: '普通', color: 'default' },   // 默认灰色
  1: { label: '重要', color: 'orange' },     // 橙色警告
  2: { label: '紧急', color: 'red' },        // 红色紧急
}
```

**优先级应用场景：**
- **普通 (0)**：一般性通知，如欢迎信息、备份完成通知
- **重要 (1)**：需要关注的消息，如安全提醒、API 调整通知
- **紧急 (2)**：需要立即处理的消息，如系统维护、服务器预警

## 消息类型映射

```typescript
const typeMap: Record<number, { label: string; color: string }> = {
  1: { label: '公告', color: 'blue' },    // 系统公告 - 蓝色
  2: { label: '通知', color: 'green' },    // 通知消息 - 绿色
  3: { label: '待办', color: 'orange' },   // 待办提醒 - 橙色
}
```

## 消息数据结构

### NoticeRecord 接口定义

```typescript
interface NoticeRecord {
  id: number          // 消息唯一标识
  title: string       // 消息标题
  content: string     // 消息正文内容（支持多行文本）
  type: number        // 消息类型：1=系统公告, 2=通知消息, 3=待办提醒
  status: number      // 阅读状态：0=未读, 1=已读
  priority: number    // 优先级：0=普通, 1=重要, 2=紧急
  sender: string      // 发送人/发送系统名称
  sendTime: string    // 发送时间（ISO 格式）
  readTime?: string   // 阅读时间（已读时有值）
}
```

### Mock 数据示例

```typescript
const mockNotices: NoticeRecord[] = [
  {
    id: 1,
    title: '系统升级维护通知',
    content: '尊敬的用户，系统将于2024年6月5日 00:00 - 06:00 进行版本升级维护...\n\n本次升级将带来以下新特性：\n1. 全新的UI界面设计\n2. 性能优化，响应速度提升50%\n3. 新增数据导出功能\n4. 安全漏洞修复',
    type: 1,           // 公告
    status: 0,          // 未读
    priority: 2,        // 紧急
    sender: '系统管理员',
    sendTime: '2024-06-03 08:00:00',
  },
  {
    id: 3,
    title: '您有新的审批任务待处理',
    content: '张三提交的「系统权限申请」等待您审批，请在24小时内完成处理。',
    type: 3,           // 待办
    status: 0,          // 未读
    priority: 1,        // 重要
    sender: '工作流系统',
    sendTime: '2024-06-03 09:15:22',
  },
  {
    id: 5,
    title: '服务器资源使用率预警',
    content: '检测到生产环境服务器CPU使用率已达到85%，内存使用率达到78%，建议及时扩容或优化应用性能。',
    type: 2,           // 通知
    status: 0,          // 未读
    priority: 2,        // 紧急
    sender: '监控系统',
    sendTime: '2024-06-03 11:45:10',
  },
  {
    id: 6,
    title: '数据库备份完成通知',
    content: '今日凌晨自动备份任务已完成，备份数据大小约2.3GB，备份文件已保存至异地灾备中心。',
    type: 2,           // 通知
    status: 1,          // 已读
    priority: 0,        // 普通
    sender: '运维平台',
    sendTime: '2024-06-03 06:00:05',
    readTime: '2024-06-03 08:30:12',  // 已记录阅读时间
  },
  // ... 更多消息
]
```

## 表格列配置

```typescript
const columns: BasicColumn[] = [
  {
    title: '标题',
    dataIndex: 'title',
    key: 'title',
    width: 220,
    ellipsis: true,
    customRender: ({ record }: any) => (
      <div class="flex items-center gap-2">
        {/* 未读消息蓝色圆点 */}
        {record.status === 0 && (
          <span class="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
        )}
        {/* 紧急消息红色加粗 */}
        <span class={
          record.priority === 2
            ? 'font-medium text-red-600 dark:text-red-400'
            : ''
        }>
          {record.title}
        </span>
      </div>
    ),
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: 80,
    align: 'center',
    customRender: ({ record }: any) => (
      <a-tag color={typeMap[record.type]?.color || 'default'}>
        {typeMap[record.type]?.label || '未知'}
      </a-tag>
    ),
  },
  {
    title: '优先级',
    dataIndex: 'priority',
    key: 'priority',
    width: 80,
    align: 'center',
    customRender: ({ record }: any) => (
      <a-tag color={priorityMap[record.priority]?.color || 'default'}>
        {priorityMap[record.priority]?.label || '普通'}
      </a-tag>
    ),
  },
  { title: '发送人', dataIndex: 'sender', key: 'sender', width: 120, ellipsis: true },
  {
    title: '发送时间',
    dataIndex: 'sendTime',
    key: 'sendTime',
    width: 170,
    customRender: ({ record }: any) => (
      <span>
        {record.sendTime} ({dayjs(record.sendTime).fromNow(true)}前)
      </span>
    ),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 80,
    align: 'center',
    customRender: ({ record }: any) => (
      <a-tag color={record.status === 0 ? 'blue' : 'default'}>
        <span class="inline-flex items-center gap-1">
          <Icon icon={
            record.status === 0
              ? 'carbon:new-filled'
              : 'carbon:checkmark'
          } />
          {record.status === 0 ? '未读' : '已读'}
        </span>
      </a-tag>
    ),
  },
]
```

## 操作列

```vue
<template #action="{ record }">
  <div class="flex items-center gap-1">
    <!-- 查看详情 -->
    <a-button type="link" class="!px-0.5" @click="() => handleView(record)">
      <template #icon><Icon icon="ant-design:eye-outlined" /></template>
      查看
    </a-button>

    <a-divider type="vertical" class="mx-0" />

    <!-- 标记已读（仅未读消息显示） -->
    <a-button
      v-if="record.status === 0"
      type="link"
      class="!px-0.5"
      @click="() => handleMarkRead(record)"
    >
      <template #icon><Icon icon="carbon:checkmark-outline" /></template>
      已读
    </a-button>

    <!-- 删除消息 -->
    <a-popconfirm
      :title="`确定要删除消息「${record.title}」吗？`"
      @confirm="() => handleDelete(record)"
    >
      <a-button type="link" danger class="!px-0.5">
        <template #icon><Icon icon="ant-design:delete-outlined" /></template>
        删除
      </a-button>
    </a-popconfirm>
  </div>
</template>
```

## 批量操作

### 全部标记已读

```typescript
function handleMarkAllRead() {
  const unreadItems = allData.value.filter(n => n.status === 0)

  if (unreadItems.length === 0) {
    message.info('没有未读消息')
    return
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
  unreadItems.forEach(item => {
    item.status = 1           // 标记为已读
    item.readTime = now       // 记录阅读时间
  })

  message.success(`已将 ${unreadItems.length} 条消息标记为已读`)
  tableMethods.value?.reload()
}
```

### 单条标记已读

```typescript
function handleMarkRead(record: NoticeRecord | any) {
  const rec = record as NoticeRecord
  rec.status = 1
  rec.readTime = dayjs().format('YYYY-MM-DD HH:mm:ss')
  message.success(`「${rec.title}」已标记为已读`)
  tableMethods.value?.reload()
}
```

### 查看详情（自动标记已读）

```typescript
function handleView(record: NoticeRecord | any) {
  viewingNotice.value = record as NoticeRecord
  showDetailDrawer.value = true

  // 自动标记已读逻辑
  if ((record as NoticeRecord).status === 0) {
    ;(record as NoticeRecord).status = 1
    ;(record as NoticeRecord).readTime = dayjs().format('YYYY-MM-DD HH:mm:ss')
  }
}
```

### 删除消息

```typescript
function handleDelete(record: NoticeRecord | any) {
  const rec = record as NoticeRecord
  const idx = allData.value.findIndex(i => i.id === rec.id)

  if (idx > -1) {
    allData.value.splice(idx, 1)
    message.success(`已删除消息「${rec.title}」`)
    tableMethods.value?.reload()
  }
}
```

## 消息详情抽屉

```vue
<a-drawer
  v-model:open="showDetailDrawer"
  :width="560"
  :title="viewingNotice?.title || '消息详情'"
  placement="right"
  :closable="true"
>
  <template v-if="viewingNotice">
    <div class="space-y-4">
      <!-- 头部标签区域 -->
      <div class="flex flex-wrap gap-2">
        <a-tag :color="typeMap[viewingNotice.type]?.color || 'default'">
          {{ typeMap[viewingNotice.type]?.label }}
        </a-tag>
        <a-tag :color="priorityMap[viewingNotice.priority]?.color || 'default'">
          {{ priorityMap[viewingNotice.priority]?.label }}
        </a-tag>
        <a-tag :color="viewingNotice.status === 0 ? 'blue' : 'default'">
          {{ viewingNotice.status === 0 ? '未读' : '已读' }}
        </a-tag>
      </div>

      <!-- 元信息描述列表 -->
      <a-descriptions :column="1" bordered size="small">
        <a-descriptions-item label="发送人">
          {{ viewingNotice.sender }}
        </a-descriptions-item>
        <a-descriptions-item label="发送时间">
          {{ viewingNotice.sendTime }}
        </a-descriptions-item>
        <a-descriptions-item v-if="viewingNotice.readTime" label="阅读时间">
          {{ viewingNotice.readTime }}
        </a-descriptions-item>
      </a-descriptions>

      <!-- 消息正文内容区域 -->
      <div class="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h4 class="font-medium mb-2">消息内容</h4>
        <div class="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed">
          {{ viewingNotice.content }}
        </div>
      </div>
    </div>
  </template>

  <!-- 底部操作按钮 -->
  <template #footer>
    <div class="flex justify-end gap-2">
      <a-button @click="showDetailDrawer = false">关闭</a-button>
      <a-button
        v-if="viewingNotice?.status === 0"
        type="primary"
        @click="handleMarkRead(viewingNotice); showDetailDrawer = false"
      >
        标记已读并关闭
      </a-button>
    </div>
  </template>
</a-drawer>
```

## Mock API 实现

```typescript
async function mockApi(params: Record<string, any>) {
  const { page = 1, pageSize = 10 } = params

  // 从计算属性获取过滤后的数据
  let data = [...filteredData.value]

  // 按发送时间倒序排列（最新消息在前）
  data.sort((a, b) =>
    dayjs(b.sendTime).valueOf() - dayjs(a.sendTime).valueOf(),
  )

  // 分页处理
  const total = data.length
  const startIdx = (Number(page) - 1) * Number(pageSize)

  return {
    items: data.slice(startIdx, startIdx + Number(pageSize)),
    total,
  }
}
```

## 技术要点

1. **响应式过滤**：使用 `computed` 计算 `filteredData`，Tab 切换时自动重新计算，无需手动过滤
2. **相对时间**：集成 `dayjs/plugin/relativeTime`，智能显示"3小时前"、"昨天"等友好格式
3. **自动已读**：查看详情时自动标记已读，减少用户手动操作
4. **视觉层次**：未读圆点 + 紧急加粗 + 优先级颜色，多重视觉提示确保重要消息不被遗漏
5. **TSX 自定义列**：标题列使用 TSX 实现复杂的多元素组合渲染
6. **暗色适配**：所有样式均考虑 `dark:` 暗色模式兼容性

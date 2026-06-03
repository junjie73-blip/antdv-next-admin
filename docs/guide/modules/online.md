# 在线用户

在线用户模块用于实时监控系统当前的在线会话情况，提供用户会话管理、强制下线、统计数据分析等功能。该模块模拟真实场景的在线监控体验，包含自动刷新机制和丰富的统计卡片展示。

## 功能概述

| 功能 | 说明 |
|------|------|
| **实时监控** | 展示当前所有活跃的用户会话信息 |
| **强制下线** | 支持单个或批量强制退出指定用户会话 |
| **30s 自动刷新** | 定时器模拟新用户上线/下线的动态效果 |
| **统计卡片** | 4 个核心指标卡片：当前在线/今日登录/峰值/平均时长 |
| **详情查看** | 抽屉式详情展示会话完整信息 |
| **数据导出** | Excel 格式导出在线用户列表 |
| **打印功能** | 浏览器打印在线用户报表 |

## 4 个统计卡片

页面顶部展示四个核心统计指标，采用网格布局：

```vue
<div class="grid grid-cols-4 gap-4">
  <!-- 当前在线人数 -->
  <a-card :class="cardClassName" size="small">
    <a-statistic title="当前在线" :value="onlineCount" suffix="人">
      <template #prefix>
        <Icon icon="carbon:user-online" class="text-green-500 text-lg mr-1" />
      </template>
    </a-statistic>
  </a-card>

  <!-- 今日登录人次 -->
  <a-card :class="cardClassName" size="small">
    <a-statistic title="今日登录" :value="28" suffix="人次">
      <template #prefix>
        <Icon icon="carbon:login" class="text-blue-500 text-lg mr-1" />
      </template>
    </a-statistic>
  </a-card>

  <!-- 峰值在线人数 -->
  <a-card :class="cardClassName" size="small">
    <a-statistic title="峰值在线" :value="15" suffix="人">
      <template #prefix>
        <Icon icon="carbon:chart-line-data" class="text-orange-500 text-lg mr-1" />
      </template>
    </a-statistic>
  </a-card>

  <!-- 平均在线时长 -->
  <a-card :class="cardClassName" size="small">
    <a-statistic title="平均在线时长" value="2.5" suffix="小时">
      <template #prefix>
        <Icon icon="carbon:time" class="text-purple-500 text-lg mr-1" />
      </template>
    </a-statistic>
  </a-card>
</div>
```

**统计数据说明：**

| 指标 | 字段 | 类型 | 说明 |
|------|------|------|------|
| 当前在线 | `onlineCount` | 响应式 ref | 实时计算当前在线用户总数 |
| 今日登录 | 固定值 28 | 静态 | Mock 数据中今日累计登录人次 |
| 峰值在线 | 固定值 15 | 静态 | 当日历史最高在线人数 |
| 平均时长 | 固定值 2.5h | 静态 | 所有用户的平均在线时长 |

## 用户数据结构

### OnlineUserRecord 接口定义

```typescript
interface OnlineUserRecord {
  tokenId: string    // 会话令牌（唯一标识，用于强退操作）
  sessionId: string  // Session ID（服务端会话标识）
  username: string   // 登录用户名
  nickname: string   // 显示昵称
  ip: string         // IP 地址
  location: string   // 登录地点（IP 地理位置解析）
  browser: string    // 浏览器信息（含版本号）
  os: string         // 操作系统
  loginTime: string  // 登录时间（ISO 格式）
  status: number     // 在线状态：0=在线, 1=离线
}
```

### Mock 数据生成逻辑

```typescript
const generateOnlineUsers = (): OnlineUserRecord[] => {
  const now = dayjs()
  return [
    {
      tokenId: 'tok-admin-001',
      sessionId: 'sess-admin-001',
      username: 'admin',
      nickname: '超级管理员',
      ip: '192.168.1.100',
      location: '北京市朝阳区',
      browser: 'Chrome 125.0',
      os: 'Windows 11',
      loginTime: now.subtract(30, 'minute').format('YYYY-MM-DD HH:mm:ss'),
      status: 0,
    },
    {
      tokenId: 'tok-zhangsan-002',
      sessionId: 'sess-zhangsan-002',
      username: 'zhangsan',
      nickname: '张三',
      ip: '192.168.1.101',
      location: '上海市浦东新区',
      browser: 'Firefox 126.0',
      os: 'Windows 10',
      loginTime: now.subtract(15, 'minute').format('YYYY-MM-DD HH:mm:ss'),
      status: 0,
    },
    {
      tokenId: 'tok-lisi-003',
      sessionId: 'sess-lisi-003',
      username: 'lisi',
      nickname: '李四',
      ip: '192.168.1.102',
      location: '广州市天河区',
      browser: 'Safari 17.4',
      os: 'macOS Sonoma',
      loginTime: now.subtract(8, 'minute').format('YYYY-MM-DD HH:mm:ss'),
      status: 0,
    },
    // ... 更多用户
  ]
}
```

**特点：**
- 使用 `dayjs.relativeTime` 插件动态计算相对时间
- 模拟不同设备环境（PC/Mac/Linux/iOS/Android）
- 涵盖主流浏览器（Chrome/Firefox/Safari/Edge）
- IP 地址覆盖公网和内网场景

## 强制下线功能

### 单个用户强退

```typescript
function handleForceLogout(record: OnlineUserRecord | any) {
  const rec = record as OnlineUserRecord

  // 保护机制：不能踢出 admin 用户
  if (rec.username === 'admin') {
    message.warning('不能强制退出当前登录用户')
    return
  }

  const idx = allData.value.findIndex(i => i.tokenId === rec.tokenId)
  if (idx > -1) {
    allData.value.splice(idx, 1)
    message.success(`已强制退出用户「${rec.nickname}」`)
    tableMethods.value?.reload()
  }
}
```

**UI 层面的保护：**

```vue
<a-popconfirm
  :title="`确定要强制退出用户「${record.nickname}」吗？`"
  @confirm="() => handleForceLogout(record)"
>
  <!-- admin 用户不显示强退按钮 -->
  <a-button
    v-if="record.username !== 'admin'"
    type="link"
    danger
    :class="btnClassName"
  >
    <template #icon><Icon icon="carbon:logout" /></template>
    强退
  </a-button>
  <!-- admin 用户显示提示文字 -->
  <span v-else class="text-gray-400 text-xs">当前用户</span>
</a-popconfirm>
```

### 批量强退实现

```typescript
function handleBatchForceLogout() {
  const selectedRows = (tableMethods.value?.getSelectRows?.() || []) as OnlineUserRecord[]

  if (selectedRows.length === 0) {
    message.warning('请先选择要强退的用户')
    return
  }

  // 过滤掉 admin 用户（保护机制）
  const canKick = selectedRows.filter(r => r.username !== 'admin')
  if (canKick.length === 0) {
    message.warning('选中的用户包含当前登录用户，无法全部强退')
    return
  }

  const kickIds = new Set(canKick.map(r => r.tokenId))
  const kickedNames = canKick.map(r => r.nickname)

  allData.value = allData.value.filter(i => !kickIds.has(i.tokenId))
  message.success(`已强制退出 ${kickedNames.length} 个会话：${kickedNames.join('、')}`)
  tableMethods.value?.reload()
}
```

**安全机制：**
1. **自身保护**：不允许强退当前登录的管理员账号
2. **批量过滤**：批量操作时自动过滤掉受保护的账号
3. **二次确认**：每个强退操作都需要 Popconfirm 确认
4. **友好提示**：被保护的用户显示"当前用户"文字而非按钮

## 自动刷新模拟逻辑

### 定时器实现

```typescript
let refreshTimer: ReturnType<typeof setInterval> | null = null

// 启动自动刷新（30秒间隔）
function startAutoRefresh() {
  stopAutoRefresh()  // 先清除已有定时器，防止重复

  refreshTimer = setInterval(() => {
    // 10% 概率模拟新用户上线
    if (Math.random() > 0.9) {
      simulateNewUserOnline()
    }
    // 5% 概率模拟用户下线（非 admin）
    else if (Math.random() > 0.95 && allData.value.length > 1) {
      simulateUserOffline()
    }

    updateOnlineCount()  // 更新统计数字
  }, 30000)  // 每 30 秒执行一次
}

// 停止自动刷新
function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}
```

### 新用户上线模拟

```typescript
function simulateNewUserOnline() {
  const newId = Date.now()

  // 随机生成用户信息池
  const names = ['chenyi', 'liuer', 'huangsan', 'linxi', 'hexu']
  const locations = ['西安市雁塔区', '郑州市金水区', '长沙市岳麓区', '沈阳市和平区', '济南市历下区']
  const browsers = ['Chrome 125.0', 'Firefox 126.0', 'Edge 124.0', 'Safari 17.4']
  const oss = ['Windows 11', 'Windows 10', 'macOS Sonoma', 'Ubuntu 22.04']

  allData.value.push({
    tokenId: `tok-auto-${newId}`,
    sessionId: `sess-auto-${newId}`,
    username: names[Math.floor(Math.random() * names.length)]!,
    nickname: `自动用户${Math.floor(Math.random() * 100)}`,
    ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
    location: locations[Math.floor(Math.random() * locations.length)]!,
    browser: browsers[Math.floor(Math.random() * browsers.length)]!,
    os: oss[Math.floor(Math.random() * oss.length)]!,
    loginTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    status: 0,
  })

  tableMethods.value?.reload()  // 刷新表格
}
```

### 用户下线模拟

```typescript
function simulateUserOffline() {
  // 只能踢出非 admin 用户
  const nonAdminUsers = allData.value.filter(u => u.username !== 'admin')

  if (nonAdminUsers.length > 0) {
    const randomIdx = Math.floor(Math.random() * nonAdminUsers.length)
    const userToLeave = nonAdminUsers[randomIdx]

    if (userToLeave) {
      const globalIdx = allData.value.findIndex(u => u.tokenId === userToLeave.tokenId)
      if (globalIdx > -1) {
        allData.value.splice(globalIdx, 1)
        tableMethods.value?.reload()
      }
    }
  }
}
```

### 生命周期管理

```typescript
onMounted(() => {
  updateOnlineCount()    // 初始化统计数字
  startAutoRefresh()     // 启动定时刷新
})

onUnmounted(() => {
  stopAutoRefresh()      // 组件卸载时清除定时器，防止内存泄漏
})
```

## 表格列配置

```typescript
const columns: BasicColumn[] = [
  { title: '会话标识', dataIndex: 'tokenId', key: 'tokenId', width: 180, ellipsis: true },
  { title: '用户名', dataIndex: 'username', key: 'username', width: 110, align: 'center' },
  { title: '昵称', dataIndex: 'nickname', key: 'nickname', width: 110 },
  { title: 'IP 地址', dataIndex: 'ip', key: 'ip', width: 140, align: 'center' },
  { title: '登录地点', dataIndex: 'location', key: 'location', width: 130, ellipsis: true },
  { title: '浏览器', dataIndex: 'browser', key: 'browser', width: 160, ellipsis: true },
  { title: '操作系统', dataIndex: 'os', key: 'os', width: 130, ellipsis: true },
  { title: '登录时间', dataIndex: 'loginTime', key: 'loginTime', width: 170 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center' },
]
```

## 详情抽屉配置

```typescript
const detailSchemas: DescriptionItem[] = [
  { field: 'tokenId', label: '会话标识' },
  { field: 'sessionId', label: 'Session ID' },
  { field: 'username', label: '用户名' },
  { field: 'nickname', label: '昵称' },
  { field: 'ip', label: 'IP 地址' },
  { field: 'location', label: '登录地点' },
  { field: 'browser', label: '浏览器' },
  { field: 'os', label: '操作系统' },
  {
    field: 'loginTime',
    label: '登录时间',
    render: (value) => (
      <span>
        {value as string} ({dayjs(value as string).fromNow(true)}前)
      </span>
    ),
  },
  {
    field: 'status',
    label: '在线状态',
    render: (value) => (
      <a-tag color={(value as number) === 0 ? 'green' : 'default'}>
        {(value as number) === 0 ? '在线' : '离线'}
      </a-tag>
    ),
  },
]
```

## 搜索条件

```typescript
const searchFormSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    componentProps: {
      placeholder: '搜索用户名/昵称/IP地址...',
      allowClear: true,
    },
    colProps: { span: 8 },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    componentProps: {
      placeholder: '选择状态',
      allowClear: true,
      options: [
        { label: '在线', value: 0 },
        { label: '已离线', value: 1 },
      ],
    },
    colProps: { span: 6 },
  },
]
```

## Excel 导出配置

```typescript
function handleExport() {
  exportToExcel({
    filename: '在线用户',
    sheetName: '在线用户',
    columns: [
      { header: '会话标识', key: 'tokenId', width: 22 },
      { header: '用户名', key: 'username', width: 14 },
      { header: '昵称', key: 'nickname', width: 12 },
      { header: 'IP地址', key: 'ip', width: 16 },
      { header: '登录地点', key: 'location', width: 16 },
      { header: '浏览器', key: 'browser', width: 18 },
      { header: '操作系统', key: 'os', width: 16 },
      { header: '登录时间', key: 'loginTime', width: 20 },
      { header: '状态', key: 'status', width: 8 },
    ],
    data: allData.value.map(i => ({
      ...i,
      status: i.status === 0 ? '在线' : '离线',
    })),
  })
}
```

## 技术要点

1. **定时器管理**：严格遵循 `onMounted` 创建、`onUnmounted` 销毁的生命周期规范
2. **概率模拟**：使用随机数模拟真实场景的用户上下线行为（上线概率 10%，下线概率 5%）
3. **安全防护**：多层保护机制防止误踢管理员账号
4. **相对时间**：集成 `dayjs/plugin/relativeTime` 插件，智能显示"30分钟前"等友好格式
5. **TSX 渲染**：详情字段使用 TSX 语法实现复杂的条件渲染逻辑

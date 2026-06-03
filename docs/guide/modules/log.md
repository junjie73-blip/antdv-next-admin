# 操作日志

操作日志模块用于记录系统中所有用户的操作行为，提供完善的审计追踪能力。该模块支持多种操作类型的分类展示、详细的信息查看、时间范围筛选以及数据的批量管理和导出打印功能。

## 功能概述

| 功能 | 说明 |
|------|------|
| **操作类型分类** | 支持 11 种操作类型，每种类型配有专属颜色标签 |
| **详情查看** | 抽屉式详情展示，包含 18 个字段的完整操作记录 |
| **时间范围搜索** | 支持精确到秒的时间区间筛选 |
| **Excel 导出** | 可导出选中行或全部数据，包含 11 个关键字段 |
| **打印功能** | 浏览器原生打印，输出格式化日志列表 |
| **批量删除** | 支持多选批量删除日志记录 |
| **清空日志** | 一键清空所有日志（需二次确认） |

## 操作类型枚举及颜色映射

系统预定义了 11 种操作类型，每种类型使用不同的颜色进行视觉区分：

```typescript
const operTypeColorMap: Record<string, string> = {
  '其他': 'default',       // 默认灰色
  '登录': 'blue',          // 登录操作 - 蓝色
  '新增': 'green',         // 新增数据 - 绿色
  '修改': 'blue',          // 修改数据 - 蓝色
  '删除': 'red',           // 删除数据 - 红色
  '授权': 'cyan',          // 权限授权 - 青色
  '导出': 'orange',        // 数据导出 - 橙色
  '导入': 'purple',        // 数据导入 - 紫色
  '强退': 'magenta',       // 强制退出 - 洋红色
  '生成代码': 'geekblue',  // 代码生成 - 极客蓝
  '清空数据': 'volcano',   // 清空数据 - 火山色
}
```

**操作类型选项列表：**

```typescript
const operTypeOptions = [
  { label: '其他', value: '其他' },
  { label: '登录', value: '登录' },
  { label: '新增', value: '新增' },
  { label: '修改', value: '修改' },
  { label: '删除', value: '删除' },
  { label: '授权', value: '授权' },
  { label: '导出', value: '导出' },
  { label: '导入', value: '导入' },
  { label: '强退', value: '强退' },
  { label: '生成代码', value: '生成代码' },
  { label: '清空数据', value: '清空数据' },
]
```

## 搜索表单

操作日志提供四个维度的搜索条件，支持灵活组合查询：

```typescript
const searchFormSchemas: FormSchema[] = [
  {
    field: 'operName',
    label: '操作人',
    component: 'Input',
    componentProps: {
      placeholder: '请输入操作人名称',
      allowClear: true,
    },
    colProps: { span: 6 },
  },
  {
    field: 'operType',
    label: '操作类型',
    component: 'Select',
    componentProps: {
      placeholder: '选择操作类型',
      allowClear: true,
      options: operTypeOptions,
    },
    colProps: { span: 6 },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    componentProps: {
      placeholder: '选择状态',
      allowClear: true,
      options: [
        { label: '成功', value: 0 },
        { label: '失败', value: 1 },
      ],
    },
    colProps: { span: 6 },
  },
  {
    field: 'dateRange',
    label: '操作时间',
    component: 'RangePicker',
    componentProps: {
      placeholder: ['开始时间', '结束时间'],
      format: 'YYYY-MM-DD HH:mm:ss',
      showTime: true,
      allowClear: true,
    },
    colProps: { span: 6 },
  },
]
```

## 日志记录字段

### OperLogRecord 完整接口定义

```typescript
interface OperLogRecord {
  id: number              // 日志编号（唯一标识）
  operName: string        // 操作人用户名
  operType: string        // 操作类型（登录/新增/修改/删除等）
  title: string           // 操作模块标题
  method: string          // 请求的后端方法全路径
  requestMethod: string   // HTTP 请求方式（GET/POST/PUT/DELETE）
  operatorType: number    // 操作类别（1=后台用户, 2=手机端用户）
  operUrl: string         // 请求的 URL 地址
  operIp: string          // 操作者的 IP 地址
  operLocation: string    // 操作地点（IP 解析的地理位置）
  operParam: string       // 请求参数（JSON 格式）
  jsonResult: string | null // 返回结果（JSON 格式，可能为空）
  status: number          // 操作状态（0=成功, 1=失败）
  errorMsg: string        // 错误消息（失败时才有内容）
  operTime: string        // 操作发生时间
  costTime: number        // 操作耗时（毫秒）
}
```

### 详情字段配置（18项）

```typescript
const detailSchemas: DescriptionItem[] = [
  { field: 'id', label: '日志编号' },
  { field: 'operName', label: '操作人' },
  {
    field: 'operType',
    label: '操作类型',
    render: (value) => (
      <a-tag color={operTypeColorMap[value as string] || 'default'}>
        {value}
      </a-tag>
    ),
  },
  { field: 'title', label: '操作模块' },
  {
    field: 'method',
    label: '请求方法',
    render: (value) => (
      <span class="block truncate max-w-[300px]" title={value as string}>
        {value || '-'}
      </span>
    ),
  },
  {
    field: 'requestMethod',
    label: '请求方式',
    render: (value) => {
      const methodColorMap: Record<string, string> = {
        GET: 'green',
        POST: 'blue',
        PUT: 'orange',
        DELETE: 'red',
      }
      return <a-tag color={methodColorMap[value as string] || 'default'}>{value}</a-tag>
    },
  },
  {
    field: 'operatorType',
    label: '操作类别',
    render: (value) => <span>{operatorTypeLabelMap[value as number] || '未知'}</span>,
  },
  {
    field: 'operUrl',
    label: '请求URL',
    render: (value) => (
      <span class="block truncate max-w-[300px]" title={value as string}>
        {value || '-'}
      </span>
    ),
  },
  { field: 'operIp', label: '主机地址' },
  { field: 'operLocation', label: '操作地点' },
  {
    field: 'operParam',
    label: '请求参数',
    render: (value) => (
      <a-typography-paragraph
        copyable={{ text: value as string }}
        ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}
        style={{ margin: 0, maxWidth: 400 }}
        code
      >
        {(value as string) || '-'}
      </a-typography-paragraph>
    ),
  },
  {
    field: 'jsonResult',
    label: '返回结果',
    render: (value) => value ? (
      <a-typography-paragraph
        copyable={{ text: value as string }}
        ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}
        style={{ margin: 0, maxWidth: 400 }}
        code
      >
        {value as string}
      </a-typography-paragraph>
    ) : <span class="text-gray-400">-</span>,
  },
  {
    field: 'status',
    label: '操作状态',
    render: (value) => (
      <a-tag color={statusColorMap[value as number] || 'default'}>
        {statusLabelMap[value as number] || '未知'}
      </a-tag>
    ),
  },
  {
    field: 'errorMsg',
    label: '错误消息',
    render: (value) => (value as string) ? (
      <a-typography-paragraph
        type="danger"
        ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}
        style={{ margin: 0, maxWidth: 400 }}
      >
        {value as string}
      </a-typography-paragraph>
    ) : <span class="text-gray-400">-</span>,
  },
  { field: 'operTime', label: '操作时间' },
  {
    field: 'costTime',
    label: '消耗时间',
    render: (value) => {
      const ms = value as number
      const color = ms > 1000 ? 'red' : ms > 500 ? 'orange' : 'green'
      return <a-tag color={color}>{ms} ms</a-tag>
    },
  },
]
```

## 表格列配置

```typescript
const columns: BasicColumn[] = [
  { title: '日志编号', dataIndex: 'id', key: 'id', width: 90, align: 'center' },
  { title: '操作人', dataIndex: 'operName', key: 'operName', width: 100, align: 'center' },
  { title: '操作类型', dataIndex: 'operType', key: 'operType', width: 90, align: 'center' },
  { title: '操作模块', dataIndex: 'title', key: 'title', width: 120 },
  { title: '请求方式', dataIndex: 'requestMethod', key: 'requestMethod', width: 85, align: 'center' },
  { title: '主机', dataIndex: 'operIp', key: 'operIp', width: 140, ellipsis: true },
  { title: '操作地点', dataIndex: 'operLocation', key: 'operLocation', width: 130, ellipsis: true },
  { title: '状态', dataIndex: 'status', key: 'status', width: 70, align: 'center' },
  { title: '耗时', dataIndex: 'costTime', key: 'costTime', width: 80, align: 'center' },
  { title: '操作时间', dataIndex: 'operTime', key: 'operTime', width: 165 },
]
```

### 自定义列渲染

**操作类型列** - 使用彩色标签展示：

```vue
<template #cell-operType="{ record }">
  <a-tag :color="operTypeColorMap[record.operType] || 'default'">
    {{ record.operType }}
  </a-tag>
</template>
```

**请求方式列** - HTTP 方法颜色区分：

```vue
<template #cell-requestMethod="{ record }">
  <a-tag :color="record.requestMethod === 'GET'
    ? 'green'
    : record.requestMethod === 'POST'
      ? 'blue'
      : record.requestMethod === 'PUT'
        ? 'orange'
        : 'red'"
  >
    {{ record.requestMethod }}
  </a-tag>
</template>
```

**状态列** - 成功/失败图标+文字：

```vue
<template #cell-status="{ record }">
  <a-tag :color="statusColorMap[record.status] || 'default'">
    <span :class="tagClassName">
      <Icon :icon="record.status === 0
        ? 'carbon:checkmark-outline'
        : 'carbon:close-outline'" />
      {{ statusLabelMap[record.status] || '未知' }}
    </span>
  </a-tag>
</template>
```

**耗时列** - 性能等级颜色警示：

```vue
<template #cell-costTime="{ record }">
  <a-tag :color="record.costTime > 1000
    ? 'red'
    : record.costTime > 500
      ? 'orange'
      : 'green'"
  >
    {{ record.costTime }}ms
  </a-tag>
</template>
```

## 批量操作

### 工具栏按钮

```vue
<template #toolbar>
  <!-- 导出 -->
  <a-button @click="handleExport">
    <template #icon><Icon icon="carbon:export" /></template>
    导出
  </a-button>

  <!-- 打印 -->
  <a-button @click="handlePrint">
    <template #icon><Icon icon="carbon:printer" /></template>
    打印
  </a-button>

  <!-- 批量删除 -->
  <a-button danger @click="handleBatchDelete">
    <template #icon><Icon icon="ant-design:delete-outlined" /></template>
    批量删除
  </a-button>

  <!-- 清空日志 -->
  <a-popconfirm
    title="确定要清空所有操作日志吗？此操作不可恢复！"
    @confirm="handleClear"
  >
    <a-button danger>
      <template #icon><Icon icon="carbon:trash-can" /></template>
      清空
    </a-button>
  </a-popconfirm>
</template>
```

### 批量删除实现

```typescript
function handleBatchDelete() {
  const selectedRows = (tableMethods.value?.getSelectRows?.() || []) as OperLogRecord[]

  if (selectedRows.length === 0) {
    message.warning('请先选择要删除的日志')
    return
  }

  const ids = new Set(selectedRows.map(i => i.id))
  allData.value = allData.value.filter(i => !ids.has(i.id))
  message.success(`批量删除 ${ids.size} 条日志成功`)
  tableMethods.value?.reload()
}
```

### 清空日志实现

```typescript
function handleClear() {
  allData.value = []
  message.success('日志清空成功')
  tableMethods.value?.reload()
}
```

## Excel 导出配置

```typescript
function handleExport() {
  const selectedRows = (tableMethods.value?.getSelectRows?.() || []) as OperLogRecord[]
  const dataToExport = selectedRows.length > 0 ? selectedRows : allData.value

  exportToExcel({
    filename: '操作日志',
    sheetName: '操作日志',
    columns: [
      { header: '日志编号', key: 'id', width: 10 },
      { header: '操作人', key: 'operName', width: 12 },
      { header: '操作类型', key: 'operType', width: 10 },
      { header: '操作模块', key: 'title', width: 14 },
      { header: '请求方式', key: 'requestMethod', width: 8 },
      { header: '请求URL', key: 'operUrl', width: 30 },
      { header: '主机地址', key: 'operIp', width: 16 },
      { header: '操作地点', key: 'operLocation', width: 18 },
      { header: '操作状态', key: 'status', width: 8 },
      { header: '消耗时间(ms)', key: 'costTime', width: 12 },
      { header: '操作时间', key: 'operTime', width: 20 },
    ],
    data: dataToExport.map(i => ({
      ...i,
      status: i.status === 0 ? '成功' : '失败',
    })),
  })
}
```

## 时间范围筛选逻辑

使用 `dayjs` 库进行精确的时间比较：

```typescript
async function mockApi(params: Record<string, any>) {
  const { operName, operType, status, dateRange, page = 1, pageSize = 10 } = params
  let filtered = [...allData.value]

  // 1. 操作人筛选
  if (operName) {
    const kw = String(operName).toLowerCase()
    filtered = filtered.filter(i => i.operName.toLowerCase().includes(kw))
  }

  // 2. 操作类型筛选
  if (operType) {
    filtered = filtered.filter(i => i.operType === operType)
  }

  // 3. 状态筛选
  if (status !== undefined && status !== null && status !== '') {
    filtered = filtered.filter(i => i.status === Number(status))
  }

  // 4. 时间范围筛选（关键逻辑）
  if (dateRange && Array.isArray(dateRange) && dateRange.length === 2) {
    const start = dayjs(dateRange[0])
    const end = dayjs(dateRange[1])
    filtered = filtered.filter(item =>
      dayjs(item.operTime).isAfter(start.subtract(1, 'second'))
      && dayjs(item.operTime).isBefore(end.add(1, 'second')),
    )
  }

  // 5. 按时间倒序排列
  filtered.sort((a, b) =>
    dayjs(b.operTime).valueOf() - dayjs(a.operTime).valueOf(),
  )

  // 6. 分页处理
  const total = filtered.length
  const startIdx = (Number(page) - 1) * Number(pageSize)
  const items = filtered.slice(startIdx, startIdx + Number(pageSize))

  return { items, total }
}
```

## Mock 数据示例

```typescript
const mockData: OperLogRecord[] = [
  {
    id: 1,
    operName: 'admin',
    operType: '登录',
    title: '用户登录',
    method: 'com.system.controller.SysLoginController.login()',
    requestMethod: 'POST',
    operatorType: 1,
    operUrl: '/login',
    operIp: '192.168.1.100',
    operLocation: '北京市朝阳区',
    operParam: '{"username":"admin"}',
    jsonResult: '{"code":200,"msg":"操作成功"}',
    status: 0,
    errorMsg: '',
    operTime: '2024-06-03 09:00:15',
    costTime: 156,
  },
  {
    id: 6,
    operName: 'lisi',
    operType: '授权',
    title: '角色管理',
    method: 'com.system.controller.SysRoleController.authDataScope()',
    requestMethod: 'PUT',
    operatorType: 1,
    operUrl: '/system/role/authDataScope',
    operIp: '192.168.1.102',
    operLocation: '广州市天河区',
    operParam: '{"roleId":3,"deptIds":[1,2,3]}',
    jsonResult: null,
    status: 1,  // 失败
    errorMsg: '权限不足，无权进行此操作',
    operTime: '2024-06-03 10:45:22',
    costTime: 23,
  },
  // ... 更多记录
]
```

## 技术要点

1. **TSX 语法**：详情字段渲染使用 TSX 语法，支持复杂的 JSX 逻辑
2. **dayjs 插件**：引入 `relativeTime` 插件，支持相对时间显示（如 "3小时前"）
3. **富文本展示**：请求参数和返回结果支持复制、折叠展开功能
4. **性能监控**：耗时字段使用三色分级（绿<500ms / 橙500-1000ms / 红>1000ms）
5. **安全设计**：清空操作需要二次确认，防止误操作导致数据丢失

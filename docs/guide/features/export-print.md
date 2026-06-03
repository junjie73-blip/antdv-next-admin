# 数据导出与打印

项目内置了 **Excel 导出** 和 **专业打印** 两大数据输出能力，分别基于 SheetJS 和 iframe 方案实现。

---

## Excel 导出

### 工具位置

```ts
import { exportToExcel } from '@/utils/excel'
```

### ExportOptions 接口详细说明

```ts
/**
 * Excel 导出选项
 */
export interface ExportOptions {
  /**
   * 文件名（不含扩展名）
   *
   * 最终生成的文件名格式：`{filename}_{YYYYMMDD_HHmmss}.xlsx`
   * 例如 filename='用户列表' → `用户列表_20260603_143022.xlsx`
   */
  filename: string

  /**
   * 列配置数组
   *
   * 定义导出数据的表头和数据字段映射关系
   */
  columns: ExportColumn[]

  /**
   * 数据源
   *
   * 待导出的记录数组，每条记录为一个普通对象
   */
  data: Record<string, any>[]

  /**
   * 工作表名称
   *
   * @default 'Sheet1'
   */
  sheetName?: string

  /**
   * 是否自动调整列宽
   *
   * 开启后，每列宽度取 header 长度和所有数据字段长度的最大值
   * 如果 columns 中指定了 width，则 width 作为最小宽度
   *
   * @default true
   */
  autoWidth?: boolean
}
```

### ExportColumn 接口

```ts
/**
 * 导出列配置
 */
export interface ExportColumn {
  /**
   * 表头文字
   *
   * 显示在 Excel 第一行的列标题
   * @example '用户名' | '创建时间' | '状态'
   */
  header: string

  /**
   * 数据字段名
   *
   * 对应 data 中每条记录的字段 key
   * 支持嵌套路径（需要预处理）
   * @example 'username' | 'createdAt' | 'status'
   */
  key: string

  /**
   * 列宽（字符数）
   *
   * 当 autoWidth=true 时作为最小宽度保证
   * 当 autoWidth=false 时作为固定列宽
   *
   * @example 15 → 约 15 个字符宽度
   */
  width?: number
}
```

### 基础用法

```ts
import { exportToExcel } from '@/utils/excel'

// 最简调用
exportToExcel({
  filename: '用户列表',
  columns: [
    { header: '用户名', key: 'username', width: 15 },
    { header: '昵称', key: 'nickname', width: 12 },
    { header: '邮箱', key: 'email', width: 28 },
    { header: '手机号', key: 'phone', width: 15 },
    { header: '状态', key: 'status', width: 10 },
  ],
  data: [
    { username: 'zhangsan', nickname: '张三', email: 'zhangsan@example.com', phone: '13800138000', status: '正常' },
    { username: 'lisi', nickname: '李四', email: 'lisi@example.com', phone: '13900139000', status: '禁用' },
  ],
})
```

执行后会：
1. 弹出浏览器下载
2. 文件名：`用户列表_20260603_143022.xlsx`
3. 显示成功提示消息

### 从 Table 组件导出

在实际业务中，通常从已有的表格数据导出：

```vue
<script setup lang="ts">
import { exportToExcel, type ExportColumn } from '@/utils/excel'

// 表格列定义
const tableColumns = [
  { title: '用户名', dataIndex: 'username' },
  { title: '昵称', dataIndex: 'nickname' },
  { title: '邮箱', dataIndex: 'email' },
  { title: '手机号', dataIndex: 'phone' },
  { title: '状态', dataIndex: 'status' },
]

// 表格数据
const tableData = ref<UserInfo[]>([])

// 导出处理函数
function handleExport() {
  // 将表格列配置转换为导出列配置
  const exportColumns: ExportColumn[] = tableColumns.map(col => ({
    header: col.title as string,
    key: col.dataIndex as string,
    width: col.width || 15,
  }))

  exportToExcel({
    filename: '用户数据',
    columns: exportColumns,
    data: tableData.value,
  })
}
</script>

<template>
  <div>
    <a-table :columns="tableColumns" :data-source="tableData" />
    <a-button type="primary" @click="handleExport">
      导出 Excel
    </a-button>
  </div>
</template>
```

### 自定义表头映射技巧

当数据库字段名与期望的表头不一致时，可以通过 `header` 和 `key` 分别映射：

```ts
// 数据库字段 → 中文表头 映射
const fieldMapping: Record<string, string> = {
  usr_nm: '用户名',       // 数据库字段: usr_nm → 表头: 用户名
  nick_nm: '昵称',
  email_addr: '邮箱地址',
  mobile_no: '联系电话',
  acct_status: '账户状态',
  crt_tm: '创建时间',
  upd_tm: '更新时间',
}

// 自动生成导出列配置
function buildExportColumns(fields: string[]): ExportColumn[] {
  return fields.map(field => ({
    header: fieldMapping[field] || field,
    key: field,
  }))
}

// 使用
exportToExcel({
  filename: '用户报表',
  columns: buildExportColumns(['usr_nm', 'nick_nm', 'email_addr', 'acct_status']),
  data: rawData,
})
```

### 数据预处理

导出前对数据进行转换（如状态码转中文、时间戳格式化等）：

```ts
function prepareExportData(rawData: UserInfo[]): Record<string, any>[] {
  return rawData.map(item => ({
    ...item,
    // 状态码 → 中文
    status: item.status === 1 ? '正常' : item.status === 0 ? '禁用' : '未知',
    // 时间戳 → 格式化日期
    createdAt: dayjs(item.createdAt).format('YYYY-MM-DD HH:mm:ss'),
    // 角色数组 → 字符串
    roles: Array.isArray(item.roles) ? item.roles.join('、') : item.roles,
  }))
}

// 导出时使用预处理后的数据
exportToExcel({
  filename: '用户报表',
  columns: exportColumns,
  data: prepareExportData(tableData.value),
})
```

### 特殊值处理

`exportToExcel` 内部已处理以下特殊情况：

| 数据值 | 导出结果 |
|--------|----------|
| `null` | 空字符串 `''` |
| `undefined` | 空字符串 `''` |
| 普通对象 | `JSON.stringify()` 序列化 |
| 其他值 | `String()` 转换 |

### 空数据处理

当传入空数组时，会弹出警告提示而不生成文件：

```ts
// data 为空数组
exportToExcel({
  filename: '测试',
  columns: [{ header: '名称', key: 'name' }],
  data: [],  // → message.warning('没有可导出的数据')
})
```

---

## 打印功能

### 工具位置

```ts
import { usePrint } from '@/utils/print'
```

### PrintOptions 接口

```ts
/**
 * 打印选项
 */
export interface PrintOptions {
  /**
   * 打印标题
   *
   * 显示在打印页面的页眉区域
   * @default document.title
   */
  title?: string

  /**
   * 打印目标
   *
   * 支持 CSS 选择器字符串或 HTMLElement 引用
   * @example '#print-table' | document.getElementById('print-area')
   */
  target: string | HTMLElement

  /**
   * 打印前回调
   *
   * 在创建 iframe 之前调用，可用于：
   * - 隐藏不需要打印的元素（如操作按钮列）
   * - 临时修改样式以适配打印
   */
  onBeforePrint?: () => void

  /**
   * 打印后回调
   *
   * 在打印对话框关闭后调用，用于恢复被隐藏的元素
   */
  onAfterPrint?: () => void

  /**
   * 是否显示页眉
   *
   * 页眉包含标题和打印时间
   * @default true
   */
  showHeader?: boolean

  /**
   * 是否显示页脚
   *
   * 页脚显示页码信息
   * @default true
   */
  showFooter?: boolean

  /**
   * 自定义样式覆盖
   *
   * 追加到默认打印样式之后，用于微调打印效果
   */
  styles?: string
}
```

### iframe 实现原理

打印功能通过 **隐藏 iframe** 实现，核心流程如下：

```
1. 获取目标 DOM 元素
       │
       ▼
2. 创建隐藏 iframe（position:absolute, left:-9999px）
       │
       ▼
3. 构建 HTML 文档结构
   ├── <!DOCTYPE html>
   ├── <head>
   │   ├── <title> → 打印标题
   │   └── <style> → 默认打印样式 + 自定义样式
   └── <body>
       ├── [可选] 页眉 (.print-header)
       │   ├── <h1> 标题
       │   └── <p> 打印时间
       ├── 目标元素的 innerHTML (.print-content)
       └── [可选] 页脚 (.print-footer)
       │
       ▼
4. iframe.contentWindow.print() 触发浏览器打印对话框
       │
       ▼
5. 清理：移除 iframe，执行 onAfterPrint 回调
```

### 为什么用 iframe 而非 window.print()

| 方案 | 优点 | 缺点 |
|------|------|------|
| `window.print()` | 简单 | 会打印整个页面，包括导航栏、侧边栏等 |
| **iframe（本项目方案）** | 只打印指定区域，可控性强 | 需要复制 DOM 到 iframe |
| 新窗口打开 | 隔离性好 | 可能被浏览器弹窗拦截 |

### 基础用法

```vue
<template>
  <div id="print-area">
    <table class="w-full border-collapse">
      <thead>
        <tr>
          <th>姓名</th>
          <th>部门</th>
          <th>职位</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in dataList" :key="item.id">
          <td>{{ item.name }}</td>
          <td>{{ item.department }}</td>
          <td>{{ item.position }}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <a-button type="primary" @click="handlePrint">打印</a-button>
</template>

<script setup lang="ts">
import { usePrint } from '@/utils/print'

function handlePrint() {
  usePrint({
    title: '员工名单',
    target: '#print-area',
  })
}
</script>
```

### 隐藏不需要打印的元素

```vue
<template>
  <div id="print-area">
    <table class="w-full">
      <!-- 数据列 -->
      <thead>
        <tr>
          <th>姓名</th>
          <th>邮箱</th>
          <!-- 操作列：打印时隐藏 -->
          <th class="no-print">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in list" :key="item.id">
          <td>{{ item.name }}</td>
          <td>{{ item.email }}</td>
          <td class="no-print">
            <a-button size="small">编辑</a-button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style>
/* 默认打印样式中已定义 .no-print { display: none !important; } */
</style>
```

### 打印前后回调

```ts
usePrint({
  title: '数据报表',
  target: '#report-table',

  // 打印前：隐藏操作列、展开折叠行
  onBeforePrint() {
    // 临时隐藏操作按钮
    document.querySelectorAll('.action-column').forEach(el => {
      ;(el as HTMLElement).style.display = 'none'
    })
    // 展开所有折叠的详情
    document.querySelectorAll('.collapsed-row').forEach(el => {
      ;(el as HTMLElement).classList.remove('hidden')
    })
  },

  // 打印后：恢复原始状态
  onAfterPrint() {
    document.querySelectorAll('.action-column').forEach(el => {
      ;(el as HTMLElement).style.display = ''
    })
  },
})
```

### 自定义打印样式

```ts
usePrint({
  target: '#custom-table',
  showHeader: true,
  showFooter: false,

  // 追加自定义样式
  styles: `
    .print-content table th {
      background-color: #1677ff !important;
      color: white !important;
    }
    .print-content table td {
      font-size: 11px;
      padding: 6px 8px;
    }
    .print-content .highlight-row {
      background-color: #fff7e6 !important;
    }
    @media print {
      @page {
        size: A4 landscape;  // 横向 A4
        margin: 10mm;
      }
    }
  `,
})
```

### 默认打印样式

iframe 中内置的默认样式：

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  color: #333;
  line-height: 1.5;
  padding: 20px;
}
table { width: 100%; border-collapse: collapse; margin: 10px 0; }
th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
th { background-color: #f5f5f5; font-weight: 600; }
tr:nth-child(even) { background-color: #fafafa; }
.no-print { display: none !important; }
.print-header {
  text-align: center;
  margin-bottom: 20px;
  border-bottom: 2px solid #333;
  padding-bottom: 10px;
}
.print-footer {
  text-align: right;
  margin-top: 20px;
  font-size: 10px;
  color: #999;
  border-top: 1px solid #ddd;
  padding-top: 10px;
}
@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
```

---

## 在业务模块中的集成

### 操作日志模块

```vue
<!-- views/system/log/index.vue -->
<script setup lang="ts">
import { exportToExcel } from '@/utils/excel'
import { usePrint } from '@/utils/print'

const logColumns = [
  { title: '操作人', dataIndex: 'operator' },
  { title: '操作类型', dataIndex: 'action' },
  { title: '操作模块', dataIndex: 'module' },
  { title: 'IP 地址', dataIndex: 'ip' },
  { title: '操作时间', dataIndex: 'createTime' },
  { title: '状态', dataIndex: 'status' },
]

const logData = ref<LogItem[]>([])

// 导出日志
function handleExportLog() {
  const exportCols = logColumns.map(col => ({
    header: col.title,
    key: col.dataIndex,
  }))

  exportToExcel({
    filename: '操作日志',
    columns: exportCols,
    data: logData.value.map(log => ({
      ...log,
      status: log.status === 1 ? '成功' : '失败',
      createTime: dayjs(log.createTime).format('YYYY-MM-DD HH:mm:ss'),
    })),
  })
}

// 打印日志
function handlePrintLog() {
  usePrint({
    title: '操作日志报表',
    target: '#log-table',
    onBeforePrint() {
      // 隐藏操作列
      document.querySelectorAll('.log-action-col').forEach(el => {
        ;(el as HTMLElement).style.display = 'none'
      })
    },
    onAfterPrint() {
      document.querySelectorAll('.log-action-col').forEach(el => {
        ;(el as HTMLElement).style.display = ''
      })
    },
  })
}
</script>

<template>
  <div>
    <div class="flex gap-2 mb-4">
      <a-button @click="handleExportLog">
        <Icon icon="carbon:download" /> 导出
      </a-button>
      <a-button @click="handlePrintLog">
        <Icon icon="carbon:printer" /> 打印
      </a-button>
    </div>

    <a-table
      id="log-table"
      :columns="logColumns"
      :data-source="logData"
    />
  </div>
</template>
```

### 用户管理模块

```vue
<!-- views/system/user/index.vue -->
<script setup lang="ts">
import { exportToExcel } from '@/utils/excel'
import { usePrint } from '@/utils/print'

// 用户列表导出（含复杂字段映射）
function handleExportUsers() {
  const columnMap = [
    { header: '账号', key: 'username', width: 15 },
    { header: '姓名', key: 'realName', width: 12 },
    { header: '性别', key: 'genderText', width: 8 },
    { header: '手机号', key: 'phone', width: 15 },
    { header: '邮箱', key: 'email', width: 25 },
    { header: '部门', key: 'deptName', width: 15 },
    { header: '角色', key: 'roleNames', width: 15 },
    { header: '状态', key: 'statusText', width: 10 },
    { header: '创建时间', key: 'createdAt', width: 20 },
  ]

  const exportData = userData.value.map(user => ({
    ...user,
    genderText: user.gender === 1 ? '男' : user.gender === 2 ? '女' : '未知',
    statusText: user.status === 1 ? '正常' : '禁用',
    roleNames: user.roles?.map(r => r.name).join('、') || '',
    createdAt: dayjs(user.createdAt).format('YYYY-MM-DD HH:mm:ss'),
  }))

  exportToExcel({
    filename: '用户清单',
    columns: columnMap,
    data: exportData,
  })
}
</script>
```

### 在线用户模块

```vue
<!-- views/system/online/index.vue -->
<script setup lang="ts">
import { exportToExcel } from '@/utils/excel'

// 在线用户导出
function handleExportOnline() {
  exportToExcel({
    filename: '在线用户',
    columns: [
      { header: '会话ID', key: 'sessionId', width: 36 },
      { header: '用户名', key: 'username', width: 15 },
      { header: 'IP 地址', key: 'ip', width: 18 },
      { header: '登录地点', key: 'loginLocation', width: 15 },
      { header: '浏览器', key: 'browser', width: 20 },
      { header: '操作系统', key: 'os', width: 15 },
      { header: '登录时间', key: 'loginTime', width: 20 },
    ],
    data: onlineUsers.value.map(u => ({
      ...u,
      loginTime: dayjs(u.loginTime).format('YYYY-MM-DD HH:mm:ss'),
    })),
  })
}
</script>
```

---

## 注意事项

::: tip 导出最佳实践
- 大数据量导出（> 10000 行）建议后端异步生成，前端轮询下载
- 导出前务必进行数据清洗和格式化
- 文件名避免使用特殊字符，防止跨平台兼容问题
:::

::: tip 打印最佳实践
- 使用 `onBeforePrint` / `onAfterPrint` 配对操作，确保 DOM 状态正确恢复
- 打印目标元素应具有稳定的 `id` 或 ref 引用
- 复杂表格建议通过自定义 `styles` 微调打印效果
- `@page` CSS 规则可控制纸张方向和边距
:::

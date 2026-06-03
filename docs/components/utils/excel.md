# Excel 导出工具

通用 Excel 导出工具，基于 xlsx (SheetJS) 实现。

## 基础用法

```ts
import { exportToExcel } from '@/utils/excel'

exportToExcel({
  filename: '用户列表',
  columns: [
    { header: '姓名', key: 'name', width: 15 },
    { header: '邮箱', key: 'email', width: 30 },
    { header: '手机号', key: 'phone', width: 15 },
  ],
  data: [
    { name: '张三', email: 'zhangsan@example.com', phone: '13800138000' },
    { name: '李四', email: 'lisi@example.com', phone: '13900139000' },
  ],
})
```

## API

### ExportOptions

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `filename` | `string` | 必填 | 文件名（不含扩展名） |
| `columns` | `ExportColumn[]` | 必填 | 列配置 |
| `data` | `Record<string, any>[]` | 必填 | 数据源 |
| `sheetName` | `string` | 'Sheet1' | 工作表名称 |
| `autoWidth` | `boolean` | true | 是否自动调整列宽 |

### ExportColumn

| 参数 | 类型 | 说明 |
|------|------|------|
| `header` | `string` | 表头文字 |
| `key` | `string` | 对应数据字段名 |
| `width` | `number` | 列宽（autoWidth=true 时作为最小宽度） |

## 特性

- **自动列宽** — 根据内容长度自动计算最佳宽度
- **时间戳命名** — 自动追加时间戳避免文件覆盖
- **Schema 驱动** — 与 Table 组件的 column 配置风格一致

## 示例：从表格数据导出

```vue
<script setup lang="ts">
import { exportToExcel } from '@/utils/excel'
import type { ExportColumn } from '@/utils/excel'

const tableColumns = [
  { title: '姓名', dataIndex: 'name' },
  { title: '年龄', dataIndex: 'age' },
]

function handleExport() {
  const exportColumns: ExportColumn[] = tableColumns.map(col => ({
    header: col.title as string,
    key: col.dataIndex as string,
  }))

  exportToExcel({
    filename: '导出数据',
    columns: exportColumns,
    data: tableData.value,
  })
}
</script>

<template>
  <a-button @click="handleExport">导出 Excel</a-button>
</template>
```

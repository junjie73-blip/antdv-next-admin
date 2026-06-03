# 打印工具 (usePrint)

基于 iframe 的浏览器打印工具函数，支持自定义样式、页眉页脚、专业表格打印等功能。

## 基础用法

```vue
<script setup lang="ts">
import { usePrint } from '@/utils/print'

function handlePrint() {
  usePrint({
    title: '用户列表',
    target: '#print-area',
  })
}
</script>

<template>
  <div>
    <a-button type="primary" @click="handlePrint">打印</a-button>

    <!-- 需要打印的区域 -->
    <div id="print-area">
      <table>
        <thead><tr><th>姓名</th><th>年龄</th></tr></thead>
        <tbody>
          <tr v-for="user in userList" :key="user.id">
            <td>{{ user.name }}</td><td>{{ user.age }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
```

## API 参数

### PrintOptions 接口

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| `title` | 打印标题（同时作为页面标题） | `string` | `document.title` |
| `target` | 要打印的 DOM 元素或 CSS 选择器（**必填**） | `string \| HTMLElement` | - |
| `onBeforePrint` | 打印前回调 | `() => void` | - |
| `onAfterPrint` | 打印后回调 | `() => void` | - |
| `showHeader` | 是否显示页眉（标题+打印时间） | `boolean` | `true` |
| `showFooter` | 是否显示页脚（页码） | `boolean` | `true` |
| `styles` | 自定义打印样式（追加到默认样式之后） | `string` | - |

## iframe 打印原理

`usePrint` 采用 **隐藏 iframe** 方式实现浏览器打印，核心流程如下：

```
1. 获取目标元素内容 (innerHTML)
       ↓
2. 创建隐藏的 iframe (position: absolute, left: -9999px)
       ↓
3. 在 iframe 中构建完整 HTML 文档：
   ├── DOCTYPE + html + head
   │     └── <title> + <style>(默认样式 + 自定义样式)
   └── body
         ├── [可选] 页眉 (print-header)
         ├── print-content (目标元素 innerHTML)
         └── [可选] 页脚 (print-footer)
       ↓
4. 触发 iframe.contentWindow.print()
       ↓
5. 用户操作打印对话框 → 完成/取消
       ↓
6. 清理：移除 iframe DOM，执行 onAfterPrint 回调
```

### 为什么使用 iframe？

- **隔离性**：不影响当前页面的样式和布局
- **可控性**：可以完全控制打印文档的 HTML 结构和样式
- **兼容性**：所有现代浏览器均支持
- **无依赖**：纯原生实现，无需引入第三方库

## 专业表格样式

内置默认打印样式已针对表格做了优化：

```css
/* 默认内置的表格打印样式 */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
}

th, td {
  border: 1px solid #ddd;
  padding: 8px 12px;
  text-align: left;
}

th {
  background-color: #f5f5f5;
  font-weight: 600;
}

/* 斑马纹效果 */
tr:nth-child(even) {
  background-color: #fafafa;
}
```

### 页眉页脚结构

当启用 `showHeader` 和 `showFooter` 时：

```
┌─────────────────────────────────────┐
│           用户列表                   │  ← 页眉标题 (h1, 18px)
│     打印时间：2024/6/3 14:30:00     │  ← 页眉副标题 (12px, 灰色)
│  ─────────────────────────────────  │  ← 分隔线
│                                     │
│  ┌──────┬──────┬──────┬──────┐     │
│  │ 姓名  │ 年龄  │ 邮箱  │ 电话  │     │  ← 表格内容
│  ├──────┼──────┼──────┼──────┤     │
│  │ 张三 │ 28   │ ...  │ ...  │     │
│  │ 李四 │ 32   │ ...  │ ...  │     │
│  └──────┴──────┴──────┴──────┘     │
│                                     │
│  ─────────────────────────────────  │  ← 分隔线
│                          第  /  页  │  ← 页脚 (右对齐, 10px)
└─────────────────────────────────────┘
```

## 自定义样式参数

通过 `styles` 属性传入额外的 CSS 来覆盖或扩展默认样式：

```ts
usePrint({
  target: '#report-table',
  title: '月度销售报表',
  styles: `
    /* 自定义纸张方向 */
    @page {
      size: A4 landscape;
      margin: 15mm;
    }

    /* 自定义表格样式 */
    table th {
      background-color: #1677ff !important;
      color: white !important;
    }

    /* 隐藏不需要打印的列 */
    .no-print-column {
      display: none !important;
    }

    /* 设置字体 */
    body {
      font-family: 'SimSun', serif;
      font-size: 11pt;
    }
  `,
})
```

### 常用自定义样式示例

#### 隐藏非打印元素

在需要排除的元素上添加 `no-print` 类名即可（已内置支持）：

```html
<div id="print-area">
  <button class="no-print">操作按钮</button>  <!-- 打印时自动隐藏 -->
  <table>...</table>
</div>
```

#### A4 纸张优化

```ts
usePrint({
  target: '#content',
  styles: `
    @page {
      size: A4 portrait;
      margin: 10mm;
    }

    body {
      width: 190mm; /* A4 宽度减去边距 */
      padding: 0 5mm;
    }
  `,
})
```

#### 强制分页

```html
<div id="print-area">
  <h1>第一页内容</h1>
  <div style="page-break-after: always" />
  <h1>第二页内容</h1>
</div>
```

#### Logo 和水印

```ts
usePrint({
  target: '#document',
  showHeader: false,
  styles: `
    .print-content::before {
      content: '';
      display: block;
      height: 60px;
      background-image: url(/logo.png);
      background-repeat: no-repeat;
      background-position: center;
      background-size: contain;
      margin-bottom: 20px;
    }

    .print-content::after {
      content: '机密文件';
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 80px;
      color: rgba(0,0,0,0.05);
      z-index: 999;
      pointer-events: none;
    }
  `,
})
```

## 在业务模块中的集成

### Table 组件中集成打印

```vue
<script setup lang="ts">
import { usePrint } from '@/utils/print'
import { BasicTable } from '@/components/business/Table'
import { useTable } from '@/components/business/Table/useTable'

const [register, { getDataSource }] = useTable({
  api: api.getUserList,
})

function handlePrintTable() {
  usePrint({
    title: '用户数据表',
    target: '.ant-table', // Antdv Next Table 的选择器
    onBeforePrint: () => {
      // 打印前临时调整表格宽度
      const table = document.querySelector('.ant-table') as HTMLElement
      if (table) table.style.width = '100%'
    },
    onAfterPrint: () => {
      // 打印后恢复原始状态
      const table = document.querySelector('.ant-table') as HTMLElement
      if (table) table.style.width = ''
    },
  })
}
</script>

<template>
  <BasicTable :register="register">
    <template #toolbar>
      <a-button @click="handlePrintTable">打印表格</a-button>
    </template>
  </BasicTable>
</template>
```

### 详情页面打印

```vue
<script setup lang="ts">
import { usePrint } from '@/utils/print'
import { BasicDescription } from '@/components/business/Description'

function handlePrintDetail() {
  usePrint({
    title: '用户详情 - 张三',
    target: '.description',
    showHeader: true,
    showFooter: true,
  })
}
</script>

<template>
  <div class="p-6">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold">用户详情</h2>
      <a-button type="primary" @click="handlePrintDetail">打印详情</a-button>
    </div>

    <BasicDescription
      ref="descRef"
      :data="userData"
      :schema="detailSchema"
      :column="3"
      :bordered="true"
      class="description"
    />
  </div>
</template>
```

### 批量打印（多区域）

```ts
function handleBatchPrint() {
  // 创建一个临时容器，合并多个打印区域
  const container = document.createElement('div')
  container.innerHTML = `
    <h1 style="text-align:center">综合报表</h1>
    ${document.querySelector('#section-a')?.innerHTML || ''}
    <div style="page-break-after: always" />
    ${document.querySelector('#section-b')?.innerHTML || ''}
    <div style="page-break-after: always" />
    ${document.querySelector('#section-c')?.innerHTML || ''}
  `

  document.body.appendChild(container)

  usePrint({
    target: container,
    title: '综合报表',
    onAfterPrint: () => {
      document.body.removeChild(container)
    },
  })
}
```

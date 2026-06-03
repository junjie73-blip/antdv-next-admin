# Description 描述列表组件

Schema 驱动的描述列表组件，用于展示只读数据的键值对信息，对标 Vben Admin 的 Description 组件。

## 基础用法

```vue
<script setup lang="ts">
import { BasicDescription } from '@/components/business/Description'

const data = {
  name: '张三',
  age: 28,
  email: 'zhangsan@example.com',
  phone: '13800138000',
  address: '北京市朝阳区',
}

const schema = [
  { field: 'name', label: '姓名' },
  { field: 'age', label: '年龄' },
  { field: 'email', label: '邮箱' },
  { field: 'phone', label: '电话' },
  { field: 'address', label: '地址' },
]
</script>

<template>
  <BasicDescription :data="data" :schema="schema" :column="3" />
</template>
```

## 组件 Props

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| `title` | 标题文本 | `string` | - |
| `data` | 数据源对象 | `Recordable` | - |
| `schema` | 配置项数组 | `DescriptionItem[]` | - |
| `column` | 每行显示列数 | `number` | `3` |
| `size` | 尺寸 | `'small' \| 'default' \| 'large'` | `'default'` |
| `layout` | 布局方式 | `'horizontal' \| 'vertical'` | `'horizontal'` |
| `bordered` | 是否显示边框（表格模式） | `boolean` | `false` |
| `colon` | 是否显示冒号 | `boolean` | `true` |
| `loading` | 是否加载中 | `boolean` | `false` |
| `emptyText` | 空值占位文本 | `string` | `'-'` |
| `className` | 自定义类名 | `string` | - |
| `style` | 自定义样式 | `Record<string, string>` | - |

## 组件实例方法

通过 ref 调用：

```ts
const descriptionRef = ref<DescriptionInstance>()

// 获取当前数据
descriptionRef.value?.getData()

// 动态设置数据
descriptionRef.value?.setData(newData)
```

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `getData` | 获取当前数据源 | `Recordable \| undefined` |
| `setData` | 设置数据源 | `(data: Recordable) => void` |

## DescriptionItem 配置项

每个描述项的配置接口：

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| `field` | 字段名（必填） | `string` | - |
| `label` | 标签文本 | `string` | 使用 field 值 |
| `value` | 固定值（优先于 data 中取值） | `any` | 从 data 取值 |
| `show` | 是否显示 | `boolean` | `true` |
| `span` | 占据的列数 | `number` | `1` |
| `render` | 自定义内容渲染 | `(value, record) => VNodeChild` | - |
| `renderLabel` | 自定义标签渲染 | `(label, record) => VNodeChild` | - |
| `contentStyle` | 内容区域样式 | `Record<string, string>` | - |
| `labelStyle` | 标签区域样式 | `Record<string, string>` | - |

## 边框样式选项

### 无边框模式（默认）

使用 CSS Grid 布局，适合页面内嵌展示：

```vue
<BasicDescription
  :data="data"
  :schema="schema"
  :bordered="false"
  :column="3"
/>
```

效果为标签-内容的网格排列，无表格线。

### 有边框模式

使用 `<table>` 表格布局，适合详情弹窗/抽屉中的结构化展示：

```vue
<BasicDescription
  :data="data"
  :schema="schema"
  :bordered="true"
  :column="2"
/>
```

特点：
- 标签单元格带灰色背景 (`bg-gray-50`)
- 单元格间有边框分隔
- 支持跨行跨列 (`span` 属性)

## 列数自适应

### 固定列数

```vue
<!-- 2 列布局 -->
<BasicDescription :data="data" :schema="schema" :column="2" />

<!-- 4 列布局 -->
<BasicDescription :data="data" :schema="schema" :column="4" />
```

### 单独设置某项跨度

```ts
const schema = [
  { field: 'name', label: '姓名' },
  { field: 'email', label: '邮箱' },
  { field: 'remark', label: '备注', span: 3 }, // 占据 3 列宽度
]
```

## 自定义渲染

### 内容自定义渲染 (render)

```ts
const schema = [
  {
    field: 'status',
    label: '状态',
    render: (value) => h('a-tag', { color: value === 1 ? 'green' : 'red' }, [
      value === 1 ? '启用' : '禁用',
    ]),
  },
  {
    field: 'avatar',
    label: '头像',
    render: (value) => h('a-avatar', { src: value, size: 48 }),
  },
]
```

### 标签自定义渲染 (renderLabel)

```ts
const schema = [
  {
    field: 'name',
    renderLabel: (label) => h('span', { class: 'text-blue-500 font-medium' }, [label]),
  },
]
```

### 固定值覆盖

当不从 data 中取值时，直接指定 value：

```ts
const schema = [
  { field: 'source', label: '数据来源', value: '系统自动生成' },
  // 无论 data.source 是什么，都显示 "系统自动生成"
]
```

## 完整示例：用户详情页

```vue
<script setup lang="ts">
import { BasicDescription } from '@/components/business/Description'
import { ref, computed, h } from 'vue'
import { cn } from '@/utils/cn'

// 数据
const userData = ref({
  name: '张三',
  username: 'zhangsan',
  gender: 1,
  age: 28,
  phone: '13800138000',
  email: 'zhangsan@example.com',
  department: '技术研发部',
  position: '高级工程师',
  status: 1,
  createTime: '2024-01-15 10:30:00',
  lastLoginTime: '2024-06-03 09:15:00',
  remark: '负责前端架构设计工作',
})

// 配置
const baseSchema = [
  { field: 'name', label: '姓名' },
  { field: 'username', label: '用户名' },
  {
    field: 'gender',
    label: '性别',
    render: (val) => val === 1 ? '男' : '女',
  },
  { field: 'age', label: '年龄' },
  { field: 'phone', label: '联系电话' },
  { field: 'email', label: '电子邮箱' },
  { field: 'department', label: '所属部门' },
  { field: 'position', label: '职位' },
  {
    field: 'status',
    label: '账号状态',
    render: (val) =>
      h('a-tag', { color: val === 1 ? 'green' : 'red' }, [
        val === 1 ? '正常' : '禁用',
      ]),
  },
]

const extraSchema = [
  { field: 'createTime', label: '创建时间' },
  { field: 'lastLoginTime', label: '最后登录时间' },
  { field: 'remark', label: '备注', span: 3 },
]

const titleClassName = cn('text-lg font-semibold text-gray-900 mb-4')
</script>

<template>
  <div class="p-6 bg-white rounded-lg">
    <!-- 基本信息（无边框） -->
    <div :class="titleClassName">基本信息</div>
    <BasicDescription
      :data="userData"
      :schema="baseSchema"
      :column="4"
      :bordered="false"
    />

    <!-- 其他信息（有边框） -->
    <div :class="cn(titleClassName, 'mt-8')">其他信息</div>
    <BasicDescription
      :data="userData"
      :schema="extraSchema"
      :column="2"
      :bordered="true"
    />
  </div>
</template>
```

# 用户管理

用户管理模块提供完整的用户生命周期管理能力，包括用户信息的增删改查、角色分配、状态控制以及数据导入导出等功能。该模块采用**左侧部门树 + 右侧数据表格**的布局结构，支持多维度搜索和批量操作。

## 功能概述

| 功能 | 说明 |
|------|------|
| **CRUD 操作** | 支持新增、编辑、删除用户，表单验证完善 |
| **角色分配** | 新增/编辑时可选择用户角色（超级管理员/管理员/普通用户/运维人员） |
| **状态切换** | 支持正常/禁用两种状态，禁用用户无法登录系统 |
| **部门筛选** | 左侧部门树支持点击筛选，自动关联表格数据 |
| **数据导出** | 支持选中行 Excel 导出，包含 7 个核心字段 |
| **打印功能** | 调用浏览器打印功能，输出格式化用户列表 |

## 搜索条件

模块提供两个搜索维度，支持组合查询：

```typescript
const searchFormSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    componentProps: {
      placeholder: '搜索用户名/昵称/邮箱/手机号...',
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
        { label: '正常', value: 1 },
        { label: '禁用', value: 0 },
      ],
    },
    colProps: { span: 8 },
  },
]
```

**搜索逻辑说明：**
- **关键词搜索**：同时匹配 `username`、`nickname`、`email`、`phone` 四个字段（模糊匹配）
- **状态筛选**：精确匹配用户状态值（1=正常, 0=禁用）
- **部门关联**：点击左侧部门树节点时，自动按 `deptId` 过滤表格数据

## 表格列配置

```typescript
const columns: BasicColumn[] = [
  { title: '用户名', dataIndex: 'username', key: 'username', width: 120 },
  { title: '昵称', dataIndex: 'nickname', key: 'nickname', width: 120 },
  { title: '邮箱', dataIndex: 'email', key: 'email', width: 200, ellipsis: true },
  { title: '手机号', dataIndex: 'phone', key: 'phone', width: 140 },
  { title: '部门', dataIndex: 'deptName', key: 'deptName', width: 100, align: 'center' },
  { title: '角色', dataIndex: 'role', key: 'role', width: 120, align: 'center' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 170 },
]
```

### 状态列渲染

状态列使用 Tag 组件进行可视化展示，通过颜色和图标区分状态：

```typescript
const statusColorMap: Record<number, string> = {
  1: 'green',   // 正常 - 绿色
  0: 'red',     // 禁用 - 红色
}

const statusLabelMap: Record<number, string> = {
  1: '正常',
  0: '禁用',
}

// 模板中使用
<template #cell-status="{ record }">
  <a-tag :color="statusColorMap[record.status] || 'default'">
    <span :class="statusTagClassName">
      <Icon :icon="record.status === 1 ? 'carbon:checkmark-outline' : 'carbon:close-outline'" />
      {{ statusLabelMap[record.status] || '未知' }}
    </span>
  </a-tag>
</template>
```

## 操作列

每行数据提供两个操作按钮：

| 操作 | 图标 | 说明 |
|------|------|------|
| **编辑** | `ant-design:edit-outlined` | 打开编辑弹窗，回填当前用户数据 |
| **删除** | `ant-design:delete-outlined` | 二次确认后删除用户（危险操作，红色样式） |

```typescript
<template #action="{ record }">
  <div :class="actionClassName">
    <a-button type="link" :class="btnClassName" @click="() => handleEdit(record)">
      <template #icon><Icon icon="ant-design:edit-outlined" /></template>
      编辑
    </a-button>
    <a-divider type="vertical" :class="dividerClassName" />
    <a-button type="link" danger :class="btnClassName" @click="() => handleDelete(record)">
      <template #icon><Icon icon="ant-design:delete-outlined" /></template>
      删除
    </a-button>
  </div>
</template>
```

## 数据结构 (Mock)

### UserRecord 接口定义

```typescript
interface UserRecord {
  id: number           // 用户唯一标识
  username: string     // 登录用户名（唯一）
  nickname: string     // 显示昵称
  email: string        // 邮箱地址
  phone: string        // 手机号码
  deptName: string     // 部门名称（显示用）
  deptId: number       // 部门ID（关联用）
  status: number       // 状态：1=正常, 0=禁用
  role: string         // 角色名称（显示用）
  roleId: number       // 角色ID（关联用）
  remark: string       // 备注信息
  createdAt: string    // 创建时间（ISO 格式）
}
```

### 部门树结构

```typescript
interface DeptNode {
  id: number           // 部门ID
  name: string         // 部门名称
  children?: DeptNode[] // 子部门列表
}

// Mock 数据示例
const mockDeptTree: DeptNode[] = [
  {
    id: 1,
    name: '总公司',
    children: [
      { id: 2, name: '技术部' },
      { id: 3, name: '产品部' },
      { id: 4, name: '市场部' },
      { id: 5, name: '运营部' },
    ],
  },
]
```

### 角色选项配置

```typescript
const roleOptions = [
  { label: '超级管理员', value: 1 },
  { label: '管理员', value: 2 },
  { label: '普通用户', value: 3 },
  { label: '运维人员', value: 4 },
]
```

## 核心业务逻辑

### 新增用户

```typescript
function handleAdd() {
  isEditing.value = false
  currentRecord.value = null
  formMethods.setFieldsValue({
    username: '',
    nickname: '',
    password: '',
    email: '',
    phone:,
    deptId: undefined,
    roleId: undefined,
    status: 1,  // 默认正常状态
    remark: '',
  })
  formMethods.clearValidate()
  modalMethods.openModal()
}
```

### 编辑用户

```typescript
function handleEdit(record: UserRecord) {
  isEditing.value = true
  currentRecord.value = record
  formMethods.setFieldsValue({
    username: record.username,
    nickname: record.nickname,
    password: '',  // 密码置空，留空则不修改
    email: record.email,
    phone: record.phone,
    deptId: record.deptId,
    roleId: record.roleId,
    status: record.status,
    remark: record.remark,
  })
  formMethods.clearValidate()
  modalMethods.openModal()
}
```

### 保存逻辑（新增/编辑统一处理）

```typescript
async function handleSave() {
  const values = await formMethods.validate()
  if (!values) return

  if (!values.username || !values.nickname) {
    message.warning('请填写用户名和昵称')
    return
  }

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

  if (isEditing.value && currentRecord.value) {
    // 更新现有用户
    const idx = allData.value.findIndex(i => i.id === currentRecord.value!.id)
    if (idx > -1) {
      const dept = allDeptNodes.find(d => d.id === values.deptId)
      const role = roleOptions.find(r => r.value === values.roleId)
      allData.value[idx] = {
        ...allData.value[idx]!,
        username: values.username,
        nickname: values.nickname,
        email: values.email,
        phone: values.phone,
        deptId: values.deptId!,
        deptName: dept?.name || '',
        roleId: values.roleId!,
        role: role?.label || '',
        status: values.status,
        remark: values.remark,
      }
    }
    message.success(`已更新用户：${values.nickname}`)
  } else {
    // 新增用户
    const newId = Math.max(...allData.value.map(i => i.id), 0) + 1
    allData.value.push({
      id: newId,
      username: values.username,
      nickname: values.nickname,
      email: values.email,
      phone: values.phone,
      deptId: values.deptId!,
      deptName: dept?.name || '',
      roleId: values.roleId!,
      role: role?.label || '',
      status: values.status,
      remark: values.remark,
      createdAt: now,
    })
    message.success(`已新增用户：${values.nickname}`)
  }

  modalMethods.closeModal()
  tableMethods.value?.reload()
}
```

### Excel 导出功能

```typescript
function handleExport() {
  const selectedRows = tableMethods.value?.getSelectRows?.() || []

  if (selectedRows.length === 0) {
    message.warning('请先选择要导出的用户')
    return
  }

  const headers = ['用户名', '昵称', '邮箱', '手机号', '部门', '角色', '状态']
  const rows = selectedRows.map((i: UserRecord) => [
    i.username,
    i.nickname,
    i.email,
    i.phone,
    i.deptName,
    i.role,
    i.status === 1 ? '正常' : '禁用',
  ])

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [
    { wch: 12 },  // 用户名
    { wch: 12 },  // 昵称
    { wch: 24 },  // 邮箱
    { wch: 14 },  // 手机号
    { wch: 10 },  // 部门
    { wch: 12 },  // 角色
    { wch: 8 },   // 状态
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '用户列表')

  XLSX.writeFile(wb, `用户列表_${new Date().toISOString().slice(0, 10)}.xlsx`)
  message.success(`成功导出 ${selectedRows.length} 条数据`)
}
```

### Mock API 实现

```typescript
async function mockApi(params: Record<string, any>) {
  const { keyword, status, page = 1, pageSize = 10 } = params
  let filtered = [...allData.value]

  // 1. 部门筛选
  if (selectedDeptId.value !== null) {
    filtered = filtered.filter(i => i.deptId === selectedDeptId.value)
  }

  // 2. 关键词搜索（四字段模糊匹配）
  if (keyword) {
    const kw = String(keyword).toLowerCase()
    filtered = filtered.filter(
      i => i.username.toLowerCase().includes(kw)
        || i.nickname.toLowerCase().includes(kw)
        || i.email.toLowerCase().includes(kw)
        || i.phone.includes(kw),
    )
  }

  // 3. 状态筛选
  if (status !== undefined && status !== null && status !== '') {
    filtered = filtered.filter(i => i.status === Number(status))
  }

  // 4. 分页处理
  const total = filtered.length
  const start = (Number(page) - 1) * Number(pageSize)
  const items = filtered.slice(start, start + Number(pageSize))

  return { items, total }
}
```

## 表单配置（弹窗）

新增/编辑用户时使用的表单字段：

```typescript
const modalFormSchemas: FormSchema[] = [
  { field: 'username', label: '用户名', component: 'Input', required: true, colProps: { span: 12 } },
  { field: 'nickname', label: '昵称', component: 'Input', required: true, colProps: { span: 12 } },
  { field: 'password', label: '密码', component: 'InputPassword', colProps: { span: 12 } },
  { field: 'phone', label: '手机号', component: 'Input', colProps: { span: 12 } },
  { field: 'email', label: '邮箱', component: 'Input', colProps: { span: 24 } },
  { field: 'deptId', label: '部门', component: 'TreeSelect', colProps: { span: 12 } },
  { field: 'roleId', label: '角色', component: 'Select', colProps: { span: 12 } },
  { field: 'status', label: '状态', component: 'Select', colProps: { span: 12 } },
  { field: 'remark', label: '备注', component: 'Input', colProps: { span: 12 } },
]
```

## 技术要点

1. **组件使用**：采用项目封装的 `BasicTable`、`BasicModal`、`BasicForm` 业务组件
2. **样式规范**：所有类名通过 `cn()` 工具函数生成，遵循 Tailwind CSS 规范
3. **图标方案**：使用 `@iconify/vue` 的 Icon 组件，图标资源丰富
4. **数据处理**：前端 Mock 模式，数据存储在 `ref` 响应式变量中
5. **导出依赖**：Excel 导出使用 `xlsx` 库（SheetJS），支持自定义列宽

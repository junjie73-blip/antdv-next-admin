# 角色管理

角色管理模块是权限系统的核心组成部分，负责管理系统中的角色定义及其对应的菜单权限分配。该模块支持角色的完整生命周期管理，并提供可视化的权限树配置界面。

## 功能概述

| 功能 | 说明 |
|------|------|
| **CRUD 操作** | 支持角色的增删改查，包含编码唯一性校验 |
| **动态权限树** | 从菜单源数据动态生成权限树，支持父子级联勾选 |
| **菜单级权限** | 精确到菜单节点的权限控制，支持 4 大模块 16 个子菜单 |
| **状态切换** | 角色可设置为正常或停用状态，停用角色下的用户无法访问对应权限 |
| **编码保护** | 超级管理员角色（code=super_admin）禁止删除 |
| **数据导出** | 支持 Excel 格式导出角色列表及权限信息 |

## 权限树实现

### 菜单源数据结构

权限树的数据来源于 `menuSourceData` 配置，与系统的路由菜单保持同步：

```typescript
const menuSourceData = [
  {
    id: 1,
    title: '仪表盘',
    path: '/dashboard',
    children: [
      { id: 101, title: 'ECharts 仪表盘', path: 'echarts' },
      { id: 102, title: '工作台', path: 'workplace' },
    ],
  },
  {
    id: 2,
    title: '个人中心',
    path: '/account',
    children: [
      { id: 201, title: '个人信息', path: 'center' },
      { id: 202, title: '账户设置', path: 'settings' },
    ],
  },
  {
    id: 3,
    title: '系统设置',
    path: '/system',
    children: [
      { id: 301, title: '配置管理', path: 'config' },
      { id: 302, title: '用户管理', path: 'user' },
      { id: 303, title: '角色管理', path: 'role' },
      { id: 304, title: '字典管理', path: 'dict' },
      { id: 305, title: '菜单管理', path: 'menu' },
      { id: 306, title: '操作日志', path: 'log' },
      { id: 307, title: '在线用户', path: 'online' },
      { id: 308, title: '消息通知', path: 'notice' },
    ],
  },
  {
    id: 4,
    title: '组件演示',
    path: '/components',
    children: [
      { id: 401, title: '表单组件', path: 'form' },
      { id: 402, title: '表格组件', path: 'table' },
      { id: 403, title: '描述列表', path: 'description' },
      { id: 404, title: '弹窗抽屉', path: 'modal-drawer' },
    ],
  },
]
```

### 树形数据转换函数

将扁平的菜单配置转换为 Ant Design Vue 的 Tree 组件所需格式：

```typescript
interface MenuTreeNode {
  title: string
  key: string
  children?: MenuTreeNode[]
}

function buildMenuTree(menus: typeof menuSourceData): MenuTreeNode[] {
  return menus.map(menu => ({
    title: menu.title,
    key: String(menu.id),
    children: menu.children?.map(child => ({
      title: child.title,
      key: String(child.id),
    })),
  }))
}

// 计算属性：响应式生成权限树
const permissionTreeData = computed(() => buildMenuTree(menuSourceData))
```

## 角色数据结构

### RoleRecord 接口定义

```typescript
interface RoleRecord {
  id: number          // 角色唯一标识
  name: string        // 角色显示名称
  code: string        // 角色编码（唯一，用于权限判断）
  description: string // 角色描述信息
  sort: number        // 排序号（数字越小越靠前）
  status: number      // 状态：1=正常, 0=停用
  menuIds: number[]   // 已分配的菜单ID数组
  createdAt: string   // 创建时间
}
```

### Mock 数据示例

```typescript
const allData = ref<RoleRecord[]>([
  {
    id: 1,
    name: '超级管理员',
    code: 'super_admin',
    description: '拥有系统所有权限，不可删除',
    sort: 0,
    status: 1,
    menuIds: [1, 2, 3, 4, 5, 6, 7, 8],  // 全部权限
    createdAt: '2024-01-01 10:00:00',
  },
  {
    id: 2,
    name: '管理员',
    code: 'admin',
    description: '拥有大部分管理权限',
    sort: 1,
    status: 1,
    menuIds: [1, 2, 3, 5, 6],  // 部分权限
    createdAt: '2024-01-02 11:00:00',
  },
  {
    id: 3,
    name: '普通用户',
    code: 'user',
    description: '普通用户基础权限',
    sort: 2,
    status: 1,
    menuIds: [1, 7],  // 基础权限
    createdAt: '2024-01-03 12:00:00',
  },
])
```

## 菜单树勾选逻辑

在权限分配抽屉中，使用 `a-tree` 组件的 `checkable` 属性启用多选模式：

```vue
<BasicDrawer :title="`权限分配 - ${currentRecord?.name || ''}`" :width="480">
  <a-tree
    checkable
    default-expand-all
    :tree-data="permissionTreeData"
    :checked-keys="currentRecord?.menuIds || []"
    @check="(checkedKeys: any) => {
      if (currentRecord) {
        currentRecord.menuIds = checkedKeys
      }
    }"
  />

  <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
    <a-button type="primary" block @click="handleSavePermission">
      保存权限
    </a-button>
  </div>
</BasicDrawer>
```

**关键特性：**
- **默认展开**：`default-expand-all` 展开所有层级，方便查看完整权限结构
- **双向绑定**：`:checked-keys` 绑定当前角色的 `menuIds` 数组
- **实时更新**：`@check` 事件实时更新选中的菜单 ID
- **保存确认**：底部按钮触发保存操作，调用后端接口持久化权限配置

## 权限数据流

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   角色 CRUD  │────▶│  menuIds[]  │────▶│  路由守卫   │
│  (RoleRecord)│     │ (权限ID数组) │     │ (Permission)│
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
  角色管理页面        权限分配抽屉          动态路由生成
  (role/index.vue)   (permDrawer)         (router/guard)
```

**数据流转说明：**

1. **创建/编辑角色** → 设置基础信息（name/code/description/sort/status）
2. **分配权限** → 在权限树中勾选菜单节点，生成 `menuIds` 数组
3. **保存权限** → 将 `menuIds` 提交到后端，关联角色与菜单
4. **登录鉴权** → 根据用户的 `roles` 和 `permissions` 生成可访问路由表
5. **路由守卫** → 前端路由拦截，根据权限控制页面访问

## 表格列配置

```typescript
const columns: BasicColumn[] = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70, align: 'center' },
  { title: '角色名称', dataIndex: 'name', key: 'name', width: 140 },
  { title: '角色编码', dataIndex: 'code', key: 'code', width: 150 },
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '排序', dataIndex: 'sort', key: 'sort', width: 70, align: 'center' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 170 },
]
```

## 操作列

每个角色提供四个操作按钮：

| 操作 | 图标 | 说明 | 保护机制 |
|------|------|------|----------|
| **权限** | `ant-design:safety-certificate-outlined` | 打开权限分配抽屉 | 无 |
| **编辑** | `ant-design:edit-outlined` | 打开编辑抽屉 | 无 |
| **启用/停用** | 文字按钮 | 切换角色状态 | 二次确认 |
| **删除** | `ant-design:delete-outlined` | 删除角色记录 | super_admin 禁止删除 |

```typescript
// 删除时的保护逻辑
function handleDelete(record: RoleRecord) {
  if (record.code === 'super_admin') {
    message.warning('超级管理员角色不允许删除')
    return
  }
  // ... 执行删除
}

// 状态切换逻辑
function handleToggleStatus(record: RoleRecord) {
  const item = allData.value.find(i => i.id === record.id)
  if (item) {
    item.status = item.status === 1 ? 0 : 1
    message.success(`已${item.status === 1 ? '启用' : '停用'}：${item.name}`)
    tableMethods.value?.reload()
  }
}
```

## 搜索条件

```typescript
const searchFormSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    colProps: { span: 8 },
    componentProps: {
      placeholder: '搜索角色名称/编码...',
      allowClear: true,
    },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    colProps: { span: 8 },
    componentProps: {
      placeholder: '选择状态',
      allowClear: true,
      options: [
        { label: '正常', value: 1 },
        { label: '停用', value: 0 },
      ],
    },
  },
]
```

## 表单配置（抽屉）

### 基本信息

```typescript
const drawerFormSchemas: FormSchema[] = [
  {
    field: 'name',
    label: '角色名称',
    component: 'Input',
    required: true,
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入角色名称' },
  },
  {
    field: 'code',
    label: '角色编码',
    component: 'Input',
    required: true,
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入角色编码，如 admin' },
  },
  {
    field: 'description',
    label: '描述',
    component: 'InputTextArea',
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入角色描述...', rows: 3 },
  },
  {
    field: 'sort',
    label: '排序',
    component: 'InputNumber',
    colProps: { span: 24 },
    defaultValue: 0,
    componentProps: { min: 0, placeholder: '数字越小越靠前', style: { width: '100%' } },
  },
  {
    field: 'status',
    label: '状态',
    component: 'RadioGroup',
    colProps: { span: 24 },
    defaultValue: 1,
    componentProps: {
      optionType: 'button',
      buttonStyle: 'solid',
      options: [
        { label: '正常', value: 1 },
        { label: '停用', value: 0 },
      ],
    },
  },
]
```

## 核心业务逻辑

### 编码唯一性校验

```typescript
async function handleSave() {
  const values = await formMethods.validate()
  if (!values) return

  if (!values.name || !values.code) {
    message.warning('请填写角色名称和编码')
    return
  }

  // 检查编码是否已存在（排除自身）
  const existing = allData.value.find(
    i => i.code === values.code
      && (!currentRecord.value || i.id !== currentRecord.value.id),
  )
  if (existing) {
    message.warning(`角色编码 "${values.code}" 已存在`)
    return
  }

  // ... 执行保存逻辑
}
```

### Excel 导出配置

```typescript
function handleExport() {
  const selectedRows = (tableMethods.value?.getSelectRows?.() || []) as any[]
  const dataToExport = selectedRows.length > 0 ? selectedRows : allData.value

  exportToExcel({
    filename: '角色列表',
    sheetName: '角色管理',
    columns: [
      { header: 'ID', key: 'id', width: 8 },
      { header: '角色名称', key: 'name', width: 15 },
      { header: '角色编码', key: 'code', width: 18 },
      { header: '描述', key: 'description', width: 30 },
      { header: '排序', key: 'sort', width: 8 },
      { header: '状态', key: 'status', width: 8 },
      { header: '创建时间', key: 'createdAt', width: 20 },
    ],
    data: dataToExport.map(i => ({ ...i, status: i.status === 1 ? '正常' : '停用' })),
  })
}
```

## 技术要点

1. **双抽屉设计**：基本信息编辑和权限分配分别使用独立的 Drawer 实例，职责清晰
2. **计算属性优化**：权限树数据使用 `computed` 响应式生成，菜单变更时自动更新
3. **编码约束**：角色编码作为系统内部的权限标识符，要求全局唯一且不可重复
4. **级联选择**：Tree 组件默认支持父子的级联勾选，选中父节点自动包含子节点
5. **状态映射**：使用颜色标签直观展示角色状态，提升用户体验

# Modal 弹窗组件

基于 [Antdv Next Modal](https://antdv-next.com/components/modal) 封装的高级弹窗组件，支持拖拽移动、全屏切换、高度自适应等功能。

## 基础用法

```vue
<script setup lang="ts">
import { BasicModal } from '@/components/business/Modal'
import { useModal } from '@/components/business/Modal/useModal'

const [register, { openModal, closeModal, setModalProps }] = useModal()

function handleOpen() {
  openModal(true, { id: 1 }) // 第二个参数可传递数据
}

function handleOk() {
  // 处理确认逻辑...
  closeModal()
}
</script>

<template>
  <a-button type="primary" @click="handleOpen">打开弹窗</a-button>

  <BasicModal
    title="用户信息"
    :register="register"
    @ok="handleOk"
  >
    <p>弹窗内容区域</p>
  </BasicModal>
</template>
```

## 组件 Props

### 基础属性

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| `open` | 是否显示（支持 v-model:open） | `boolean` | `false` |
| `title` | 弹窗标题 | `string` | - |
| `helpMessage` | 标题右侧提示文本 | `string \| string[]` | - |
| `width` | 弹窗宽度 | `string \| number` | `'520px'` |
| `height` | 固定高度 | `number` | - |
| `minHeight` | 最小高度 | `number` | - |

### 显示控制

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| `useWrapper` | 启用内容包装器（自适应高度） | `boolean` | `true` |
| `centered` | 居中显示 | `boolean` | `true` |
| `closable` | 显示关闭按钮 | `boolean` | `true` |
| `maskClosable` | 点击蒙层关闭 | `boolean` | `true` |
| `keyboard` | ESC 键关闭 | `boolean` | `true` |
| `mask` | 显示蒙层 | `boolean` | `true` |
| `destroyOnHidden` | 关闭时销毁内容 | `boolean` | `false` |
| `zIndex` | 层级 | `number` | `1000` |

### 按钮配置

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| `showCancelBtn` | 显示取消按钮 | `boolean` | `true` |
| `showOkBtn` | 显示确认按钮 | `boolean` | `true` |
| `cancelText` | 取消按钮文本 | `string` | `'关闭'` |
| `okText` | 确认按钮文本 | `string` | `'保存'` |
| `okType` | 确认按钮类型 | `'primary' \| 'danger' ...` | `'primary'` |
| `okButtonProps` | 确认按钮 Props | `ButtonProps` | - |
| `cancelButtonProps` | 取消按钮 Props | `ButtonProps` | - |

### Loading 状态

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| `loading` | 弹窗 Loading 状态 | `boolean` | `false` |
| `loadingTip` | Loading 提示文本 | `string` | - |

### 样式属性

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| `wrapperFooterOffset` | 底部偏移量 | `number` | `0` |
| `maskStyle` | 蒙层样式 | `CSSProperties` | - |
| `bodyStyle` | 内容区样式 | `CSSProperties` | - |
| `dialogStyle` | 对话框样式 | `CSSProperties` | - |
| `wrapClassName` | 包裹层类名 | `string` | - |

### 回调函数

| 属性 | 说明 | 类型 |
|------|------|------|
| `closeFunc` | 关闭前回调，返回 true 才允许关闭 | `() => Promise<boolean>` |
| `afterClose` | 关闭后回调 | `() => void` |

## 组件事件

| 事件名 | 说明 | 回调参数 |
|--------|------|----------|
| `register` | 注册弹窗实例 | `(instance: ModalMethods) => void` |
| `ok` | 点击确认按钮 | `(e: MouseEvent) => void` |
| `cancel` | 点击取消/关闭按钮 | `(e: MouseEvent) => void` |
| `visible-change` | 显示状态变化 | `(visible: boolean) => void` |
| `update:open` | v-model 更新事件 | `(visible: boolean) => void` |

## 组件插槽

| 插槽名 | 说明 | 位置 |
|--------|------|------|
| **默认插槽** | 弹窗主体内容 | 内容区域 |
| `titleTip` | 标题右侧额外内容 | 标题栏右侧 |
| `footer` | 完全自定义底部 | 底部区域（优先级最高） |
| `insertFooter` | 取消按钮之前 | 底部操作区 |
| `centerFooter` | 取消和确认之间 | 底部操作区 |
| `appendFooter` | 确认按钮之后 | 底部操作区 |

## useModal API

`useModal` 是声明式操控弹窗的核心 Hook，返回 `[register, methods]` 元组：

```ts
const [register, methods] = useModal()
```

### Methods 方法列表

| 方法 | 说明 | 参数 | 返回值 |
|------|------|------|--------|
| `openModal` | 打开弹窗 | `<T>(visible?: boolean, data?: T)` | `void` |
| `closeModal` | 关闭弹窗 | - | `void` |
| `setModalProps` | 动态修改 props | `(props: Partial<ModalProps>)` | `void` |
| `getVisible` | 获取当前显示状态 | - | `boolean` |

## useModalInner API

在弹窗内部使用的 Hook，提供更多内部操作能力：

```ts
const [registerInner, innerMethods] = useModalInner()
```

### Inner Methods 额外方法

| 方法 | 说明 | 参数 |
|------|------|------|
| `closeModal` | 关闭弹窗 | - |
| `setModalProps` | 动态修改 props | `(props: Partial<ModalProps>)` |
| `changeOkLoading` | 切换确认按钮 loading 状态 | `(loading: boolean)` |
| `changeLoading` | 切换弹窗 loading 状态 | `(loading: boolean)` |

## 功能详解

### 拖拽移动

默认启用，按住弹窗头部即可拖拽。通过 `draggable` prop 控制：

```vue
<!-- 禁用拖拽 -->
<BasicModal :draggable="false" ... />
```

拖拽实现原理：
- 仅在 `.modal-header` 区域触发拖拽
- 使用 `transform: translate()` 实现位移
- 全屏模式下自动禁用拖拽
- 弹窗关闭时自动重置位置

### 全屏切换

默认可通过头部按钮切换全屏模式：

```vue
<!-- 禁用全屏功能 -->
<BasicModal :can-fullscreen="false" ... />

<!-- 默认全屏 -->
<BasicModal :default-fullscreen="true" ... />
```

全屏时添加 `fullscreen-modal` CSS 类，可据此自定义样式。

### 高度自适应

当 `useWrapper=true`（默认）时，弹窗内容区域会根据视口高度自适应：

- 未设置固定 `height` 时：`maxHeight = 视口高度 - 120px - footerOffset`
- 设置了固定 `height` 时：使用指定高度
- 监听窗口 resize 事件动态调整

```vue
<!-- 固定高度 600px -->
<BasicModal :height="600" ... />

<!-- 设置底部偏移量 -->
<BasicModal :wrapper-footer-offset="80" ... />
```

### 关闭拦截

通过 `closeFunc` 拦截关闭行为，适合有未保存数据时的二次确认场景：

```vue
<script setup lang="ts">
const hasUnsavedChanges = ref(false)

async function beforeClose(): Promise<boolean> {
  if (hasUnsavedChanges.value) {
    const confirmed = await Modal.confirm({
      title: '提示',
      content: '有未保存的更改，确定要关闭吗？',
    })
    return !!confirmed
  }
  return true
}
</script>

<template>
  <BasicModal
    :close-func="beforeClose"
    ...
  />
</template>
```

## 典型使用场景

### 表单编辑弹窗

```vue
<script setup lang="ts">
import { BasicModal } from '@/components/business/Modal'
import { BasicForm } from '@/components/business/Form'
import { useModal } from '@/components/business/Modal/useModal'
import { useModalInner } from '@/components/business/Modal/useModalInner'

// 外部调用
const [register, { openModal }] = useModal()

// 内部处理
const [registerModal, { closeModal, changeOkLoading }] = useModalInner()

const schemas = [
  { field: 'name', label: '名称', component: 'Input', required: true },
  { field: 'desc', label: '描述', component: 'InputTextArea' },
]

async function handleSubmit(values: Recordable) {
  changeOkLoading(true)
  try {
    await api.saveUser(values)
    message.success('保存成功')
    closeModal()
  }
  finally {
    changeOkLoading(false)
  }
}

defineExpose({ openModal })
</script>

<template>
  <!-- 外部触发 -->
  <a-button type="primary" @click="openModal(true)">编辑</a-button>

  <!-- 弹窗 -->
  <BasicModal title="编辑用户" :register="registerModal" @ok="handleSubmit">
    <BasicForm :schemas="schemas" @register="register" @submit="handleSubmit" />
  </BasicModal>
</template>
```

### 详情查看弹窗

```vue
<script setup lang="ts">
const [register, { openModal, setModalProps }] = useModal()

function showDetail(record: any) {
  setModalProps({ title: `详情 - ${record.name}`, showOkBtn: false })
  openModal(true, record)
}
</script>

<template>
  <BasicModal :register="register">
    <template #default="{ data }">
      <BasicDescription :data="data" :schema="detailSchema" />
    </template>
  </BasicModal>
</template>
```

### 确认删除弹窗

```vue
<script setup lang="ts">
const [register, { openModal, setModalProps }] = useModal()

function confirmDelete(id: string) {
  setModalProps({
    title: '确认删除',
    okText: '删除',
    okType: 'danger',
  })
  openModal(true, { id })
}

async function handleDelete(data: { id: string }) {
  await api.deleteUser(data.id)
  message.success('删除成功')
}
</script>

<template>
  <BasicModal
    :register="register"
    :show-cancel-btn="true"
    @ok="(e) => handleDelete(e)"
  >
    <p class="text-center py-4">确定要删除该条数据吗？此操作不可恢复。</p>
  </BasicModal>
</template>
```

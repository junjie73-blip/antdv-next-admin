# LockScreen 锁屏组件

全屏锁屏界面组件，使用 `Teleport` 传送到 body，支持密码验证、大时钟显示、按任意键唤醒等功能。

## 基础用法

```vue
<script setup lang="ts">
import { LockScreen } from '@/components/LockScreen'
import { ref } from 'vue'

const visible = ref(false)

// 5 分钟无操作自动锁屏
let timer: ReturnType<typeof setTimeout>
function resetTimer() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    visible.value = true
  }, 5 * 60 * 1000)
}

// 监听用户活动
onMounted(() => {
  window.addEventListener('mousemove', resetTimer)
  window.addEventListener('keydown', resetTimer)
})
</script>

<template>
  <LockScreen v-model:visible="visible" @unlock="handleUnlock" />
</template>
```

## 组件 Props

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| `visible` | 是否显示（v-model:visible） | `boolean` | `false` |

## 组件事件

| 事件名 | 说明 | 回调参数 |
|--------|------|----------|
| `update:visible` | 显示状态变化 | `(value: boolean) => void` |
| `unlock` | 解锁成功 | - |

## 组件 Slots

LockScreen 当前为固定布局，暂不暴露自定义插槽。

## 功能详解

### 密码验证流程

```
用户输入密码 → 点击解锁 / 按 Enter
       ↓
  显示 loading 验证中...
       ↓
  ┌─────────────┬──────────────┐
  │ 密码正确     │ 密码错误      │
  ├─────────────┼──────────────┤
  │ 关闭锁屏     │ 提示错误信息   │
  │ 触发 unlock  │ 保持显示      │
  │ 清空密码框   │              │
  └─────────────┴──────────────┘
```

当前实现为 Mock 验证逻辑：任何非空密码均通过验证。实际项目中应替换为真实的后端接口调用：

```ts
async function handleUnlock() {
  loading.value = true
  try {
    // 替换为实际验证接口
    const result = await api.verifyPassword(password.value)
    if (result.success) {
      password.value = ''
      emit('update:visible', false)
      emit('unlock')
      message.success('解锁成功')
    }
    else {
      message.error('密码错误')
    }
  }
  finally {
    loading.value = false
  }
}
```

### 大时钟显示

锁屏界面中央展示实时时钟，使用原生 `Date` API 格式化：

```
        14:32:08          ← 时:分:秒 (7xl, 超细字重)

   2026年6月3日 星期二    ← 年月日 星期 (lg, 半透明)
```

**实现细节：**
- 使用 `setInterval` 每秒更新时间
- 时间格式：24 小时制 (`hour12: false`)
- 日期格式包含：年份、月份、日期、星期
- 锁屏激活时启动定时器，关闭时清理定时器

```ts
function updateTime() {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour12: false })
  currentDate.value = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })
}
```

### 按任意键唤醒功能

当锁屏处于显示状态时，按下键盘任意键即可自动聚焦到密码输入框：

```ts
function handleAnyKeyDown(e: KeyboardEvent) {
  // 忽略功能键组合 (Ctrl/Alt/Meta)
  if (e.ctrlKey || e.altKey || e.metaKey) return
  // 聚焦密码输入框
  const inputEl = document.querySelector('.lock-screen-password-input input') as HTMLInputElement
  if (inputEl && document.activeElement !== inputEl) {
    inputEl.focus()
  }
}
```

**设计意图：** 用户回到电脑前，随意敲击键盘就能直接输入密码，无需先点击输入框。

### CSS 过渡动画

锁屏组件使用 Vue `<Transition>` 实现淡入淡出效果：

```css
/* 过渡动画 - fade + scale */
.lock-fade-enter-active,
.lock-fade-leave-active {
  transition: opacity 0.3s ease;
}

.lock-fade-enter-from,
.lock-fade-leave-to {
  opacity: 0;
}
```

动画效果：
- **进入时**：从透明渐变到完全不透明（0.3s ease）
- **离开时**：从不透明渐变到透明（0.3s ease）

### Teleport to body 实现

使用 Vue 3 的 `<Teleport>` 将锁屏组件传送到 `<body>` 底部，确保：

1. **脱离正常文档流** — 不受父容器 `overflow: hidden` 等限制
2. **层级最高** — 通过 `z-[9999]` 确保覆盖所有内容
3. **固定定位生效** — `fixed inset-0` 正确覆盖整个视口

```vue
<Teleport to="body">
  <Transition name="lock-fade">
    <div v-if="visible" class="fixed inset-0 z-[9999]">
      <!-- 锁屏内容 -->
    </div>
  </Transition>
</Teleport>
```

### 视觉设计

#### 背景层

- 全屏背景图片（默认 Unsplash 高清风景图）
- 渐变遮罩叠加：从左上 `black/70%` 到右下 `black/90%`
- 使用 `object-cover` 确保图片填满且不变形

```vue
<div class="absolute inset-0">
  <img :src="bgImage" class="w-full h-full object-cover" />
  <div class="absolute inset-0 bg-gradient-to-br from-black/70 via-gray-900/80 to-black/90" />
</div>
```

#### 输入框样式

密码输入框采用毛玻璃风格：
- 半透明白色背景 `rgba(255,255,255,0.1)`
- 白色文字和占位符
- 聚焦时蓝色边框光晕
- 高度 48px，适合触摸操作

```css
:deep(.lock-screen-password-input .ant-input) {
  background-color: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: white;
  height: 48px;
  font-size: 16px;
}
```

#### 用户信息展示

- 头像：56px 圆形，取用户名首字母作为初始头像
- 用户名：白色粗体
- 提示文本：半透明白色 "请输入密码解锁屏幕"

## 完整集成示例

### 在 Layout 中集成自动锁屏

```vue
<script setup lang="ts">
import { LockScreen } from '@/components/LockScreen'
import { ref, onMounted, onUnmounted } from 'vue'

const isLocked = ref(false)
let lockTimer: ReturnType<typeof setTimeout> | null = null
const LOCK_DELAY = 5 * 60 * 1000 // 5 分钟

function startLockTimer() {
  clearLockTimer()
  lockTimer = setTimeout(() => {
    isLocked.value = true
  }, LOCK_DELAY)
}

function clearLockTimer() {
  if (lockTimer) {
    clearTimeout(lockTimer)
    lockTimer = null
  }
}

// 监听用户活动
function handleUserActivity() {
  if (!isLocked.value) {
    startLockTimer()
  }
}

onMounted(() => {
  window.addEventListener('mousemove', handleUserActivity)
  window.addEventListener('keydown', handleUserActivity)
  window.addEventListener('click', handleUserActivity)
  startLockTimer()
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleUserActivity)
  window.removeEventListener('keydown', handleUserActivity)
  window.removeEventListener('click', handleUserActivity)
  clearLockTimer()
})

function handleUnlock() {
  startLockTimer() // 解锁后重新计时
}
</script>

<template>
  <!-- 主应用 -->
  <DefaultLayout />

  <!-- 锁屏层 -->
  <LockScreen v-model:visible="isLocked" @unlock="handleUnlock" />
</template>
```

# 锁屏保护

项目内置 **LockScreen** 锁屏保护组件，提供类似操作系统锁屏的安全保护功能。当用户暂时离开时，可快速锁定屏幕，返回时需输入密码解锁。

## 组件概览

```
LockScreen 组件结构
├── Teleport to body（挂载到 body 根节点）
│   └── Transition (lock-fade 过渡动画)
│       └── 全屏遮罩容器 (fixed inset-0 z-[9999])
│           ├── 背景层
│           │   ├── 背景图片 (全屏 cover)
│           │   └── 渐变遮罩 (from black/70 via gray-900/80 to black/90)
│           ├── 内容区 (max-w-md, 居中)
│           │   ├── 大时钟显示
│           │   │   ├── 时间 (text-7xl, 每秒更新)
│           │   │   └── 日期 (年月日 星期)
│           │   ├── 用户信息
│           │   │   ├── 头像 (56px)
│           │   │   ├── 用户名
│           │   │   └── 提示文字
│           │   ├── 密码输入框 (Input.Password)
│           │   ├── 解锁按钮
│           │   └── 底部提示 (按任意键唤醒)
│           └── 底部装饰 (安全锁定标识)
```

---

## Props

| 参数 | 类型 | 默认值 | 必填 | 说明 |
|------|------|--------|------|------|
| `visible` | `boolean` | - | ✅ | 控制锁屏界面的显示/隐藏 |

### 使用示例

```vue
<script setup lang="ts">
import { ref } from 'vue'
import LockScreen from '@/components/LockScreen/index.vue'

const lockScreenVisible = ref(false)

// 手动触发锁屏
function triggerLock() {
  lockScreenVisible.value = true
}

// 解锁成功回调
function onUnlock() {
  console.log('屏幕已解锁')
}
</script>

<template>
  <LockScreen
    v-model:visible="lockScreenVisible"
    @unlock="onUnlock"
  />

  <a-button @click="triggerLock">
    <Icon icon="carbon:locked" /> 锁定屏幕
  </a-button>
</template>
```

---

## Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `update:visible` | `value: boolean` | 可见性双向绑定（v-model:visible） |
| `unlock` | - | 密码验证成功、解锁完成时触发 |

### 事件使用示例

```vue
<template>
  <LockScreen
    v-model:visible="isLocked"
    @unlock="handleUnlockSuccess"
  />
</template>

<script setup lang="ts">
const isLocked = ref(false)

function handleUnlockSuccess() {
  // 解锁后可执行的逻辑
  // 如：刷新页面数据、延长会话时间等
  refreshUserData()
}
</script>
```

---

## Slots

当前版本 LockScreen 未暴露插槽。如需自定义内容（如背景图、底部装饰），可直接修改组件源码或通过 CSS 覆盖。

---

## 锁屏触发方式

### 1. 手动触发（按钮/快捷键）

通过 Header 组件的锁屏按钮触发：

```vue
<!-- LayoutHeader.vue 中的锁屏入口 -->
<a-tooltip title="锁定屏幕">
  <a-button
    class="flex items-center justify-center"
    @click="showLockScreen = true"
  >
    <Icon icon="carbon:locked" />
  </a-button>
</a-tooltip>

<LockScreen
  v-model:visible="showLockScreen"
  @unlock="handleUnlock"
/>
```

### 2. 自动锁屏（定时器）

可实现基于用户无操作的自动锁屏：

```ts
// composables/web/useAutoLock.ts
import { ref, onUnmounted } from 'vue'

export function useAutoLock(timeoutMinutes = 30) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastActivity = Date.now()

  function resetTimer() {
    if (timer) clearTimeout(timer)
    lastActivity = Date.now()
    timer = setTimeout(triggerLock, timeoutMinutes * 60 * 1000)
  }

  function triggerLock() {
    emit('lock')
  }

  // 监听用户活动
  const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
  events.forEach(event => {
    window.addEventListener(event, resetTimer, { passive: true })
  })

  onUnmounted(() => {
    if (timer) clearTimeout(timer)
    events.forEach(event => {
      window.removeEventListener(event, resetTimer)
    })
  })

  return { resetTimer, triggerLock }
}
```

### 3. 系统可见性 API 锁屏

结合 Page Visibility API，当用户切换标签页超过阈值时自动锁定：

```ts
import { useDocumentVisibility } from '@vueuse/core'

const visibility = useDocumentVisibility()
let hiddenTime: number | null = null

watch(visibility, (val) => {
  if (val === 'hidden') {
    hiddenTime = Date.now()
  }
  else if (val === 'visible' && hiddenTime) {
    const elapsed = Date.now() - hiddenTime
    if (elapsed > 5 * 60 * 1000) { // 离开超过 5 分钟
      lockScreenVisible.value = true
    }
    hiddenTime = null
  }
})
```

---

## 密码验证流程

### 验证流程图

```
用户输入密码
     │
     ▼
┌─ 密码非空校验 ───┐
│  空？            │
│  ├─ 是 → message.warning('请输入密码')
│  └─ 否 ↓
└─────────────────┘
     │
     ▼
┌─ 设置 loading=true ─┐
│  模拟验证延迟 800ms  │
└──────────┬───────────┘
           │
           ▼
┌─ 密码长度校验 ────┐
│  length > 0 ？     │
│  ├─ 是 → 验证通过  │
│  │    ├─ 清空密码  │
│  │    ├─ emit(update:visible, false)
│  │    ├─ emit(unlock)
│  │    └─ message.success('解锁成功')
│  └─ 否 → message.error('密码错误')
└────────────────────┘
     │
     ▼
  loading = false
```

### 源码实现

```ts
// src/components/LockScreen/index.vue
function handleUnlock() {
  if (!password.value) {
    message.warning('请输入密码')
    return
  }

  loading.value = true

  // 模拟验证延迟（实际项目中替换为 API 调用）
  setTimeout(() => {
    // Mock 验证：任何非空密码都通过
    if (password.value.length > 0) {
      password.value = ''
      emit('update:visible', false)
      emit('unlock')
      message.success('解锁成功')
    }
    else {
      message.error('密码错误')
    }
    loading.value = false
  }, 800)
}
```

### 接入真实验证 API

```ts
async function handleUnlock() {
  if (!password.value) {
    message.warning('请输入密码')
    return
  }

  loading.value = true

  try {
    const res = await http.Post('/auth/unlock', {
      password: password.value,
    })

    if (res.code === 200) {
      password.value = ''
      emit('update:visible', false)
      emit('unlock')
      message.success('解锁成功')
    }
    else {
      message.error(res.message || '密码错误')
    }
  }
  catch {
    message.error('验证失败，请重试')
  }
  finally {
    loading.value = false
  }
}
```

---

## 按任意键唤醒功能

### 实现原理

锁屏显示时，组件会在 `document` 上注册全局键盘监听器。按下任意键（排除组合键 Ctrl/Alt/Meta）时，自动聚焦到密码输入框：

```ts
// 全局键盘监听（按任意键唤醒）
function handleAnyKeyDown(e: KeyboardEvent) {
  // 忽略功能键组合，避免误触
  if (e.ctrlKey || e.altKey || e.metaKey) return

  // 聚焦密码输入框
  const inputEl = document.querySelector(
    '.lock-screen-password-input input',
  ) as HTMLInputElement

  if (inputEl && document.activeElement !== inputEl) {
    inputEl.focus()
  }
}
```

### 注册与清理

```ts
watch(
  () => props.visible,
  (val) => {
    if (val) {
      // 锁屏显示时：注册键盘监听
      document.addEventListener('keydown', handleAnyKeyDown)
      // 自动聚焦密码框（延迟等待 DOM 渲染完成）
      setTimeout(() => {
        const inputEl = document.querySelector(
          '.lock-screen-password-input input',
        ) as HTMLInputElement
        inputEl?.focus()
      }, 300)
    }
    else {
      // 锁屏隐藏时：移除键盘监听
      document.removeEventListener('keydown', handleAnyKeyDown)
      password.value = ''  // 清空密码
    }
  },
)
```

### Enter 键提交

密码输入框同时支持回车键触发表单提交：

```ts
function handleKeyPress(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    handleUnlock()
  }
}
```

模板中的绑定：

```vue
<Input.Password
  v-model:value="password"
  class="lock-screen-password-input"
  placeholder="请输入登录密码"
  size="large"
  :loading="loading"
  @press-enter="handleUnlock"
/>
```

---

## 大时钟显示实现

### 时间更新机制

锁屏显示时启动定时器，每秒更新一次时间和日期：

```ts
const currentTime = ref('')
const currentDate = ref('')
let timeTimer: ReturnType<typeof setInterval> | null = null

function updateTime() {
  const now = new Date()

  // 24 小时制时间：HH:mm:ss
  currentTime.value = now.toLocaleTimeString('zh-CN', {
    hour12: false,
  })

  // 完整日期：YYYY年M月D日 星期X
  currentDate.value = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })
}
```

### 定时器生命周期

```ts
watch(
  () => props.visible,
  (val) => {
    if (val) {
      updateTime()              // 立即更新一次
      timeTimer = setInterval(updateTime, 1000)  // 每秒更新
    }
    else {
      if (timeTimer) {
        clearInterval(timeTimer)  // 清除定时器
        timeTimer = null
      }
    }
  },
)

// 组件卸载时确保清除定时器（防御性编程）
onUnmounted(() => {
  if (timeTimer) clearInterval(timeTimer)
})
```

### 显示效果

```
        14:32:07          ← text-7xl font-extralight tracking-wider
  2026年6月3日 星期二      ← text-lg text-white/60 font-light
```

---

## CSS 过渡动画

### 淡入淡出动画

锁屏界面使用 Vue `<Transition>` 组件实现平滑的淡入淡出效果：

```css
/* 进入/离开 过渡 */
.lock-fade-enter-active,
.lock-fade-leave-active {
  transition: opacity 0.3s ease;
}

/* 进入起始 / 离开结束：完全透明 */
.lock-fade-enter-from,
.lock-fade-leave-to {
  opacity: 0;
}
```

### 模板使用

```vue
<Teleport to="body">
  <Transition name="lock-fade">
    <div v-if="visible" class="fixed inset-0 z-[9999] overflow-hidden">
      <!-- 锁屏内容 -->
    </div>
  </Transition>
</Teleport>
```

### 为什么使用 Teleport

- **脱离父组件 DOM 层级** — 锁屏遮罩需要覆盖全屏（`fixed inset-0`），如果放在普通组件树中可能被父级的 `overflow: hidden` 裁剪
- **z-index 最高优先级** — 通过 `z-[9999]` 确保锁屏层在最顶层
- **避免样式污染** — 锁屏的绝对定位不会影响父组件布局

### 密码输入框样式覆盖

锁屏场景下，密码输入框需要特殊的视觉样式（半透明背景、白色文字）：

```css
:deep(.lock-screen-password-input .ant-input) {
  background-color: rgba(255, 255, 255, 0.1);  /* 半透明背景 */
  border-color: rgba(255, 255, 255, 0.2);      /* 半透明边框 */
  color: white;                                   /* 白色文字 */
  height: 48px;                                   /* 更高的输入框 */
  font-size: 16px;
}

:deep(.lock-screen-password-input .ant-input::placeholder) {
  color: rgba(255, 255, 255, 0.4);  /* 浅色占位符 */
}

:deep(.lock-screen-password-input .ant-input:hover),
:deep(.lock-screen-password-input .ant-input:focus) {
  border-color: rgba(22, 119, 255, 0.6);  /* 聚焦时蓝色边框 */
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.15);
}
```

### 解锁按钮样式

```vue
<button
  :disabled="loading || !password"
  :class="cn(
    'w-full py-3 rounded-lg text-white font-medium',
    'transition-all duration-200',
    'bg-primary hover:bg-primary/90 active:scale-[0.98]',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'focus:outline-none focus:ring-2 focus:ring-primary/50',
  )"
>
  <!-- 正常状态 -->
  <span v-if="!loading">解锁</span>
  <!-- 加载状态：旋转图标 + 文字 -->
  <span v-else class="flex items-center justify-center gap-2">
    <Icon icon="carbon:renew" class="animate-spin" />
    验证中...
  </span>
</button>
```

---

## 完整使用示例

### 在布局中集成

```vue
<!-- layouts/DefaultLayout.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import LockScreen from '@/components/LockScreen/index.vue'
import LayoutHeader from './components/LayoutHeader.vue'

const lockScreenVisible = ref(false)

function handleUnlock() {
  // 可在此刷新用户会话、更新最后活动时间等
  console.log('屏幕已解锁')
}
</script>

<template>
  <div class="h-screen flex">
    <!-- 正常布局内容 -->
    <LayoutSidebar />
    <div class="flex-1 flex flex-col">
      <LayoutHeader @lock-screen="lockScreenVisible = true" />
      <main class="flex-1 overflow-auto p-4">
        <router-view />
      </main>
    </div>
  </div>

  <!-- 锁屏层（Teleport 到 body） -->
  <LockScreen
    v-model:visible="lockScreenVisible"
    @unlock="handleUnlock"
  />
</template>
```

### Header 中的锁屏入口

```vue
<!-- layouts/components/LayoutHeader.vue -->
<script setup lang="ts">
const showLockScreen = defineModel<boolean>('showLockScreen')
</script>

<template>
  <header class="flex items-center justify-between h-full px-4">
    <!-- 左侧：面包屑等 -->
    <div>...</div>

    <!-- 右侧：操作按钮组 -->
    <div class="flex items-center gap-2">
      <!-- 搜索、通知、全屏... -->

      <!-- 锁屏按钮 -->
      <a-tooltip title="锁定屏幕 (Ctrl+L)">
        <a-button
          class="flex items-center justify-center"
          @click="showLockScreen = true"
        >
          <Icon icon="carbon:locked" />
        </a-button>
      </a-tooltip>

      <!-- 用户头像、设置等 -->
    </div>
  </header>
</template>
```

### 快捷键支持（扩展）

可为锁屏添加全局快捷键支持：

```ts
// composables/web/useLockShortcut.ts
import { onMounted, onUnmounted } from 'vue'

export function useLockShortcut(onLock: () => void) {
  function handleKeyDown(e: KeyboardEvent) {
    // Ctrl + L / Cmd + L 锁定屏幕
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
      e.preventDefault()
      onLock()
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })
}
```

---

## 注意事项

::: tip 使用建议
- **ESC 键不关闭锁屏** — 这是安全设计，防止意外解锁
- **密码输入框自动聚焦** — 锁屏出现后延迟 300ms 聚焦，确保 DOM 渲染完成
- **定时器清理** — 组件在 `onUnmounted` 中双重保障清理定时器和事件监听
- **Teleport 挂载点** — 始终挂载到 `body`，确保全屏覆盖不被裁剪
:::

::: warning 安全提醒
- 当前版本使用 Mock 验证（任何非空密码均通过），生产环境**必须接入真实 API**
- 建议增加密码错误次数限制，超过阈值触发账号临时锁定
- 密码传输应使用加密通道（HTTPS），敏感场景考虑 SM 加密
:::

# 主题系统

本项目提供了灵活强大的主题定制能力，支持 **亮色/暗色切换**、**多套主题风格**、**自定义主题色**、**圆角调节** 以及 **无障碍辅助模式**。

## 主题架构总览

```
App.vue
  └── ConfigProvider (:theme="themeConfig")
        ├── algorithm（算法：default/dark/compact）
        ├── token（Design Token）
        └── components（组件级覆盖）

settings/theme.ts
  └── THEME_PRESETS（预设主题集合）
        ├── default / dark / compact
        ├── mui / shadcn / cartoon / illustration
        ├── bootstrap / skeuomorphism / glass / geek
        └── getThemeConfig() → ThemeConfig
```

---

## 亮色/暗色模式切换

### 切换原理

暗色模式通过两套机制协同工作：

1. **HTML class 切换** — 为 `<html>` 元素添加/移除 `dark` 类，驱动 Tailwind CSS 暗色样式
2. **Antdv Next Algorithm 切换** — 将 `darkAlgorithm` 注入 ConfigProvider，驱动组件库暗色主题

### 实现代码

```vue
<!-- App.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { getThemeConfig } from '@/settings/theme'
import { useAppStore } from '@/stores/modules/app'

const appStore = useAppStore()

// 生成 Antdv Next 主题配置
const themeConfig = computed(() => getThemeConfig(
  appStore.themeStyle,
  appStore.themeMode === 'dark',  // 是否暗色
  appStore.borderRadius,
  appStore.primaryColor,
))

// HTML class 管理（驱动 Tailwind 暗色模式）
const htmlClass = computed(() => {
  const classes: string[] = []
  if (appStore.themeMode === 'dark') classes.push('dark')
  if (appStore.colorWeak) classes.push('color-weak')
  if (appStore.grayMode) classes.push('gray-mode')
  return classes.join(' ')
})
</script>
```

### 切换方法

```ts
// stores/modules/app.ts
const toggleTheme = () => {
  updateSetting({ theme: appSetting.value.theme === 'light' ? 'dark' : 'light' })
}
```

### 在组件中使用

```vue
<script setup lang="ts">
import { useAppStore } from '@/stores/modules/app'
import { cn } from '@/utils/cn'

const appStore = useAppStore()

const cardClassName = cn(
  'bg-white', 'text-gray-900', 'shadow-sm',
  'dark:bg-gray-800', 'dark:text-gray-100',
)
</script>

<template>
  <a-button @click="appStore.toggleTheme()">
    {{ appStore.themeMode === 'dark' ? '🌙 暗色' : '☀️ 亮色' }}
  </a-button>
  <div :class="cardClassName">自适应明暗的内容卡片</div>
</template>
```

---

## 12 种主题风格说明

项目内置 **12 套预设主题风格**，每套风格包含独立的配色方案和组件参数。

### 风格一览表

| 风格 Key | 名称 | 主色调 | 圆角 | 特点 |
|----------|------|--------|------|------|
| `default` | 默认风格 | `#1677ff` | 6px | 经典蓝调，企业标准 |
| `dark` | 暗黑风格 | `#1677ff` | 6px | 深色背景，护眼 |
| `compact` | 紧凑风格 | `#1677ff` | 4px | 密集布局，信息密度高 |
| `mui` | 类 MUI 风格 | `#1976d2` | 4px | Material Design 质感 |
| `shadcn` | 类 shadcn 风格 | `#0f172a` | 6px | 现代简约，中性色系 |
| `cartoon` | 卡通风格 | `#ff6b6b` | 16px | 明艳活泼，圆润可爱 |
| `illustration` | 插画风格 | `#845ef7` | 12px | 紫调艺术感 |
| `bootstrap` | 类 Bootstrap | `#0d6efd` | 4px | 经典蓝绿，兼容性强 |
| `skeuomorphism` | 拟物化风格 | `#5c5c5c` | 8px | 仿真质感，怀旧风格 |
| `glass` | 玻璃风格 | `#667eea` | 12px | 毛玻璃效果，通透感 |
| `geek` | 极客风格 | `#00ff88` | 2px | 黑底绿字，终端美学 |

### 各风格详细配置

#### 默认风格 (default)

```ts
default: {
  algorithm: defaultAlgorithm,
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 6,
  },
},
```

#### 暗黑风格 (dark)

```ts
dark: {
  algorithm: darkAlgorithm,  // 使用暗色算法
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 6,
  },
},
```

#### 紧凑风格 (compact)

```ts
compact: {
  algorithm: compactAlgorithm,  // 紧凑算法
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 4,
  },
  components: {
    Button: { controlHeight: 28, paddingContentHorizontal: 12 },
    Input: { controlHeight: 28, paddingInline: 8 },
    Select: { controlHeight: 28 },
    Table: { cellPaddingInline: 8, cellPaddingBlock: 8 },
  },
},
```

#### 极客风格 (geek)

```ts
geek: {
  algorithm: darkAlgorithm,  // 基于暗色算法
  token: {
    colorPrimary: '#00ff88',    // 经典终端绿
    borderRadius: 2,            // 尖锐边角
    colorBgBase: '#0a0a0a',     // 纯黑背景
    colorTextBase: '#00ff88',   // 绿色文字
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',  // 等宽字体
  },
  components: {
    Button: { controlHeight: 36 },
    Input: { controlHeight: 36 },
  },
},
```

#### 玻璃风格 (glass)

```ts
glass: {
  algorithm: defaultAlgorithm,
  token: {
    colorPrimary: '#667eea',
    borderRadius: 12,
    colorBgContainer: 'rgba(255, 255, 255, 0.72)',   // 半透明白
    colorBgElevated: 'rgba(255, 255, 255, 0.85)',     // 半透明浮层
  },
},
```

---

## 自定义主题色配置

### 通过 SettingDrawer 配置

项目内置 **设置抽屉 (SettingDrawer)**，可在界面中实时调整主题色：

```vue
<!-- LayoutHeader.vue 中的触发入口 -->
<a-button @click="showSetting = true">
  <Icon icon="carbon:settings" /> 设置
</a-button>
<SettingDrawer v-model:open="showSetting" />
```

### 代码中动态修改

```ts
import { useAppStore } from '@/stores/modules/app'

const appStore = useAppStore()

// 修改主题色
appStore.updateSetting({ primaryColor: '#722ed1' })

// 修改圆角
appStore.updateSetting({ borderRadius: 12 })

// 切换主题风格
appStore.updateSetting({ themeStyle: 'geek' })

// 切换明暗
appStore.toggleTheme()
```

### CSS 变量同步

主题色变更时会同步更新 CSS 变量，确保非组件库部分也能感知变化：

```ts
// App.vue
watch(
  () => appStore.primaryColor,
  (color) => {
    document.documentElement.style.setProperty('--ant-color-primary', color)
  },
  { immediate: true },
)
```

### 在样式中使用 CSS 变量

```css
/* 自定义组件可引用 Antdv Next 的 CSS 变量 */
.my-custom-button {
  background-color: var(--ant-color-primary);
  border-radius: var(--ant-border-radius);
}
```

---

## 圆角设置

全局圆角通过 `borderRadius` 配置项控制，影响所有 Antdv Next 组件：

```ts
// 可选值范围：0 ~ 16+
const borderRadiusOptions = [
  { label: '无圆角', value: 0 },
  { label: '小圆角', value: 2 },
  { label: '默认圆角', value: 6 },
  { label: '中大圆角', value: 8 },
  { label: '大圆角', value: 12 },
  { label: '超大圆角', value: 16 },
]

// 使用
appStore.updateSetting({ borderRadius: 12 })
```

---

## 色弱模式

色弱模式通过 CSS 滤镜实现，帮助色觉障碍用户更好地识别界面内容：

```ts
// App.vue 中的 class 处理
if (appStore.colorWeak)
  classes.push('color-weak')

// 全局 CSS（通常在 base 样式中定义）
html.color-weak {
  filter: invert(80%);
}
```

### 切换方法

```ts
appStore.toggleColorWeak()
```

### 效果说明

启用色弱模式后，整个页面会应用颜色反转滤镜，提高色彩对比度，使色弱用户能区分原本难以分辨的颜色差异。

---

## 灰度模式

灰度模式将整个界面转为灰色调，适用于特殊场景（如哀悼日）：

```ts
// App.vue 中的 class 处理
if (appStore.grayMode)
  classes.push('gray-mode')

// 全局 CSS
html.gray-mode {
  filter: grayscale(100%);
}
```

### 切换方法

```ts
appStore.toggleGrayMode()
```

---

## 水印功能

项目集成了 `watermark-plus` 库，支持页面水印功能。

### 配置项

```ts
// settings/index.ts
export const DEFAULT_SETTING: AppSetting = {
  enableWatermark: false,              // 是否启用水印
  watermarkContent: 'Admin',           // 水印文字内容
}
```

### useWatermark 组合式函数

```ts
// src/composables/web/useWatermark.ts
import { useWatermark } from '@/composables/web/useWatermark'

const {
  watermarkInstance,
  createWatermark,     // 创建水印
  destroyWatermark,    // 销毁水印
  updateWatermark,     // 更新水印内容
} = useWatermark({
  content: watermarkContent,  // 水印文字
  enabled: enableWatermark,  // 是否启用
})
```

### 默认水印参数

```ts
const defaultOptions = {
  width: 200,          // 水印宽度
  height: 150,         // 水印高度
  rotate: 330,         // 旋转角度
  alpha: 0.15,         // 透明度
  fontSize: 14,        // 字体大小
  fontWeight: 'normal',
  fontFamily: 'sans-serif',
  color: '#666666',    // 水印颜色
}
```

### 在布局中使用

```vue
<!-- DefaultLayout.vue -->
<script setup lang="ts">
import { useWatermark } from '@/composables/web/useWatermark'
import { useAppStore } from '@/stores/modules/app'

const appStore = useAppStore()

useWatermark({
  content: () => appStore.watermarkContent,
  enabled: () => appStore.enableWatermark,
})
</script>
```

### 动态控制

```ts
// 切换水印开关
appStore.toggleWatermark()

// 修改水印文字
appStore.updateSetting({ watermarkContent: '机密文件' })
```

---

## CSS 变量体系

Antdv Next 基于 Design Token 体系运行，所有设计参数都映射为 CSS 变量。以下是常用的 CSS 变量：

### 颜色变量

| CSS 变量 | 说明 | 默认值 |
|----------|------|--------|
| `--ant-color-primary` | 主题色 | `#1677ff` |
| `--ant-color-success` | 成功色 | `#52c41a` |
| `--ant-color-warning` | 警告色 | `#faad14` |
| `--ant-color-error` | 错误色 | `#ff4d4f` |
| `--ant-color-info` | 信息色 | `#1677ff` |
| `--ant-color-text-base` | 基础文本色 | `rgba(0, 0, 0, 0.88)` |
| `--ant-color-bg-container` | 容器背景色 | `#ffffff` |
| `--ant-color-bg-elevated` | 浮层背景色 | `#ffffff` |
| `--ant-color-border` | 边框色 | `#d9d9d9` |

### 尺寸变量

| CSS 变量 | 说明 |
|----------|------|
| `--ant-border-radius` | 全局圆角 |
| `--ant-font-family` | 字体族 |
| `--ant-font-size` | 基础字号 |
| `--ant-control-height` | 控件高度 |

### 自定义 CSS 变量覆盖

```vue
<style scoped>
.custom-panel {
  /* 使用 Antdv Next 的 CSS 变量保持一致 */
  background-color: var(--ant-color-bg-container);
  border: 1px solid var(--ant-color-border);
  border-radius: var(--ant-border-radius);
  color: var(--ant-color-text-base);
}

.custom-panel:hover {
  border-color: var(--ant-color-primary);
}
</style>
```

---

## 主题切换动画

项目提供了带过渡动画的主题切换体验：

```ts
// src/composables/web/useThemeTransition.ts
export function useThemeTransition() {
  const toggleThemeWithAnimation = () => {
    // 添加过渡 class
    document.documentElement.classList.add('theme-transitioning')

    // 执行切换
    appStore.toggleTheme()

    // 移除过渡 class
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning')
    }, 500)
  }

  return { toggleThemeWithAnimation }
}
```

```css
/* 过渡动画 */
.theme-transitioning,
.theme-transitioning * {
  transition:
    background-color 0.3s ease,
    color 0.3s ease,
    border-color 0.3s ease !important;
}
```

---

## 完整配置参考

```ts
// settings/index.ts — AppSetting 完整接口
interface AppSetting {
  /** 主题模式：light / dark */
  theme: ThemeMode
  /** 主题风格 */
  themeStyle: ThemeStyle
  /** 组件尺寸：small / middle / large */
  componentSize: ComponentSize
  /** 布局模式 */
  layout: LayoutMode
  /** 侧边栏暗色 */
  darkSidebar: boolean
  /** 顶栏暗色 */
  darkHeader: boolean
  /** 色弱模式 */
  colorWeak: boolean
  /** 灰度模式 */
  grayMode: boolean
  /** 全局圆角 */
  borderRadius: number
  /** 主题色 */
  primaryColor: string
  /** 水印开关 */
  enableWatermark: boolean
  /** 水印内容 */
  watermarkContent: string
  /** ... 更多配置 */
}
```

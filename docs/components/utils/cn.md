# 类名合并工具 (cn)

基于 [clsx](https://github.com/lukeed/clsx) + [tailwind-merge](https://github.com/dcastil/tailwind-merge) 的类名合并工具函数，用于安全地合并 Tailwind CSS 类名。

## 函数原理

```ts
// 源码实现（@/utils/cn/index.ts）
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

### clsx 的作用

`clsx` 负责将各种类型的输入合并为字符串：

```ts
import { clsx } from 'clsx'

clsx('foo', 'bar')           // → 'foo bar'
clsx('foo', { bar: true })   // → 'foo bar'
clsx('foo', { bar: false })  // → 'foo'
clsx({ foo: true, bar: true }) // → 'foo bar'
clsx(['foo', 'bar'])         // → 'foo bar'
```

支持输入类型：
- 字符串：直接拼接
- 对象：值为 truthy 时取 key
- 数组：递归处理
- null/undefined：自动忽略

### tailwind-merge 的作用

`twMerge` 解决 Tailwind CSS 类名冲突问题——后面的类名会智能覆盖前面的同类属性，而非简单追加：

```ts
import { twMerge } from 'tailwind-merge'

// ❌ 普通拼接：两个 padding 类同时存在，后者无效
'px-4 py-2 px-8'  // px-4 和 px-8 同时存在

// ✅ twMerge：自动检测冲突并去重
twMerge('px-4 py-2 px-8')  // → 'py-2 px-8' (px-4 被 px-8 覆盖)
```

**冲突检测覆盖的 Tailwind 类别：**
- 布局：`flex`, `grid`, `block`, `inline`
- 间距：`p-*`, `m-*`, `px-*`, `py-*`, `mt-*`, `mb-*` 等
- 尺寸：`w-*`, `h-*`, `max-w-*`, `min-h-*` 等
- 颜色：`text-*`, `bg-*`, `border-*` 等
- 排版：`text-sm`, `text-lg`, `font-bold` 等
- 其他：`rounded-*`, `shadow-*`, `opacity-*` 等

## 为什么禁止模板中直接写 Tailwind 类名

本项目有明确的编码规范（见 `.trae/rules/project_rules.md`）：

> **禁止在标签上编写 Tailwindcss 类名，而是使用 `cn` 函数。禁止将 `cn` 函数的参数写在模板中。**

### 错误写法 ❌

```vue
<!-- 直接在模板中写类名 -->
<div class="bg-red-500 text-white p-4 rounded">内容</div>

<!-- 在模板中调用 cn -->
<div :class="cn('bg-red-500', 'text-white')">内容</div>
```

### 正确写法 ✅

```vue
<script setup lang="ts">
import { cn } from '@/utils/cn'

// 在 script 中定义类名变量
const cardClassName = cn(
  'bg-red-500',
  'text-white',
  'p-4',
  'rounded',
)
</script>

<template>
  <!-- 在模板中使用变量绑定 -->
  <div :class="cardClassName">内容</div>
</template>
```

### 这样做的好处

1. **逻辑集中** — 类名计算逻辑集中在 `<script>` 中，模板更简洁
2. **可复用** — 类名变量可以在多处使用，避免重复
3. **可调试** — 可以在 script 中打断点检查最终生成的类名字符串
4. **条件组合更清晰** — 复杂的条件类名在 script 中处理更直观
5. **符合 Vue 3 最佳实践** — 减少模板中的复杂表达式

## 使用规范

### 基础用法：script 中定义 → 模板绑定

```vue
<script setup lang="ts">
import { cn } from '@/utils/cn'

const buttonClassName = cn(
  'px-4 py-2 rounded-lg font-medium transition-colors',
  'bg-blue-500 text-white hover:bg-blue-600 active:scale-[0.98]',
)
</script>

<template>
  <button :class="buttonClassName">点击我</button>
</template>
```

### 条件类名写法

使用对象语法传入条件类名：

```vue
<script setup lang="ts">
import { cn } from '@/utils/cn'

const props = defineProps<{
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}>()

const buttonClassName = computed(() =>
  cn(
    // 基础样式
    'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',

    // 尺寸变体
    props.size === 'sm' && 'px-3 py-1.5 text-sm',
    props.size === 'md' && 'px-4 py-2 text-base',
    props.size === 'lg' && 'px-6 py-3 text-lg',

    // 颜色变体
    props.variant === 'primary' && 'bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500',
    props.variant === 'secondary' && 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500',
    props.variant === 'danger' && 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',

    // 禁用状态
    props.disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
  ),
)
</script>

<template>
  <button :class="buttonClassName" :disabled="disabled">
    <slot />
  </button>
</template>
```

### 响应式断点类名

Tailwind CSS v4 的响应式前缀同样可以通过 `cn` 合并：

```vue
<script setup lang="ts">
import { cn } from '@/utils/cn'

const gridClassName = cn(
  'grid gap-4',
  'grid-cols-1',       // 默认单列
  'sm:grid-cols-2',    // sm 断点以上 2 列
  'lg:grid-cols-3',    // lg 断点以上 3 列,
)

const responsiveText = cn(
  'text-sm sm:text-base lg:text-lg',
  'text-center sm:text-left',
)
</script>

<template>
  <div :class="gridClassName">
    <div v-for="item in items" :key="item.id" :class="responsiveText">
      {{ item.title }}
    </div>
  </div>
</template>
```

### 与动态样式的结合

`cn` 返回的是字符串，可以和内联 style 共存：

```vue
<script setup lang="ts">
import { cn } from '@/utils/cn'

const props = defineProps<{ color: string; width: number }()

const boxClassName = cn(
  'rounded-lg shadow-md transition-all duration-300',
  'hover:shadow-lg hover:-translate-y-1',
)

const boxStyle = computed(() => ({
  backgroundColor: props.color,
  width: `${props.width}px`,
}))
</script>

<template>
  <div :class="boxClassName" :style="boxStyle" />
</template>
```

### 工具函数封装模式

对于常用的组件样式，可以封装成工具函数：

```ts
// @/styles/button.ts
import { cn } from '@/utils/cn'

export function buttonVariants(variant: string, size: string) {
  return cn(
    'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
    // variant 映射
    {
      primary: 'bg-blue-500 text-white hover:bg-blue-600',
      secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
      ghost: 'hover:bg-gray-100 text-gray-700',
      outline: 'border border-gray-300 hover:bg-gray-50',
    }[variant],
    // size 映射
    {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-6 text-base',
    }[size],
  )
}
```

```vue
<!-- 使用 -->
<script setup lang="ts">
import { buttonVariants } from '@/styles/button'

const className = buttonVariants('primary', 'md')
</script>

<template>
  <button :class="className">提交</button>
</template>
```

## 常见陷阱与解决方案

### 陷阱 1：动态拼接类名导致冲突

```ts
// ❌ 有潜在冲突风险
const className = `p-${size} bg-${color}`

// ✅ 使用完整的类名字符串或条件判断
const className = cn(
  size === 'sm' && 'p-2',
  size === 'md' && 'p-4',
  size === 'lg' && 'p-6',
  color === 'red' && 'bg-red-500',
  color === 'blue' && 'bg-blue-500',
)
```

> 动态拼接部分类名（如 `p-${size}`）无法被 tailwind-merge 正确解析，且可能在生产构建时被 purge 掉。

### 陷阱 2：数组展开后传给 cn

```ts
// ✅ 完全没问题 — cn 支持任意嵌套
const baseClasses = ['flex', 'items-center']
const className = cn(baseClasses, 'p-4', { hidden: isHidden })
```

### 陷阱 3：与其他 CSS 方案混用

```ts
// 如果需要同时使用非 Tailwind 类名（如第三方组件库）
const className = cn(
  'p-4 rounded-lg',          // Tailwind 类名
  'ant-form-item',            // 第三方类名
  isActive && 'is-active',     // 条件状态类名
)
// cn 会保留非 Tailwind 类名不变，只对 Tailwind 类名做合并优化
```

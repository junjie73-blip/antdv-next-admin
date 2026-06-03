# CountTo 数字动画组件

数字滚动动画组件，对标 Vben Admin 的 CountTo，使用 `requestAnimationFrame` 实现高性能平滑动画。常用于统计卡片、数据大屏等场景。

## 基础用法

```vue
<script setup lang="ts">
import { CountTo } from '@/components/business/CountTo'
</script>

<template>
  <!-- 从 0 滚动到 2024 -->
  <CountTo :start-val="0" :end-val="2024" />

  <!-- 带前缀后缀 -->
  <CountTo :end-val="99.9" prefix="¥" suffix="%" :decimals="1" />
</template>
```

## 组件 Props

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| `startVal` | 起始值 | `number` | `0` |
| `endVal` | 结束值（目标值） | `number` | `0` |
| `duration` | 动画持续时间（毫秒） | `number` | `2000` |
| `autoplay` | 是否自动播放 | `boolean` | `true` |
| `decimals` | 小数位数 | `number` | `0` |
| `decimal` | 小数点符号 | `string` | `'.'` |
| `separator` | 千分位分隔符 | `string` | `','` |
| `prefix` | 前缀文本 | `string` | `''` |
| `suffix` | 后缀文本 | `string` | `''` |
| `useEasing` | 是否使用缓动函数 | `boolean` | `true` |
| `easingFn` | 缓动函数类型 | `'easeOutExpo' \| 'linear' \| 'easeInOutCubic'` | `'easeOutExpo'` |
| `className` | 自定义类名 | `string` | - |
| `style` | 自定义样式 | `Record<string, string>` | - |

## 组件事件

| 事件名 | 说明 | 回调参数 |
|--------|------|----------|
| `finished` | 动画结束 | - |
| `change` | 数值变化中 | `(value: number) => void` |

## 组件实例方法

通过 ref 调用：

```ts
const countToRef = ref<CountToInstance>()

// 手动开始动画
countToRef.value?.start()

// 暂停动画
countToRef.value?.pause()

// 重置并重新开始
countToRef.value?.reset()

// 获取当前显示的值
const current = countToRef.value?.getCurrentValue()
```

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `start` | 开始动画 | `void` |
| `pause` | 暂停动画 | `void` |
| `reset` | 重置动画 | `void` |
| `getCurrentValue` | 获取当前值 | `number` |

## 动画缓动效果

内置三种缓动函数：

### easeOutExpo（默认）— 指数缓出

快速启动，逐渐减速，适合大多数数字滚动场景。

```
速度曲线：███▊▋▌▍▎▏░░░░  (先快后慢)
```

### linear — 线性匀速

匀速滚动，适合需要精确控制时间的场景。

```
速度曲线：████████████  (恒定速度)
```

### easeInOutCubic — 三次缓入缓出

慢速启动 → 加速 → 减速停止，最自然的运动感。

```
速度曲线：░░███▊░░  (先慢后快再慢)
```

## 格式化功能

### 千分位分隔符

```vue
<CountTo :end-val="1234567" />
<!-- 输出：1,234,567 -->
```

自定义分隔符：
```vue
<CountTo :end-val="1234567" separator=" " />
<!-- 输出：1 234 567 -->
```

禁用分隔符：
```vue
<CountTo :end-val="1234567" separator="" />
<!-- 输出：1234567 -->
```

### 小数位数

```vue
<CountTo :end-val="3.1415926" :decimals="4" />
<!-- 输出：3.1416 -->
```

### 前缀和后缀

```vue
<CountTo
  :end-val="12800"
  prefix="¥"
  suffix=".00"
/>
<!-- 输出：¥12,800.00 -->

<CountTo
  :end-val="98"
  suffix="%"
/>
<!-- 输出：98% -->

<CountTo
  :end-val="256"
  prefix="+"
/>
<!-- 输出：+256 -->
```

### 自定义小数点符号

```vue
<CountTo :end-val="99.9" decimal="," :decimals="1" />
<!-- 输出：99,9 -->
```

## 使用场景

### 统计卡片数字滚动

这是 CountTo 最常见的使用场景——Dashboard 统计面板中的数据卡片：

```vue
<script setup lang="ts">
import { CountTo } from '@/components/business/CountTo'
import { cn } from '@/utils/cn'

const cardClassName = cn(
  'bg-white rounded-xl p-6 shadow-sm',
  'border border-gray-100',
)

const valueClassName = cn('text-3xl font-bold text-gray-900')

const labelClassName = cn(
  'text-sm text-gray-500 mt-2',
)
</script>

<template>
  <div class="grid grid-cols-4 gap-6">
    <!-- 用户总数 -->
    <div :class="cardClassName">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-500">用户总数</p>
          <p :class="valueClassName">
            <CountTo :end-val="12680" :duration="2500" />
          </p>
        </div>
        <div class="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
          <span class="i-carbon-user text-blue-500 text-2xl" />
        </div>
      </div>
      <p :class="labelClassName">
        较昨日 <span class="text-green-500">+12.5%</span>
      </p>
    </div>

    <!-- 访问量 -->
    <div :class="cardClassName">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-500">今日访问</p>
          <p :class="valueClassName">
            <CountTo :end-val="88462" separator="" />
          </p>
        </div>
        <div class="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
          <span class="i-carbon-chart-line text-green-500 text-2xl" />
        </div>
      </div>
      <p :class="labelClassName">
        较昨日 <span class="text-green-500">+8.2%</span>
      </p>
    </div>

    <!-- 销售额 -->
    <div :class="cardClassName">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-500">销售额(万)</p>
          <p :class="valueClassName text-orange-500">
            <CountTo :end-val="368.5" prefix="¥" :decimals="1" />
          </p>
        </div>
        <div class="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center">
          <span class="i-carbon-currency text-orange-500 text-2xl" />
        </div>
      </div>
      <p :class="labelClassName">
        目标完成 <span class="text-orange-500">76.8%</span>
      </p>
    </div>

    <!-- 转化率 -->
    <div :class="cardClassName">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-500">转化率</p>
          <p :class="valueClassName">
            <CountTo :end-val="68.3" suffix="%" :decimals="1" />
          </p>
        </div>
        <div class="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
          <span class="i-carbon-percentage text-purple-500 text-2xl" />
        </div>
      </div>
      <p :class="labelClassName">
        较上周 <span class="text-red-500">-2.1%</span>
      </p>
    </div>
  </div>
</template>
```

### 数据大屏展示

配合大屏背景和样式：

```vue
<script setup lang="ts">
import { CountTo } from '@/components/business/CountTo'
import { cn } from '@/utils/cn'

const bigNumberClass = cn(
  'text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-500',
  'bg-clip-text text-transparent',
)
</script>

<template>
  <div class="bg-slate-900 rounded-2xl p-8 min-h-[300px] flex flex-col items-center justify-center">
    <p class="text-gray-400 text-lg mb-4">实时在线用户</p>
    <p :class="bigNumberClass">
      <CountTo
        :end-val="38492"
        :duration="3000"
        :autoplay="false"
        ref="counterRef"
      />
    </p>
    <button
      class="mt-6 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      @click="counterRef?.reset(); counterRef?.start()"
    >
      重新播放
    </button>
  </div>
</template>
```

### 动态数值更新

当 `endVal` 发生变化时，若 `autoplay=true`，动画会自动重新播放：

```vue
<script setup lang="ts">
import { CountTo } from '@/components/business/CountTo'
import { ref, onMounted } from 'vue'

const targetValue = ref(0)

onMounted(async () => {
  // 模拟从接口获取数据
  const data = await api.getStatistics()
  targetValue.value = data.totalUsers // 触发自动重播
})
</script>

<template>
  <CountTo :end-val="targetValue" :autoplay="true" />
</template>
```

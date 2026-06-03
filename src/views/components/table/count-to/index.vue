<script setup lang="ts">
import { ref } from 'vue'
import { CountTo } from '@/components/business/CountTo'
import { cn } from '@/utils/cn'

// 容器类名
const containerClassName = cn('space-y-6')

// 页面标题区域
const pageHeaderClassName = cn('mb-2')
const pageTitleClassName = cn('text-2xl font-bold text-gray-800 dark:text-gray-100')
const pageDescClassName = cn('text-gray-500 dark:text-gray-400 mt-1')

// 卡片 extra 提示文字
const cardExtraClassName = cn('text-sm text-gray-400')

// 基础用法 - 数字展示区域
const numberCardClassName = cn(
  'flex flex-col items-center p-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg',
)
const numberLabelClassName = cn('text-sm text-gray-500 mb-2')
const numberValueClassName = cn('text-3xl font-bold')

// 小数精度展示
const decimalGridClassName = cn('grid grid-cols-1 md:grid-cols-4 gap-6')

// 前缀后缀 - 渐变背景卡片
function prefixCardClassName(color: string) {
  return cn(
    'flex flex-col items-center p-6 rounded-lg border',
    color,
  )
}

// 分隔符展示
const separatorGridClassName = cn('grid grid-cols-1 md:grid-cols-3 gap-6')

// 正负数展示
function signCardClassName(color: string) {
  return cn(
    'flex flex-col items-center p-6 rounded-lg border',
    color,
  )
}
const signLabelClassName = cn('text-sm text-gray-500 mb-2')
const signChangeClassName = cn('text-xs mt-1')

// 缓动函数对比
const easingContainerClassName = cn('space-y-6')
const easingCardClassName = cn('p-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg')
const easingHeaderClassName = cn('flex justify-between items-center mb-3')
const easingNameClassName = cn('font-medium text-gray-700 dark:text-gray-300')
const easingDescClassName = cn('text-sm text-gray-400')
const easingDisplayClassName = cn(
  'h-16 flex items-center bg-white dark:bg-gray-900 rounded p-2',
)
const easingValueClassName = cn('text-xl font-mono font-bold w-full text-center')

// 数据看板面板
interface DashboardItem {
  title: string
  value: number
  prefix: string
  suffix: string
  icon: string
  bgColor: string
  textColor: string
}

const dashboardData: DashboardItem[] = [
  {
    title: '总用户数',
    value: 892156,
    prefix: '',
    suffix: '人',
    icon: '👥',
    bgColor: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30',
    textColor: 'text-blue-600',
  },
  {
    title: '日活跃',
    value: 128456,
    prefix: '',
    suffix: '',
    icon: '📈',
    bgColor: 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30',
    textColor: 'text-green-600',
  },
  {
    title: '总收入',
    value: 998888,
    prefix: '¥',
    suffix: '',
    icon: '💰',
    bgColor: 'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-800/30',
    textColor: 'text-yellow-600',
  },
  {
    title: '转化率',
    value: 68.88,
    prefix: '',
    suffix: '%',
    icon: '🎯',
    bgColor: 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30',
    textColor: 'text-purple-600',
  },
]

const dashboardGridClassName = cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6')
function dashboardCardClassName(bgColor: string) {
  return cn('rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow', bgColor)
}
const dashboardTitleClassName = cn('text-sm font-medium')
const dashboardValueClassName = cn('text-3xl font-bold')
const dashboardTrendClassName = cn('flex items-center gap-1 text-sm')
const trendTextClassName = cn('ml-1 text-gray-400')

// 动态更新演示
const dynamicEndVal = ref(2024)
const countToRef = ref()

const dynamicContainerClassName = cn(
  'p-8 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-pink-900/20 rounded-lg text-center',
)
const dynamicLabelClassName = cn('text-sm text-gray-500 block mb-2')
const dynamicValueClassName = cn(
  'text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent',
)
const buttonGroupClassName = cn('flex gap-4 justify-center')
const dynamicTipClassName = cn('text-sm text-gray-400 mt-4')

/**
 * 更新动态目标值并重新播放动画
 */
function updateDynamicValue() {
  // 生成随机数值：1000 ~ 9999
  dynamicEndVal.value = Math.floor(Math.random() * 9000) + 1000
}

/**
 * 重置动态计数器
 */
function resetDynamicCounter() {
  if (countToRef.value) {
    countToRef.value.reset()
    setTimeout(() => {
      countToRef.value.start()
    }, 100)
  }
}
</script>

<template>
  <div :class="containerClassName">
    <!-- 页面标题 -->
    <div :class="pageHeaderClassName">
      <h2 :class="pageTitleClassName">
        CountTo 数字动画组件
      </h2>
      <p :class="pageDescClassName">
        展示数字滚动动画的各种用法与配置选项
      </p>
    </div>

    <!-- 1. 基础用法 -->
    <a-card
      title="基础用法"
      variant="borderless"
    >
      <template #extra>
        <span :class="cardExtraClassName">从 0 到目标数字的动画</span>
      </template>
      <div :class="numberCardClassName">
        <span :class="numberLabelClassName">当前年份</span>
        <CountTo
          :start-val="0"
          :end-val="2024"
          :duration="2000"
          :class="cn(numberValueClassName, 'text-blue-600')"
        />
      </div>
    </a-card>

    <!-- 2. 小数精度 -->
    <a-card
      title="小数精度"
      variant="borderless"
    >
      <template #extra>
        <span :class="cardExtraClassName">配置 decimals 控制小数位数</span>
      </template>
      <div :class="decimalGridClassName">
        <div :class="numberCardClassName">
          <span :class="numberLabelClassName">金额格式</span>
          <CountTo
            :start-val="0"
            :end-val="9988.88"
            :decimals="2"
            prefix="¥"
            :class="cn(numberValueClassName, 'text-red-600')"
          />
        </div>
        <div :class="numberCardClassName">
          <span :class="numberLabelClassName">精确到分</span>
          <CountTo
            :start-val="0"
            :end-val="1234.56"
            :decimals="2"
            :class="cn(numberValueClassName, 'text-green-600')"
          />
        </div>
        <div :class="numberCardClassName">
          <span :class="numberLabelClassName">三位小数</span>
          <CountTo
            :start-val="0"
            :end-val="987.654"
            :decimals="3"
            :class="cn(numberValueClassName, 'text-orange-600')"
          />
        </div>
        <div :class="numberCardClassName">
          <span :class="numberLabelClassName">高精度</span>
          <CountTo
            :start-val="0"
            :end-val="3.14159"
            :decimals="5"
            :class="cn(numberValueClassName, 'text-purple-600')"
          />
        </div>
      </div>
    </a-card>

    <!-- 3. 前缀后缀 -->
    <a-card
      title="前缀后缀"
      variant="borderless"
    >
      <template #extra>
        <span :class="cardExtraClassName">添加 ¥、%、人 等单位符号</span>
      </template>
      <div :class="decimalGridClassName">
        <div :class="prefixCardClassName('bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-red-100 dark:border-red-800')">
          <span :class="numberLabelClassName">金额 (¥)</span>
          <CountTo
            :start-val="0"
            :end-val="9988.88"
            :decimals="2"
            prefix="¥"
            :class="cn(numberValueClassName, 'text-red-600')"
          />
        </div>
        <div :class="prefixCardClassName('bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-100 dark:border-green-800')">
          <span :class="numberLabelClassName">百分比 (%)</span>
          <CountTo
            :start-val="0"
            :end-val="88.88"
            :decimals="2"
            suffix="%"
            :class="cn(numberValueClassName, 'text-green-600')"
          />
        </div>
        <div :class="prefixCardClassName('bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-100 dark:border-blue-800')">
          <span :class="numberLabelClassName">人数 (人)</span>
          <CountTo
            :start-val="0"
            :end-val="12580"
            suffix="人"
            :class="cn(numberValueClassName, 'text-blue-600')"
          />
        </div>
        <div :class="prefixCardClassName('bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-100 dark:border-purple-800')">
          <span :class="numberLabelClassName">温度 (°C)</span>
          <CountTo
            :start-val="0"
            :end-val="36.5"
            :decimals="1"
            suffix="°C"
            :class="cn(numberValueClassName, 'text-purple-600')"
          />
        </div>
      </div>
    </a-card>

    <!-- 4. 分隔符 -->
    <a-card
      title="千分位分隔符"
      variant="borderless"
    >
      <template #extra>
        <span :class="cardExtraClassName">大数字使用逗号分隔，更易读</span>
      </template>
      <div :class="separatorGridClassName">
        <div :class="numberCardClassName">
          <span :class="numberLabelClassName">万级数字</span>
          <CountTo
            :start-val="0"
            :end-val="12345"
            separator=","
            :class="cn(numberValueClassName, 'text-blue-600')"
          />
        </div>
        <div :class="numberCardClassName">
          <span :class="numberLabelClassName">百万级数字</span>
          <CountTo
            :start-val="0"
            :end-val="1234567"
            separator=","
            :class="cn(numberValueClassName, 'text-green-600')"
          />
        </div>
        <div :class="numberCardClassName">
          <span :class="numberLabelClassName">千万级数字</span>
          <CountTo
            :start-val="0"
            :end-val="123456789"
            separator=","
            :class="cn(numberValueClassName, 'text-purple-600')"
          />
        </div>
      </div>
    </a-card>

    <!-- 5. 正负数 -->
    <a-card
      title="正负数展示"
      variant="borderless"
    >
      <template #extra>
        <span :class="cardExtraClassName">支持正数和负数的动画效果</span>
      </template>
      <div :class="decimalGridClassName">
        <div :class="signCardClassName('bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800')">
          <span :class="signLabelClassName">正增长 📈</span>
          <CountTo
            :start-val="0"
            :end-val="5678"
            :class="cn(numberValueClassName, 'text-green-600')"
          />
          <span :class="cn(signChangeClassName, 'text-green-500')">+12.5%</span>
        </div>
        <div :class="signCardClassName('bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800')">
          <span :class="signLabelClassName">负增长 📉</span>
          <CountTo
            :start-val="0"
            :end-val="-2345"
            :class="cn(numberValueClassName, 'text-red-600')"
          />
          <span :class="cn(signChangeClassName, 'text-red-500')">-8.3%</span>
        </div>
        <div :class="signCardClassName('bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800')">
          <span :class="signLabelClassName">大额正数 💪</span>
          <CountTo
            :start-val="0"
            :end-val="99999"
            :class="cn(numberValueClassName, 'text-blue-600')"
          />
          <span :class="cn(signChangeClassName, 'text-blue-500')">+156.8%</span>
        </div>
        <div :class="signCardClassName('bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800')">
          <span :class="signLabelClassName">亏损 ⚠️</span>
          <CountTo
            :start-val="0"
            :end-val="-8888"
            :class="cn(numberValueClassName, 'text-orange-600')"
          />
          <span :class="cn(signChangeClassName, 'text-orange-500')">-23.4%</span>
        </div>
      </div>
    </a-card>

    <!-- 6. 缓动函数 -->
    <a-card
      title="缓动函数对比"
      variant="borderless"
    >
      <template #extra>
        <span :class="cardExtraClassName">不同缓动效果让动画更有节奏感</span>
      </template>
      <div :class="easingContainerClassName">
        <!-- linear - 线性 -->
        <div :class="easingCardClassName">
          <div :class="easingHeaderClassName">
            <span :class="easingNameClassName">linear (线性)</span>
            <span :class="easingDescClassName">匀速运动，节奏稳定</span>
          </div>
          <div :class="easingDisplayClassName">
            <CountTo
              :start-val="0"
              :end-val="100"
              :duration="2500"
              :use-easing="true"
              easing-fn="linear"
              :class="cn(easingValueClassName, 'text-blue-600')"
            />
          </div>
        </div>

        <!-- easeInOutCubic - 三次缓入缓出 -->
        <div :class="easingCardClassName">
          <div :class="easingHeaderClassName">
            <span :class="easingNameClassName">easeInOutCubic (三次缓入缓出)</span>
            <span :class="easingDescClassName">慢→快→慢，自然流畅</span>
          </div>
          <div :class="easingDisplayClassName">
            <CountTo
              :start-val="0"
              :end-val="100"
              :duration="2500"
              :use-easing="true"
              easing-fn="easeInOutCubic"
              :class="cn(easingValueClassName, 'text-green-600')"
            />
          </div>
        </div>

        <!-- easeOutExpo - 指数缓出（默认） -->
        <div :class="easingCardClassName">
          <div :class="easingHeaderClassName">
            <span :class="easingNameClassName">easeOutExpo (指数缓出)</span>
            <span :class="easingDescClassName">先快后慢，最常用</span>
          </div>
          <div :class="easingDisplayClassName">
            <CountTo
              :start-val="0"
              :end-val="100"
              :duration="2500"
              :use-easing="true"
              easing-fn="easeOutExpo"
              :class="cn(easingValueClassName, 'text-purple-600')"
            />
          </div>
        </div>

        <!-- 无缓动 -->
        <div :class="easingCardClassName">
          <div :class="easingHeaderClassName">
            <span :class="easingNameClassName">无缓动 (useEasing=false)</span>
            <span :class="easingDescClassName">线性，无任何加速度变化</span>
          </div>
          <div :class="easingDisplayClassName">
            <CountTo
              :start-val="0"
              :end-val="100"
              :duration="2500"
              :use-easing="false"
              :class="cn(easingValueClassName, 'text-orange-600')"
            />
          </div>
        </div>
      </div>
    </a-card>

    <!-- 7. 数据看板面板 -->
    <a-card
      title="数据看板面板"
      variant="borderless"
    >
      <template #extra>
        <span :class="cardExtraClassName">模拟真实业务场景的数据展示</span>
      </template>
      <div :class="dashboardGridClassName">
        <div
          v-for="(item, index) in dashboardData"
          :key="index"
          :class="dashboardCardClassName(item.bgColor)"
        >
          <div class="flex items-center justify-between mb-4">
            <span class="text-3xl">{{ item.icon }}</span>
            <span :class="cn(dashboardTitleClassName, item.textColor)">
              {{ item.title }}
            </span>
          </div>
          <div class="mb-2">
            <CountTo
              :start-val="0"
              :end-val="item.value"
              :decimals="item.title === '总收入' || item.title === '转化率' ? 2 : 0"
              :prefix="item.prefix"
              :suffix="item.suffix"
              separator=","
              :duration="2500"
              :class="cn(dashboardValueClassName, item.textColor)"
            />
          </div>
          <div :class="dashboardTrendClassName">
            <span :class="index % 2 === 0 ? 'text-green-500' : 'text-red-500'">
              {{ index % 2 === 0 ? '↑' : '↓' }}
            </span>
            <span :class="index % 2 === 0 ? 'text-green-500' : 'text-red-500'">
              {{ index % 2 === 0 ? '+' : '-' }}{{ Math.floor(Math.random() * 20 + 5) }}%
            </span>
            <span :class="trendTextClassName">较上月</span>
          </div>
        </div>
      </div>
    </a-card>

    <!-- 8. 动态更新 -->
    <a-card
      title="动态更新目标值"
      variant="borderless"
    >
      <template #extra>
        <span :class="cardExtraClassName">点击按钮改变目标值，动画自动重播</span>
      </template>
      <div :class="dynamicContainerClassName">
        <div class="mb-6">
          <span :class="dynamicLabelClassName">当前目标值</span>
          <CountTo
            ref="countToRef"
            :start-val="0"
            :end-val="dynamicEndVal"
            :duration="1500"
            :decimals="0"
            :class="dynamicValueClassName"
          />
        </div>
        <div :class="buttonGroupClassName">
          <a-button
            type="primary"
            size="large"
            @click="updateDynamicValue"
          >
            🎲 随机生成新数值
          </a-button>
          <a-button
            size="large"
            @click="resetDynamicCounter"
          >
            🔄 重播动画
          </a-button>
        </div>
        <p :class="dynamicTipClassName">
          点击「随机生成」会改变目标值，CountTo 会检测到 endVal 变化并自动重新播放动画
        </p>
      </div>
    </a-card>
  </div>
</template>

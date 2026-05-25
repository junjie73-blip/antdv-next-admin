<script setup lang="ts">
import { ref, computed } from 'vue'
import { cn } from '@/utils/cn'

// ==================== 类型定义 ====================
interface Product {
  id: number
  name: string
  description: string
  price: number
  image: string
  tag: string
}

interface StatCard {
  title: string
  value: string | number
  icon: string
  trend: 'up' | 'down'
  trendValue: string
  color: string
}

// ==================== 样式类名（全部在 script 中定义） ====================
const containerClassName = cn('space-y-6')
const grid3ColClassName = cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5')
const grid4ColClassName = cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5')

// 基础卡片内部样式
const cardCoverClassName = cn(
  'h-40 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400',
  'mb-4 flex items-center justify-center'
)
const cardTitleClassName = cn('text-base font-semibold text-gray-800 dark:text-gray-100 mb-2 line-clamp-1')
const cardDescClassName = cn('text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2')
const cardFooterClassName = cn(
  'flex items-center justify-between pt-3',
  'border-t border-gray-100 dark:border-gray-800'
)
const priceClassName = cn('text-lg font-bold text-red-500')
const tagClassName = cn(
  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
  'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
)

// 统计卡片样式
const statCardClassName = cn(
  'rounded-xl border border-gray-200 dark:border-gray-700 p-5',
  'bg-white dark:bg-gray-800/50 transition-all duration-200',
  'hover:shadow-md hover:border-transparent'
)
const statIconClassName = cn('text-2xl')
const statValueClassName = cn('text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1')
const statLabelClassName = cn('text-sm text-gray-500 dark:text-gray-400')
const trendUpClassName = cn(
  'inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full',
  'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
)
const trendDownClassName = cn(
  'inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full',
  'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'
)

// 悬停效果卡片样式
const hoverCardClassName = cn(
  'rounded-xl border border-gray-200 dark:border-gray-700 p-5',
  'bg-white dark:bg-gray-800/50 transition-all duration-300 ease-in-out',
  'hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/10 hover:scale-[1.02]',
  'cursor-pointer'
)
const hoverCoverClassName = cn('h-24 rounded-lg bg-gradient-to-br from-purple-500 to-pink-400 mb-3')
const hoverTitleClassName = cn('font-semibold text-gray-800 dark:text-gray-100 mb-1')
const hoverDescClassName = cn('text-xs text-gray-500 dark:text-gray-400 line-clamp-1')

// 筛选区域样式
const filterSectionClassName = cn('mb-5 space-y-3')
const categoryGroupClassName = cn('flex flex-wrap gap-2')

// 筛选结果卡片样式（横向布局）
const filterCardCoverClassName = cn('w-16 h-16 rounded-lg bg-gradient-to-br shrink-0')
const filterCardTitleClassName = cn('font-semibold text-sm text-gray-800 dark:text-gray-100 truncate')
const filterCardDescClassName = cn('text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2')
const filterCardMetaClassName = cn('flex items-center gap-3 text-xs text-gray-400')

// 加载更多区域样式
const loadMoreInfoClassName = cn('text-sm text-gray-500 dark:text-gray-400 mb-4')
const loadMoreCenterClassName = cn('mt-5 text-center')
const loadMoreDoneClassName = cn('mt-5 text-center text-sm text-gray-400')
const loadMoreCoverClassName = cn(
  'h-28 rounded-lg bg-gradient-to-br from-green-500 to-emerald-400',
  'mb-3 flex items-center justify-center'
)
const loadMoreIndexClassName = cn('text-white/90 font-semibold')
const loadMoreMetaClassName = cn('text-xs text-gray-500 dark:text-gray-400')

// 瀑布流布局样式
const masonryClassName = cn('columns-1 md:columns-2 lg:columns-3 gap-5 space-y-5')
const masonryItemClassName = cn(
  'break-inside-avoid mb-5 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden',
  'bg-white dark:bg-gray-800/50 transition-shadow duration-200 hover:shadow-lg'
)
const masonryCoverBaseClassName = cn('bg-gradient-to-br flex items-end p-4')
const masonryCategoryBadgeClassName = cn(
  'text-white/90 text-sm font-medium backdrop-blur-sm bg-black/20 px-2 py-1 rounded'
)
const masonryContentClassName = cn('p-4')
const masonryTitleClassName = cn('font-semibold text-gray-800 dark:text-gray-100 mb-2')
const masonryDescClassName = cn('text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-3')
const masonryFooterClassName = cn('flex items-center justify-between text-xs text-gray-400')
const masonryMetaGroupClassName = cn('flex items-center gap-3')

// 提示文字样式
const sectionTipClassName = cn('text-sm text-gray-500 dark:text-gray-400 mb-4')

// ==================== 模拟数据 ====================

/** 产品模拟数据 - 用于基础卡片列表、筛选列表、加载更多 */
const productList = ref<Product[]>([
  {
    id: 1,
    name: 'Vue 3 企业级组件库',
    description: '基于 Vue 3 + TypeScript 构建的高性能企业级 UI 组件库，支持主题定制与国际化。',
    price: 299,
    image: '',
    tag: '热门'
  },
  {
    id: 2,
    name: 'React 状态管理方案',
    description: '深入剖析 Zustand 与 Jotai 的设计哲学，帮你选择最适合项目的状态管理工具。',
    price: 199,
    image: '',
    tag: '推荐'
  },
  {
    id: 3,
    name: 'Node.js 微服务实战',
    description: '从零搭建生产级微服务架构，涵盖服务发现、负载均衡、链路追踪等核心话题。',
    price: 399,
    image: '',
    tag: '新课'
  },
  {
    id: 4,
    name: 'TypeScript 高级编程',
    description: '掌握 TypeScript 高级类型体操，编写类型安全的代码，提升团队协作效率。',
    price: 259,
    image: '',
    tag: '畅销'
  },
  {
    id: 5,
    name: 'Docker 容器化部署',
    description: '使用 Docker Compose 编排多容器应用，实现一键部署与环境一致性保障。',
    price: 179,
    image: '',
    tag: '实用'
  },
  {
    id: 6,
    name: 'PostgreSQL 性能调优',
    description: '从索引优化到查询计划分析，全面提升数据库查询性能与并发处理能力。',
    price: 349,
    image: '',
    tag: '进阶'
  },
  {
    id: 7,
    name: 'Tailwind CSS 设计系统',
    description: '基于原子化 CSS 构建企业级设计系统，提升开发效率与视觉一致性。',
    price: 229,
    image: '',
    tag: '热门'
  },
  {
    id: 8,
    name: 'Kubernetes 集群管理',
    description: 'K8s 核心概念、Pod 管理、Service 与 Ingress 配置详解，云原生必备技能。',
    price: 459,
    image: '',
    tag: '新课'
  },
  {
    id: 9,
    name: 'GraphQL API 设计',
    description: 'REST vs GraphQL 对比分析，Schema 设计最佳实践与性能优化策略。',
    price: 279,
    image: '',
    tag: '推荐'
  }
])

/** 统计卡片数据 */
const statCards = ref<StatCard[]>([
  {
    title: '总用户数',
    value: '12,893',
    icon: '👥',
    trend: 'up',
    trendValue: '+12.5%',
    color: 'text-blue-600'
  },
  {
    title: '日活跃度',
    value: '8,234',
    icon: '📈',
    trend: 'up',
    trendValue: '+8.2%',
    color: 'text-green-600'
  },
  {
    title: '本月收入',
    value: '¥128,450',
    icon: '💰',
    trend: 'up',
    trendValue: '+23.1%',
    color: 'text-purple-600'
  },
  {
    title: '订单总量',
    value: '3,672',
    icon: '📦',
    trend: 'down',
    trendValue: '-3.2%',
    color: 'text-orange-600'
  }
])

/** 产品封面渐变色映射 */
const coverGradients = [
  'from-blue-500 to-cyan-400',
  'from-purple-500 to-pink-400',
  'from-green-500 to-emerald-400',
  'from-orange-500 to-yellow-400',
  'from-red-500 to-rose-400',
  'from-indigo-500 to-violet-400',
  'from-teal-500 to-cyan-400',
  'from-amber-500 to-orange-400',
  'from-fuchsia-500 to-pink-400'
]

function getCoverGradient(index: number): string {
  return coverGradients[index % coverGradients.length]
}

// ==================== 可筛选列表逻辑 ====================
const searchQuery = ref('')
const activeCategory = ref<string>('全部')
const categoryList = computed(() => {
  const tags = new Set(productList.value.map(item => item.tag))
  return ['全部', ...tags]
})

const filteredProducts = computed(() => {
  let result = productList.value
  if (activeCategory.value !== '全部') {
    result = result.filter(item => item.tag === activeCategory.value)
  }
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      item =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
    )
  }
  return result
})

// ==================== 加载更多逻辑 ====================
const displayCount = ref(6)
const LOAD_MORE_STEP = 3
const displayedProducts = computed(() => productList.value.slice(0, displayCount.value))
const hasMore = computed(() => displayCount.value < productList.value.length)

function handleLoadMore() {
  displayCount.value = Math.min(displayCount.value + LOAD_MORE_STEP, productList.value.length)
}
</script>

<template>
  <div :class="containerClassName">
    <!-- ========== 1. 基础卡片列表 ========== -->
    <a-card title="基础卡片列表" variant="borderless">
      <div :class="grid3ColClassName">
        <a-card
          v-for="(product, index) in productList.slice(0, 3)"
          :key="product.id"
          :variant="bordered"
          hoverable
        >
          <!-- 封面区域 -->
          <div :class="cn(cardCoverClassName, `bg-gradient-to-br ${getCoverGradient(index)}`)">
            <span class="text-white/80 text-sm font-medium">{{ product.tag }}</span>
          </div>
          <!-- 内容区 -->
          <h3 :class="cardTitleClassName">{{ product.name }}</h3>
          <p :class="cardDescClassName">{{ product.description }}</p>
          <!-- 底部操作 -->
          <div :class="cardFooterClassName">
            <span :class="priceClassName">¥{{ product.price }}</span>
            <span :class="tagClassName">{{ product.tag }}</span>
          </div>
        </a-card>
      </div>
    </a-card>

    <!-- ========== 2. 数据看板卡片 ========== -->
    <a-card title="数据看板" :variant="borderless">
      <div :class="grid4ColClassName">
        <div v-for="stat in statCards" :key="stat.title" :class="statCardClassName">
          <div class="flex items-start justify-between mb-3">
            <span :class="cn(statIconClassName, stat.color)">{{ stat.icon }}</span>
            <span :class="stat.trend === 'up' ? trendUpClassName : trendDownClassName">
              {{ stat.trend === 'up' ? '↑' : '↓' }} {{ stat.trendValue }}
            </span>
          </div>
          <p :class="statValueClassName">{{ stat.value }}</p>
          <p :class="statLabelClassName">{{ stat.title }}</p>
        </div>
      </div>
    </a-card>

    <!-- ========== 3. 悬停效果卡片 ========== -->
    <a-card title="悬停效果" :variant="borderless">
      <p :class="sectionTipClassName">鼠标悬停在卡片上查看动画效果：阴影加深 + 轻微上浮 + 缩放</p>
      <div :class="grid3ColClassName">
        <div
          v-for="(product, index) in productList.slice(0, 6)"
          :key="product.id"
          :class="hoverCardClassName"
        >
          <div :class="cn(hoverCoverClassName, `bg-gradient-to-br ${getCoverGradient(index + 2)}`)" />
          <h4 :class="hoverTitleClassName">{{ product.name }}</h4>
          <p :class="hoverDescClassName">{{ product.description }}</p>
        </div>
      </div>
    </a-card>

    <!-- ========== 4. 可筛选列表 ========== -->
    <a-card title="可筛选列表" :variant="borderless">
      <!-- 搜索框和分类标签 -->
      <div :class="filterSectionClassName">
        <a-input-search
          v-model:value="searchQuery"
          placeholder="搜索标题或描述..."
          allow-clear
          style="max-width: 360px"
        />
        <div :class="categoryGroupClassName">
          <a-button
            v-for="cat in categoryList"
            :key="cat"
            :type="activeCategory === cat ? 'primary' : 'default'"
            size="small"
            @click="activeCategory = cat"
          >
            {{ cat }}
          </a-button>
        </div>
      </div>
      <!-- 筛选结果 -->
      <template v-if="filteredProducts.length > 0">
        <div :class="grid3ColClassName">
          <a-card
            v-for="(product, index) in filteredProducts.slice(0, 6)"
            :key="product.id"
            :variant="bordered"
            size="small"
          >
            <div class="flex items-start gap-3">
              <div :class="cn(filterCardCoverClassName, `bg-gradient-to-br ${getCoverGradient(index)}`)" />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <h4 :class="filterCardTitleClassName">{{ product.name }}</h4>
                  <span :class="tagClassName">{{ product.tag }}</span>
                </div>
                <p :class="filterCardDescClassName">{{ product.description }}</p>
                <div :class="filterCardMetaClassName">
                  <span>{{ product.tag }}</span>
                  <span>¥{{ product.price }}</span>
                </div>
              </div>
            </div>
          </a-card>
        </div>
      </template>
      <a-empty v-else description="没有找到匹配的卡片" />
    </a-card>

    <!-- ========== 5. 加载更多 ========== -->
    <a-card title="加载更多" :variant="borderless">
      <p :class="loadMoreInfoClassName">当前显示 {{ displayCount }} / {{ productList.length }} 条</p>
      <div :class="grid3ColClassName">
        <a-card
          v-for="(product, index) in displayedProducts"
          :key="product.id"
          :variant="bordered"
        >
          <div :class="cn(loadMoreCoverClassName, `bg-gradient-to-br ${getCoverGradient(index + 4)}`)">
            <span :class="loadMoreIndexClassName">#{{ String(product.id).padStart(2, '0') }}</span>
          </div>
          <h4 :class="hoverTitleClassName">{{ product.name }}</h4>
          <p :class="loadMoreMetaClassName">{{ product.tag }} · ¥{{ product.price }}</p>
        </a-card>
      </div>
      <div v-if="hasMore" :class="loadMoreCenterClassName">
        <a-button @click="handleLoadMore">
          加载更多 ({{ Math.min(LOAD_MORE_STEP, productList.length - displayCount) }} 条)
        </a-button>
      </div>
      <div v-else :class="loadMoreDoneClassName">已加载全部数据 ~</div>
    </a-card>

    <!-- ========== 6. 瀑布流布局 ========== -->
    <a-card title="瀑布流布局 (CSS Columns)" :variant="borderless">
      <p :class="sectionTipClassName">使用 CSS columns 实现瀑布流效果，卡片高度不同</p>
      <div :class="masonryClassName">
        <div
          v-for="(product, index) in productList"
          :key="product.id"
          :class="masonryItemClassName"
        >
          <!-- 动态高度封面 -->
          <div
            :class="cn(masonryCoverBaseClassName, `bg-gradient-to-br ${getCoverGradient(index)}`)"
            :style="{ height: `${120 + (index % 3) * 40}px` }"
          >
            <span :class="masonryCategoryBadgeClassName">{{ product.tag }}</span>
          </div>
          <div :class="masonryContentClassName">
            <h4 :class="masonryTitleClassName">{{ product.name }}</h4>
            <p :class="masonryDescClassName">{{ product.description }}</p>
            <div :class="masonryFooterClassName">
              <div :class="masonryMetaGroupClassName">
                <span>¥{{ product.price }}</span>
              </div>
              <span :class="tagClassName">{{ product.tag }}</span>
            </div>
          </div>
        </div>
      </div>
    </a-card>
  </div>
</template>

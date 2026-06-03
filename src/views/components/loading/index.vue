<script setup lang="ts">
import type { Ref } from 'vue'
import { ref, useTemplateRef } from 'vue'
import { createLoading, Loading, useLoading } from '@/components/common/Loading'
import { cn } from '@/utils/cn'

const containerClassName = cn('space-y-6')

const spinLoading = ref(true)
const spinTip = ref('加载中...')
const spinStyle = ref<'circle' | 'dot' | 'grid'>('circle')

const skeletonActive = ref(false)

const componentLoading = ref(false)
const componentSize = ref<'default' | 'small' | 'large'>('default')
const componentTheme = ref<'light' | 'dark'>('light')

const hookContainerRef = useTemplateRef<HTMLElement>()
const hookLoading = useLoading({
  target: () => hookContainerRef.value!,
  body: false,
  tip: 'Hook 控制加载...',
})

const btnLoading1 = ref(false)
const btnLoading2 = ref(false)
const btnLoading3 = ref(false)

let globalLoadingInstance: ReturnType<typeof createLoading> | null = null

function simulateAsync(loadingRef: Ref<boolean>, duration = 2000) {
  loadingRef.value = true
  setTimeout(() => {
    loadingRef.value = false
  }, duration)
}

function toggleSpinStyle(style: 'circle' | 'dot' | 'grid') {
  spinStyle.value = style
}

function triggerComponentLoading() {
  componentLoading.value = true
  setTimeout(() => {
    componentLoading.value = false
  }, 2500)
}

function triggerUseLoading() {
  hookLoading.open()
  setTimeout(() => {
    hookLoading.close()
  }, 2500)
}

function triggerBtnLoading(index: number) {
  const refs = [btnLoading1, btnLoading2, btnLoading3]
  simulateAsync(refs[index], 2000 + index * 500)
}

function triggerGlobalLoading() {
  globalLoadingInstance = createLoading({
    tip: '正在处理请求，请稍候...',
    theme: 'dark',
    background: 'rgba(0, 0, 0, 0.6)',
  })
  globalLoadingInstance.open()

  setTimeout(() => {
    globalLoadingInstance?.setTip('即将完成...')
  }, 1500)

  setTimeout(() => {
    globalLoadingInstance?.close()
    globalLoadingInstance = null
  }, 3000)
}
</script>

<template>
  <div :class="containerClassName">
    <a-card
      :variant="borderless"
      title="Spin 加载器"
    >
      <div :class="cn('space-y-8')">
        <div>
          <h4 class="text-base font-medium text-gray-700 dark:text-gray-300 mb-3">
            基础用法
          </h4>
          <div class="flex items-center gap-8 flex-wrap">
            <a-spin />
            <a-spin
              :loading="spinLoading"
              description="数据加载中..."
            />
            <a-button @click="spinLoading = !spinLoading">
              {{ spinLoading ? '停止' : '开始' }}加载
            </a-button>
          </div>
        </div>

        <div>
          <h4 class="text-base font-medium text-gray-700 dark:text-gray-300 mb-3">
            包裹内容
          </h4>
          <div class="flex gap-6 flex-wrap">
            <a-spin
              :loading="true"
              class="w-[240px]"
            >
              <div class="p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center text-sm text-gray-500">
                内容区域被 Spin 包裹
              </div>
            </a-spin>
            <a-spin
              :loading="spinLoading"
              class="w-[240px]"
            >
              <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                点击按钮切换加载状态
              </div>
            </a-spin>
          </div>
        </div>

        <div>
          <h4 class="text-base font-medium text-gray-700 dark:text-gray-300 mb-3">
            自定义提示文字
          </h4>
          <div class="flex items-center gap-4 flex-wrap">
            <a-spin description="正在加载用户信息..." />
            <a-spin description="请稍候，数据同步中...">
              <div class="p-3 w-[200px] h-[80px] bg-blue-50 dark:bg-blue-900/20 rounded-lg" />
            </a-spin>
            <a-input
              v-model:value="spinTip"
              placeholder="输入提示文字"
              style="width: 180px"
            />
            <a-spin :description="spinTip" />
          </div>
        </div>

        <div>
          <h4 class="text-base font-medium text-gray-700 dark:text-gray-300 mb-3">
            尺寸大小
          </h4>
          <div class="flex items-center gap-8">
            <div class="flex flex-col items-center gap-2">
              <a-spin size="small" />
              <span class="text-xs text-gray-500">Small</span>
            </div>
            <div class="flex flex-col items-center gap-2">
              <a-spin size="medium" />
              <span class="text-xs text-gray-500">Medium</span>
            </div>
            <div class="flex flex-col items-center gap-2">
              <a-spin size="large" />
              <span class="text-xs text-gray-500">Large</span>
            </div>
          </div>
        </div>

        <div>
          <h4 class="text-base font-medium text-gray-700 dark:text-gray-300 mb-3">
            样式切换（点状 / 圆圈 / 网格）
          </h4>
          <div class="flex items-center gap-6 flex-wrap">
            <a-space>
              <a-button
                :type="spinStyle === 'circle' ? 'primary' : 'outline'"
                size="small"
                @click="toggleSpinStyle('circle')"
              >
                圆圈 Circle
              </a-button>
              <a-button
                :type="spinStyle === 'dot' ? 'primary' : 'outline'"
                size="small"
                @click="toggleSpinStyle('dot')"
              >
                点状 Dot
              </a-button>
              <a-button
                :type="spinStyle === 'grid' ? 'primary' : 'outline'"
                size="small"
                @click="toggleSpinStyle('grid')"
              >
                网格 Grid
              </a-button>
            </a-space>
            <div class="ml-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800 min-w-[160px] min-h-[100px] flex items-center justify-center">
              <a-spin v-if="spinStyle === 'circle'" />
              <a-spin
                v-else-if="spinStyle === 'dot'"
                dot
              />
              <a-spin
                v-else-if="spinStyle === 'grid'"
                grid
              />
            </div>
          </div>
        </div>
      </div>
    </a-card>

    <a-card
      :variant="borderless"
      title="Skeleton 骨架屏"
    >
      <div :class="cn('space-y-8')">
        <div>
          <h4 class="text-base font-medium text-gray-700 dark:text-gray-300 mb-3">
            头像 + 文本骨架
          </h4>
          <div class="flex gap-8">
            <a-skeleton
              avatar
              :paragraph="{ rows: 3 }"
            />
            <a-skeleton
              avatar
              active
              :paragraph="{ rows: 2 }"
            />
          </div>
        </div>

        <div>
          <h4 class="text-base font-medium text-gray-700 dark:text-gray-300 mb-3">
            图片骨架
          </h4>
          <div class="flex gap-6 flex-wrap">
            <a-skeleton-image />
            <a-skeleton-image active />
            <a-skeleton-image style="width: 280px; height: 160px" />
          </div>
        </div>

        <div>
          <h4 class="text-base font-medium text-gray-700 dark:text-gray-300 mb-3">
            表格骨架
          </h4>
          <a-skeleton-table
            :columns="5"
            :rows="4"
          />
        </div>

        <div>
          <h4 class="text-base font-medium text-gray-700 dark:text-gray-300 mb-3">
            按钮骨架
          </h4>
          <div class="flex gap-4">
            <a-skeleton-button />
            <a-skeleton-button
              active
              block
            />
          </div>
        </div>

        <div>
          <h4 class="text-base font-medium text-gray-700 dark:text-gray-300 mb-3">
            动画控制
          </h4>
          <div class="flex items-center gap-4">
            <a-switch
              v-model:checked="skeletonActive"
              checked-children="激活"
              un-checked-children="静止"
            />
            <span class="text-sm text-gray-500">
              当前状态：<span class="font-medium">{{ skeletonActive ? '流动动画' : '静止' }}</span>
            </span>
          </div>
          <div class="mt-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800 max-w-md">
            <a-skeleton
              :active="skeletonActive"
              :paragraph="{ rows: 2 }"
            />
          </div>
        </div>
      </div>
    </a-card>

    <a-card
      :variant="borderless"
      title="Loading 组件 (项目封装)"
    >
      <div :class="cn('space-y-6')">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          项目封装的 Loading 组件，支持全屏/容器内两种模式，可配置尺寸、主题、提示文字等
        </p>

        <div class="flex items-center gap-4">
          <span class="text-sm font-medium text-gray-600 dark:text-gray-400">尺寸：</span>
          <a-radio-group
            v-model:value="componentSize"
            option-type="button"
          >
            <a-radio value="small">
              Small
            </a-radio>
            <a-radio value="default">
              Default
            </a-radio>
            <a-radio value="large">
              Large
            </a-radio>
          </a-radio-group>
        </div>

        <div class="flex items-center gap-4">
          <span class="text-sm font-medium text-gray-600 dark:text-gray-400">主题：</span>
          <a-radio-group
            v-model:value="componentTheme"
            option-type="button"
          >
            <a-radio value="light">
              Light
            </a-radio>
            <a-radio value="dark">
              Dark
            </a-radio>
          </a-radio-group>
        </div>

        <div class="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <div
            ref="hookContainerRef"
            class="min-h-[180px] p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900"
          >
            <div class="text-center">
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
                这是一个容器内 Loading 演示区域
              </p>
              <a-button
                type="primary"
                :loading="componentLoading"
                @click="triggerComponentLoading"
              >
                触发 Loading ({{ componentSize }} / {{ componentTheme }})
              </a-button>
            </div>
          </div>
          <Loading
            :loading="componentLoading"
            :size="componentSize"
            :theme="componentTheme"
            :absolute="true"
            description="组件式加载中..."
          />
        </div>
      </div>
    </a-card>

    <a-card
      :variant="borderless"
      title="useLoading Hook"
    >
      <div :class="cn('space-y-4')">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          通过 <code class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">useLoading</code> 组合式函数编程式控制加载状态，支持动态修改提示文字
        </p>

        <div class="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <div
            ref="hookContainerRef"
            class="min-h-[160px] p-6 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center"
          >
            <div class="text-center">
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
                useLoading 控制此容器的加载状态
              </p>
              <a-button
                type="primary"
                status="success"
                @click="triggerUseLoading"
              >
                触发 useLoading
              </a-button>
            </div>
          </div>
        </div>

        <div class="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-4">
          <pre class="text-xs font-mono text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">const hookLoading = useLoading({
  target: containerRef,
  body: false,
  tip: '加载中...'
})

hookLoading.open() // 打开
hookLoading.close() // 关闭
hookLoading.setTip('新提示文字') // 修改提示</pre>
        </div>
      </div>
    </a-card>

    <a-card
      :variant="borderless"
      title="按钮加载态"
    >
      <div :class="cn('space-y-6')">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Antdv-next 按钮内置 <code class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">loading</code> 属性，点击后自动进入加载态并禁用交互
        </p>

        <div class="flex flex-wrap gap-4">
          <a-button
            type="primary"
            :loading="btnLoading1"
            @click="triggerBtnLoading(0)"
          >
            主要按钮
          </a-button>
          <a-button
            :loading="btnLoading2"
            @click="triggerBtnLoading(1)"
          >
            默认按钮
          </a-button>
          <a-button
            type="dashed"
            :loading="btnLoading3"
            @click="triggerBtnLoading(2)"
          >
            虚线按钮
          </a-button>
          <a-button
            type="outline"
            :loading="btnLoading1"
            disabled
          >
            禁用按钮
          </a-button>
        </div>

        <div class="flex flex-wrap gap-4">
          <a-button
            type="primary"
            loading
          >
            常驻加载态
          </a-button>
          <a-button
            type="primary"
            loading
          >
            提交中...
          </a-button>
          <a-button
            type="primary"
            shape="round"
            :loading="btnLoading2"
            @click="triggerBtnLoading(1)"
          >
            圆角按钮
          </a-button>
        </div>
      </div>
    </a-card>

    <a-card
      :variant="borderless"
      title="全局加载遮罩"
    >
      <div :class="cn('space-y-4')">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          使用 <code class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">createLoading</code> 创建全屏加载实例，
          适用于路由跳转、API 请求拦截器等场景。支持动态修改提示文字
        </p>

        <div class="flex gap-4">
          <a-button
            type="primary"
            status="danger"
            @click="triggerGlobalLoading"
          >
            模拟 API 请求 (全屏遮罩)
          </a-button>
        </div>

        <div class="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-4">
          <pre class="text-xs font-mono text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">const instance = createLoading({
  tip: '正在处理请求...',
  theme: 'dark',
  background: 'rgba(0, 0, 0, 0.6)'
})

instance.open()
instance.setTip('即将完成...') // 动态更新提示
instance.close() // 关闭并自动销毁</pre>
        </div>
      </div>
    </a-card>
  </div>
</template>

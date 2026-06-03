<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { localStorageCacheStorage } from '@/utils/cache'
import { cn } from '@/utils/cn'

defineOptions({ name: 'VueuseDemo' })

const containerClassName = cn('space-y-6')
const cardBodyClassName = cn('space-y-4')
const labelClassName = cn('text-sm', 'text-gray-500', 'mb-2')
const valueDisplayClassName = cn('text-lg', 'font-semibold', 'text-blue-600', 'dark:text-blue-400')
const valueDisplayMonoClassName = cn('font-mono', 'text-sm', 'bg-gray-100', 'dark:bg-gray-800', 'px-2', 'py-1', 'rounded')
const flexWrapItemsCenterGap8ClassName = cn('flex', 'flex-wrap', 'items-center', 'gap-8')
const flexWrapItemsCenterGap4ClassName = cn('flex', 'flex-wrap', 'items-center', 'gap-4')
const flexColGap4ClassName = cn('flex', 'flex-col', 'gap-4')
const flexColGap2ClassName = cn('flex', 'flex-col', 'gap-2')
const textCenterPy12ClassName = cn('text-center', 'py-12')
const borderDashedClassName = cn('border-2', 'border-dashed', 'border-gray-300', 'dark:border-gray-600', 'rounded-lg', 'p-8')
const fullscreenDemoClassName = cn(
  'border-2',
  'border-dashed',
  'border-gray-300',
  'dark:border-gray-600',
  'rounded-lg',
  'p-8',
  'bg-white',
  'dark:bg-gray-900',
  'transition-all',
  'duration-300',
)
const onlineStatusClassName = cn('flex', 'items-center', 'gap-2')
const onlineDotClassName = cn('w-3', 'h-3', 'rounded-full', 'bg-green-500')
const offlineDotClassName = cn('w-3', 'h-3', 'rounded-full', 'bg-red-500')
const mb0ClassName = cn('mb-0')

const { x: mouseX, y: mouseY } = useMouse()

const { width: windowWidth, height: windowHeight } = useWindowSize()

const clipboardSource = ref('')
const { copy: doCopy, copied: clipboardCopied, isSupported: clipboardSupported } = useClipboard({ source: clipboardSource })

const storageValue = useStorage('vueuse-demo-localstorage', 'Hello Storage!', localStorageCacheStorage)

const [toggleValue, toggle] = useToggle(false)

const debouncedInput = ref('')
const debouncedOutput = ref('')
const debouncedUpdate = useDebounceFn((val: string) => {
  debouncedOutput.value = val
}, 500)

watch(debouncedInput, (val) => {
  debouncedUpdate(val)
})

const throttleCounter = ref(0)
const throttleInvokeCount = ref(0)
const throttledIncrement = useThrottleFn(() => {
  throttleInvokeCount.value++
}, 1000)

function handleThrottleClick() {
  throttleCounter.value++
  throttledIncrement()
}

const intervalCounter = ref(0)
const intervalPaused = ref(false)
const { pause: intervalPause, resume: intervalResume, isActive: intervalActive } = useIntervalFn(
  () => {
    intervalCounter.value++
  },
  1000,
  { immediate: false },
)

function toggleInterval() {
  if (intervalPaused.value) {
    intervalResume()
    intervalPaused.value = false
  }
  else {
    intervalPause()
    intervalPaused.value = true
  }
}

const timeoutMessage = ref('')
const timeoutTriggered = ref(false)
const { start: startTimeout, stop: cancelTimeout, isPending: timeoutPending } = useTimeoutFn(
  () => {
    timeoutMessage.value = '🎉 3秒到了！超时回调已触发！'
    timeoutTriggered.value = true
  },
  3000,
  { immediate: false },
)

function handleStartTimeout() {
  timeoutMessage.value = '等待中...'
  timeoutTriggered.value = false
  startTimeout()
}

function handleCancelTimeout() {
  cancelTimeout()
  timeoutMessage.value = '已取消'
  timeoutTriggered.value = false
}

const lastKeyPressed = ref('')
const lastKeyCode = ref('')
useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  lastKeyPressed.value = e.key
  lastKeyCode.value = e.code
})

const now = useNow({ interval: 1000 })

const typedStorageValue = useStorage<{ name: string, age: number }>(
  'vueuse-demo-typed-storage',
  { name: '张三', age: 25 },
  localStorageCacheStorage,
)

const fullscreenTarget = useTemplateRef<HTMLDivElement>('fullscreenTarget')
const { isFullscreen: isFullscreenActive, enter: enterFullscreen, exit: exitFullscreen, isSupported: fullscreenSupported } = useFullscreen(fullscreenTarget)

const online = useOnline()

const pageLeaveCount = ref(0)
usePageLeave(() => {
  pageLeaveCount.value++
})
</script>

<template>
  <div :class="containerClassName">
    <div :class="cn('mb-6')">
      <div :class="cn('flex', 'items-center', 'gap-3')">
        <Icon
          icon="ant-design:thunderbolt-outlined"
          width="28"
          height="28"
          class="text-yellow-500"
        />
        <h1 :class="cn('text-2xl', 'font-bold', 'text-gray-900', 'dark:text-white', 'mb-0')">
          VueUse Hooks 演示
        </h1>
      </div>
      <p :class="cn('text-gray-500', 'dark:text-gray-400', 'mt-2')">
        以下是 @vueuse/core 中常用 hooks 的实时演示，每个卡片展示一个 hook 的用法和效果。
      </p>
    </div>

    <!-- 1. useMouse -->
    <a-card
      title="useMouse - 鼠标位置追踪"
      :class="mb0ClassName"
    >
      <div :class="cardBodyClassName">
        <div :class="borderDashedClassName">
          <p :class="cn('text-center', 'text-gray-500', 'mb-4')">
            在此区域内移动鼠标
          </p>
          <div :class="flexWrapItemsCenterGap8ClassName">
            <div :class="textCenterPy12ClassName">
              <div :class="labelClassName">
                鼠标 X 坐标
              </div>
              <div :class="valueDisplayClassName">
                {{ mouseX.toFixed(0) }}px
              </div>
            </div>
            <div :class="textCenterPy12ClassName">
              <div :class="labelClassName">
                鼠标 Y 坐标
              </div>
              <div :class="valueDisplayClassName">
                {{ mouseY.toFixed(0) }}px
              </div>
            </div>
          </div>
        </div>
      </div>
    </a-card>

    <!-- 2. useWindowSize -->
    <a-card
      title="useWindowSize - 窗口尺寸"
      :class="mb0ClassName"
    >
      <div :class="cardBodyClassName">
        <div :class="flexWrapItemsCenterGap8ClassName">
          <div :class="textCenterPy12ClassName">
            <div :class="labelClassName">
              窗口宽度
            </div>
            <div :class="valueDisplayClassName">
              {{ windowWidth }}px
            </div>
          </div>
          <div :class="textCenterPy12ClassName">
            <div :class="labelClassName">
              窗口高度
            </div>
            <div :class="valueDisplayClassName">
              {{ windowHeight }}px
            </div>
          </div>
        </div>
        <p :class="cn('text-sm', 'text-gray-400', 'text-center')">
          调整浏览器窗口大小试试
        </p>
      </div>
    </a-card>

    <!-- 3. useClipboard -->
    <a-card
      title="useClipboard - 剪贴板"
      :class="mb0ClassName"
    >
      <div :class="cardBodyClassName">
        <div :class="flexColGap4ClassName">
          <a-input
            v-model:value="clipboardSource"
            placeholder="输入要复制的文本"
            style="max-width: 400px"
          />
          <div :class="flexWrapItemsCenterGap4ClassName">
            <a-button
              type="primary"
              :disabled="!clipboardSupported"
              @click="doCopy(clipboardSource)"
            >
              <template #icon>
                <Icon icon="ant-design:copy-outlined" />
              </template>
              {{ clipboardCopied ? '已复制!' : '复制到剪贴板' }}
            </a-button>
            <a-tag
              v-if="clipboardCopied"
              color="success"
            >
              复制成功
            </a-tag>
            <a-tag
              v-if="!clipboardSupported"
              color="error"
            >
              剪贴板不可用
            </a-tag>
          </div>
        </div>
      </div>
    </a-card>

    <!-- 4. useLocalStorage (via useStorage) -->
    <a-card
      title="useLocalStorage - 本地存储"
      :class="mb0ClassName"
    >
      <div :class="cardBodyClassName">
        <p :class="cn('text-sm', 'text-gray-500')">
          使用项目内置的 localStorageCacheStorage 适配器
        </p>
        <div :class="flexColGap4ClassName">
          <a-input
            v-model:value="storageValue"
            placeholder="输入内容，刷新页面后仍然保留"
            style="max-width: 400px"
          />
          <div :class="flexWrapItemsCenterGap4ClassName">
            <a-tag color="blue">
              当前值：{{ storageValue }}
            </a-tag>
            <a-button
              size="small"
              @click="storageValue = 'Hello Storage!'"
            >
              重置
            </a-button>
          </div>
        </div>
      </div>
    </a-card>

    <!-- 5. useToggle -->
    <a-card
      title="useToggle - 布尔切换"
      :class="mb0ClassName"
    >
      <div :class="cardBodyClassName">
        <div :class="flexWrapItemsCenterGap8ClassName">
          <a-switch
            :checked="toggleValue"
            @change="toggle()"
          />
          <a-tag :color="toggleValue ? 'success' : 'default'">
            {{ toggleValue ? '开启' : '关闭' }}
          </a-tag>
          <a-button
            size="small"
            @click="toggle()"
          >
            <template #icon>
              <Icon icon="ant-design:swap-outlined" />
            </template>
            切换
          </a-button>
          <a-button
            size="small"
            @click="toggle(true)"
          >
            设为 true
          </a-button>
          <a-button
            size="small"
            @click="toggle(false)"
          >
            设为 false
          </a-button>
        </div>
      </div>
    </a-card>

    <!-- 6. useDebounceFn -->
    <a-card
      title="useDebounceFn - 防抖函数"
      :class="mb0ClassName"
    >
      <div :class="cardBodyClassName">
        <div :class="flexColGap4ClassName">
          <div :class="flexColGap2ClassName">
            <div :class="labelClassName">
              输入文本（实时）
            </div>
            <a-input
              v-model:value="debouncedInput"
              placeholder="输入内容观察防抖效果"
              style="max-width: 400px"
            />
          </div>
          <div :class="flexColGap2ClassName">
            <div :class="labelClassName">
              防抖延迟：固定 500ms
            </div>
          </div>
          <div :class="flexWrapItemsCenterGap4ClassName">
            <span :class="labelClassName">实时输入：</span>
            <span :class="valueDisplayMonoClassName">{{ debouncedInput }}</span>
            <span :class="labelClassName">防抖输出：</span>
            <span :class="valueDisplayMonoClassName">{{ debouncedOutput }}</span>
          </div>
        </div>
      </div>
    </a-card>

    <!-- 7. useThrottleFn -->
    <a-card
      title="useThrottleFn - 节流函数"
      :class="mb0ClassName"
    >
      <div :class="cardBodyClassName">
        <p :class="cn('text-sm', 'text-gray-500')">
          快速点击按钮，观察节流效果（1秒内只触发一次）
        </p>
        <div :class="flexWrapItemsCenterGap8ClassName">
          <a-button
            type="primary"
            @click="handleThrottleClick"
          >
            <template #icon>
              <Icon icon="ant-design:plus-outlined" />
            </template>
            快速点击
          </a-button>
          <div>
            <span :class="labelClassName">点击次数：</span>
            <a-tag color="blue">
              {{ throttleCounter }}
            </a-tag>
          </div>
          <div>
            <span :class="labelClassName">实际执行次数：</span>
            <a-tag color="orange">
              {{ throttleInvokeCount }}
            </a-tag>
          </div>
        </div>
      </div>
    </a-card>

    <!-- 8. useIntervalFn -->
    <a-card
      title="useIntervalFn - 定时器"
      :class="mb0ClassName"
    >
      <div :class="cardBodyClassName">
        <p :class="cn('text-sm', 'text-gray-500')">
          每秒递增的计数器
        </p>
        <div :class="flexWrapItemsCenterGap8ClassName">
          <div :class="valueDisplayClassName">
            {{ intervalCounter }}
          </div>
          <a-button
            :type="intervalPaused ? 'primary' : 'default'"
            @click="toggleInterval"
          >
            <template #icon>
              <Icon :icon="intervalPaused ? 'ant-design:caret-right-outlined' : 'ant-design:pause-outlined'" />
            </template>
            {{ intervalPaused ? '继续' : '暂停' }}
          </a-button>
          <a-button
            size="small"
            @click="intervalCounter = 0"
          >
            <template #icon>
              <Icon icon="ant-design:reload-outlined" />
            </template>
            重置
          </a-button>
          <a-tag :color="intervalActive ? 'success' : 'default'">
            {{ intervalActive ? '运行中' : '已暂停' }}
          </a-tag>
        </div>
      </div>
    </a-card>

    <!-- 9. useTimeoutFn -->
    <a-card
      title="useTimeoutFn - 延时回调"
      :class="mb0ClassName"
    >
      <div :class="cardBodyClassName">
        <p :class="cn('text-sm', 'text-gray-500')">
          点击开始后，3秒后显示消息
        </p>
        <div :class="flexWrapItemsCenterGap8ClassName">
          <a-button
            type="primary"
            :disabled="timeoutPending"
            @click="handleStartTimeout"
          >
            <template #icon>
              <Icon icon="ant-design:clock-circle-outlined" />
            </template>
            开始计时
          </a-button>
          <a-button
            :disabled="!timeoutPending"
            @click="handleCancelTimeout"
          >
            <template #icon>
              <Icon icon="ant-design:close-circle-outlined" />
            </template>
            取消
          </a-button>
          <a-tag
            v-if="timeoutPending"
            color="processing"
          >
            <template #icon>
              <Icon icon="ant-design:loading-outlined" />
            </template>
            等待中...
          </a-tag>
          <a-tag
            v-if="timeoutTriggered"
            color="success"
          >
            {{ timeoutMessage }}
          </a-tag>
          <a-tag
            v-if="timeoutMessage === '已取消'"
            color="warning"
          >
            {{ timeoutMessage }}
          </a-tag>
        </div>
      </div>
    </a-card>

    <!-- 10. useEventListener -->
    <a-card
      title="useEventListener - 键盘事件监听"
      :class="mb0ClassName"
    >
      <div :class="cardBodyClassName">
        <p :class="cn('text-sm', 'text-gray-500')">
          按下任意键盘按键查看效果
        </p>
        <div :class="borderDashedClassName">
          <div :class="flexWrapItemsCenterGap8ClassName">
            <div :class="textCenterPy12ClassName">
              <div :class="labelClassName">
                按键
              </div>
              <div :class="valueDisplayClassName">
                {{ lastKeyPressed || '—' }}
              </div>
            </div>
            <div :class="textCenterPy12ClassName">
              <div :class="labelClassName">
                键码
              </div>
              <div :class="valueDisplayClassName">
                {{ lastKeyCode || '—' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </a-card>

    <!-- 11. useNow -->
    <a-card
      title="useNow - 实时时间"
      :class="mb0ClassName"
    >
      <div :class="cardBodyClassName">
        <div :class="flexColGap4ClassName">
          <div :class="flexWrapItemsCenterGap4ClassName">
            <span :class="labelClassName">当前时间：</span>
            <span :class="valueDisplayClassName">{{ now.toLocaleString() }}</span>
          </div>
          <div :class="flexWrapItemsCenterGap4ClassName">
            <span :class="labelClassName">ISO 格式：</span>
            <span :class="valueDisplayMonoClassName">{{ now.toISOString() }}</span>
          </div>
          <div :class="flexWrapItemsCenterGap4ClassName">
            <span :class="labelClassName">时间戳：</span>
            <span :class="valueDisplayMonoClassName">{{ now.getTime() }}</span>
          </div>
        </div>
      </div>
    </a-card>

    <!-- 12. useStorage -->
    <a-card
      title="useStorage - 响应式存储（带类型）"
      :class="mb0ClassName"
    >
      <div :class="cardBodyClassName">
        <p :class="cn('text-sm', 'text-gray-500')">
          与 useLocalStorage 类似，但支持 TypeScript 类型，也使用项目的 localStorageCacheStorage
        </p>
        <div :class="flexColGap4ClassName">
          <div :class="flexWrapItemsCenterGap4ClassName">
            <span :class="labelClassName">姓名：</span>
            <a-input
              v-model:value="typedStorageValue.name"
              style="max-width: 200px"
            />
          </div>
          <div :class="flexWrapItemsCenterGap4ClassName">
            <span :class="labelClassName">年龄：</span>
            <a-input-number
              v-model:value="typedStorageValue.age"
              :min="0"
              :max="150"
              style="max-width: 200px"
            />
          </div>
          <div :class="flexWrapItemsCenterGap4ClassName">
            <a-button
              size="small"
              @click="typedStorageValue = { name: '张三', age: 25 }"
            >
              重置
            </a-button>
            <a-tag color="blue">
              存储对象：{{ JSON.stringify(typedStorageValue) }}
            </a-tag>
          </div>
        </div>
      </div>
    </a-card>

    <!-- 13. useFullscreen -->
    <a-card
      title="useFullscreen - 全屏切换"
      :class="mb0ClassName"
    >
      <div :class="cardBodyClassName">
        <div
          ref="fullscreenTarget"
          :class="fullscreenDemoClassName"
        >
          <p :class="cn('text-center', 'text-gray-500', 'mb-4')">
            这是全屏演示区域
          </p>
          <div
            :class="flexWrapItemsCenterGap4ClassName"
            style="justify-content: center"
          >
            <a-button
              v-if="!isFullscreenActive"
              type="primary"
              :disabled="!fullscreenSupported"
              @click="enterFullscreen"
            >
              <template #icon>
                <Icon icon="ant-design:fullscreen-outlined" />
              </template>
              进入全屏
            </a-button>
            <a-button
              v-else
              type="default"
              @click="exitFullscreen"
            >
              <template #icon>
                <Icon icon="ant-design:fullscreen-exit-outlined" />
              </template>
              退出全屏
            </a-button>
            <a-tag :color="isFullscreenActive ? 'success' : 'default'">
              {{ isFullscreenActive ? '全屏中' : '非全屏' }}
            </a-tag>
            <a-tag
              v-if="!fullscreenSupported"
              color="error"
            >
              浏览器不支持全屏
            </a-tag>
          </div>
        </div>
      </div>
    </a-card>

    <!-- 14. useOnline -->
    <a-card
      title="useOnline - 在线状态"
      :class="mb0ClassName"
    >
      <div :class="cardBodyClassName">
        <div :class="onlineStatusClassName">
          <div :class="online ? onlineDotClassName : offlineDotClassName" />
          <span :class="valueDisplayClassName">
            {{ online ? '在线 🟢' : '离线 🔴' }}
          </span>
          <a-tag :color="online ? 'success' : 'error'">
            {{ online ? '网络连接正常' : '网络连接断开' }}
          </a-tag>
        </div>
        <p :class="cn('text-sm', 'text-gray-400')">
          尝试断开网络连接测试此功能
        </p>
      </div>
    </a-card>

    <!-- 15. usePageLeave -->
    <a-card
      title="usePageLeave - 页面离开检测"
      :class="mb0ClassName"
    >
      <div :class="cardBodyClassName">
        <p :class="cn('text-sm', 'text-gray-500')">
          将鼠标移出浏览器页面视口触发检测
        </p>
        <div :class="flexWrapItemsCenterGap8ClassName">
          <div>
            <span :class="labelClassName">触发次数：</span>
            <a-tag color="purple">
              {{ pageLeaveCount }}
            </a-tag>
          </div>
          <a-button
            size="small"
            @click="pageLeaveCount = 0"
          >
            重置计数
          </a-button>
        </div>
        <div :class="borderDashedClassName">
          <p :class="cn('text-center', 'text-gray-400', 'mb-0')">
            将鼠标移出此页面（例如移到浏览器标签栏或地址栏）试试
          </p>
        </div>
      </div>
    </a-card>
  </div>
</template>

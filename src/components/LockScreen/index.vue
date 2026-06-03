<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Input, message } from 'antdv-next'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useUserStore } from '@/stores/modules/user'
import { cn } from '@/utils/cn'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'unlock': []
}>()

defineOptions({ name: 'LockScreen' })

const userStore = useUserStore()
const password = ref('')
const loading = ref(false)
const showPassword = ref(false)
const currentTime = ref('')
const currentDate = ref('')

// 锁屏背景图片
const bgImage = ref('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80')

// 定时器
let timeTimer: ReturnType<typeof setInterval> | null = null

// 全局键盘监听（按任意键唤醒）
function handleAnyKeyDown(e: KeyboardEvent) {
  // 忽略功能键组合
  if (e.ctrlKey || e.altKey || e.metaKey)
    return
  // 聚焦密码输入框
  const inputEl = document.querySelector('.lock-screen-password-input input') as HTMLInputElement
  if (inputEl && document.activeElement !== inputEl) {
    inputEl.focus()
  }
}

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

function handleUnlock() {
  if (!password.value) {
    message.warning('请输入密码')
    return
  }

  loading.value = true
  // 模拟验证延迟
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

function handleKeyPress(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    handleUnlock()
  }
}

watch(
  () => props.visible,
  (val) => {
    if (val) {
      updateTime()
      timeTimer = setInterval(updateTime, 1000)
      // 注册全局键盘监听（按任意键唤醒）
      document.addEventListener('keydown', handleAnyKeyDown)
      // 自动聚焦密码输入框
      setTimeout(() => {
        const inputEl = document.querySelector('.lock-screen-password-input input') as HTMLInputElement
        inputEl?.focus()
      }, 300)
    }
    else {
      if (timeTimer) {
        clearInterval(timeTimer)
        timeTimer = null
      }
      // 移除全局键盘监听
      document.removeEventListener('keydown', handleAnyKeyDown)
      password.value = ''
    }
  },
)

onMounted(() => {
  // 监听 ESC 键不关闭锁屏
})

onUnmounted(() => {
  if (timeTimer) {
    clearInterval(timeTimer)
  }
  // 确保移除键盘监听
  document.removeEventListener('keydown', handleAnyKeyDown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="lock-fade">
      <div
        v-if="visible"
        :class="cn('fixed inset-0 z-[9999] overflow-hidden', 'flex items-center justify-center')"
        @click.self="() => {}"
      >
        <!-- 背景 -->
        <div class="absolute inset-0">
          <img
            :src="bgImage"
            alt=""
            class="w-full h-full object-cover"
          >
          <!-- 渐变遮罩 -->
          <div class="absolute inset-0 bg-gradient-to-br from-black/70 via-gray-900/80 to-black/90" />
        </div>

        <!-- 内容区域 -->
        <div class="relative z-10 flex flex-col items-center w-full max-w-md px-8">
          <!-- 时间显示 -->
          <div class="text-center mb-10">
            <div class="text-7xl font-extralight text-white tracking-wider mb-3">
              {{ currentTime }}
            </div>
            <div class="text-lg text-white/60 font-light">
              {{ currentDate }}
            </div>
          </div>

          <!-- 用户信息 -->
          <div class="flex items-center gap-4 mb-8">
            <a-avatar
              :size="56"
              class="bg-primary text-xl"
            >
              {{ userStore.username?.charAt(0)?.toUpperCase() || 'U' }}
            </a-avatar>
            <div>
              <div class="text-xl text-white font-medium">
                {{ userStore.username || '用户' }}
              </div>
              <div class="text-sm text-white/50">
                请输入密码解锁屏幕
              </div>
            </div>
          </div>

          <!-- 密码输入框 -->
          <div class="w-full space-y-4">
            <Input.Password
              v-model:value="password"
              class="lock-screen-password-input"
              placeholder="请输入登录密码"
              size="large"
              :loading="loading"
              @pressEnter="handleUnlock"
            >
              <template #prefix>
                <Icon
                  icon="carbon:locked"
                  class="text-gray-400"
                />
              </template>
            </Input.Password>

            <button
              :disabled="loading || !password"
              :class="cn(
                'w-full py-3 rounded-lg text-white font-medium transition-all duration-200',
                'bg-primary hover:bg-primary/90 active:scale-[0.98]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'focus:outline-none focus:ring-2 focus:ring-primary/50',
              )"
              @click="handleUnlock"
            >
              <span v-if="!loading">解锁</span>
              <span
                v-else
                class="flex items-center justify-center gap-2"
              >
                <Icon
                  icon="carbon:renew"
                  class="animate-spin"
                />
                验证中...
              </span>
            </button>
          </div>

          <!-- 底部提示 -->
          <div class="mt-8 text-xs text-white/30 text-center">
            <p>提示：按任意键唤醒输入框</p>
          </div>
        </div>

        <!-- 装饰元素 -->
        <div class="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 text-white/20 text-sm">
          <Icon icon="carbon:shield-check" />
          <span>安全锁定</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 过渡动画 */
.lock-fade-enter-active,
.lock-fade-leave-active {
  transition: opacity 0.3s ease;
}
.lock-fade-enter-from,
.lock-fade-leave-to {
  opacity: 0;
}

/* 密码输入框样式覆盖 */
:deep(.lock-screen-password-input .ant-input) {
  background-color: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: white;
  height: 48px;
  font-size: 16px;
}

:deep(.lock-screen-password-input .ant-input::placeholder) {
  color: rgba(255, 255, 255, 0.4);
}

:deep(.lock-screen-password-input .ant-input:hover),
:deep(.lock-screen-password-input .ant-input:focus) {
  border-color: rgba(22, 119, 255, 0.6);
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.15);
}

:deep(.lock-screen-password-input .ant-input-prefix) {
  color: rgba(255, 255, 255, 0.4);
}

:deep(.lock-screen-password-input .ant-input-suffix) {
  color: rgba(255, 255, 255, 0.4);
}
</style>

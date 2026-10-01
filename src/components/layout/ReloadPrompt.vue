<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

defineOptions({ name: 'ReloadPrompt' })

/* ============================================================
 * 自动更新倒计时（秒）
 * 设为 0 关闭自动更新，只显示"立即更新"按钮
 * ============================================================ */
const AUTO_COUNTDOWN = 10

const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW({
  onRegisteredSW(swUrl, registration) {
    console.log('[PWA] Service Worker registered:', swUrl)
    if (registration && import.meta.env.PROD) {
      setInterval(() => registration.update(), 60 * 60 * 1000)
    }
  },
  onRegisterError(error: unknown) {
    console.error('[PWA] Service Worker registration failed:', error)
  },
})

/* ============================================================
 * 状态
 * ============================================================ */

const updating = ref(false)
const countdown = ref(0)

let countdownTimer: ReturnType<typeof setInterval> | null = null

const visible = computed(() => offlineReady.value || needRefresh.value)
const isUpdate = computed(() => needRefresh.value)

/** 倒计时进度 0~100 */
const countdownProgress = computed(() => {
  if (!isUpdate.value || countdown.value === 0) return 0
  return ((AUTO_COUNTDOWN - countdown.value) / AUTO_COUNTDOWN) * 100
})

/* ============================================================
 * 倒计时
 * ============================================================ */

function startCountdown() {
  stopCountdown()
  if (AUTO_COUNTDOWN <= 0) return
  countdown.value = AUTO_COUNTDOWN
  countdownTimer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      stopCountdown()
      void handleUpdate()
    }
  }, 1000)
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  countdown.value = 0
}

watch(
  () => needRefresh.value,
  (need) => {
    if (need) startCountdown()
    else stopCountdown()
  },
  { immediate: true },
)

onBeforeUnmount(stopCountdown)

/* ============================================================
 * 操作
 * ============================================================ */

async function handleUpdate() {
  stopCountdown()
  updating.value = true
  try {
    await updateServiceWorker(true)
  } catch (e) {
    console.error('[PWA] update failed:', e)
    updating.value = false
  }
}

function close() {
  stopCountdown()
  offlineReady.value = false
  needRefresh.value = false
}
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-3 scale-[0.97]"
    enter-to-class="opacity-100 translate-y-0 scale-100"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0 scale-100"
    leave-to-class="opacity-0 translate-y-2 scale-[0.97]"
  >
    <div
      v-if="visible"
      role="alert"
      aria-live="polite"
      class="fixed right-4 bottom-4 z-[9999] w-[calc(100vw-2rem)] max-w-[380px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.18),0_4px_12px_-6px_rgba(15,23,42,0.08)] backdrop-blur-xl backdrop-saturate-150 sm:w-[380px] dark:border-slate-700/60 dark:bg-slate-900/95 dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6),0_4px_12px_-6px_rgba(0,0,0,0.4)]"
    >
      <!-- 顶部渐变色带 -->
      <div
        class="absolute inset-x-0 top-0 h-px"
        :class="
          isUpdate
            ? 'bg-gradient-to-r from-transparent via-blue-500/80 to-transparent'
            : 'bg-gradient-to-r from-transparent via-emerald-500/80 to-transparent'
        "
      />

      <div class="flex items-start gap-3 p-4 pr-3">
        <!-- ⭐ 图标：慢速旋转 + 脉冲环 -->
        <div class="relative shrink-0">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-2xl transition-colors duration-300"
            :class="
              isUpdate
                ? 'text-ant-primary bg-blue-50 dark:bg-blue-500/15 dark:text-blue-400'
                : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-400'
            "
          >
            <Icon
              :icon="isUpdate ? 'carbon:update-now' : 'carbon:cloud-ok'"
              class="text-lg"
              :class="isUpdate && 'animate-[spin_3s_linear_infinite]'"
            />
          </div>
          <!-- 脉冲环（仅更新态显示） -->
          <span
            v-if="isUpdate"
            class="pointer-events-none absolute inset-0 animate-[ping_2.5s_ease-out_infinite] rounded-2xl bg-blue-400/20"
          />
        </div>

        <!-- 主体内容 -->
        <div class="min-w-0 flex-1">
          <h3 class="text-sm leading-5 font-semibold text-slate-800 dark:text-slate-100">
            {{ isUpdate ? '发现新版本' : '离线可用' }}
          </h3>

          <p class="mt-1 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
            {{ isUpdate ? '应用已更新，重新加载以获取最新内容。' : '应用已缓存到本地，断网也可继续使用。' }}
          </p>

          <!-- 操作按钮 -->
          <div class="mt-3 flex items-center gap-2">
            <template v-if="isUpdate">
              <a-button
                type="primary"
                size="small"
                :loading="updating"
                class="!h-8 !rounded-lg !px-3 !text-xs !font-medium"
                @click="handleUpdate"
              >
                <template #icon>
                  <Icon v-if="!updating" icon="carbon:renew" />
                </template>
                立即更新
              </a-button>

              <a-button
                size="small"
                class="!h-8 !rounded-lg !px-3 !text-xs !text-slate-500 hover:!text-slate-700 dark:!text-slate-400 dark:hover:!text-slate-200"
                @click="close"
              >
                稍后
                <span v-if="countdown > 0" class="ml-1 text-slate-400 tabular-nums dark:text-slate-500">
                  ({{ countdown }}s)
                </span>
              </a-button>
            </template>

            <a-button
              v-else
              type="primary"
              size="small"
              class="!h-8 !rounded-lg !px-3 !text-xs !font-medium"
              @click="close"
            >
              知道了
            </a-button>
          </div>
        </div>

        <!-- 关闭按钮：独立、不影响内容布局 -->
        <button
          type="button"
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="关闭"
          @click="close"
        >
          <Icon icon="carbon:close" class="text-sm" />
        </button>
      </div>

      <!-- ⭐ 底部倒计时进度条 -->
      <div v-if="isUpdate && countdown > 0" class="h-0.5 w-full bg-slate-100/80 dark:bg-slate-800/60">
        <div
          class="bg-ant-primary h-full transition-[width] duration-1000 ease-linear"
          :style="{ width: `${countdownProgress}%` }"
        />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* 无自定义 CSS —— 全部使用 Tailwind */
</style>

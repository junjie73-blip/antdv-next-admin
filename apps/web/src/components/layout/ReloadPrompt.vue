<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  useDocumentVisibility,
  useIntervalFn,
  useTimestamp,
  useTimeoutFn,
} from '@vueuse/core'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

defineOptions({ name: 'ReloadPrompt' })

const AUTO_COUNTDOWN = 10
const POLL_INTERVAL = 5 * 60 * 1000
const ROUTE_CHECK_THROTTLE = 30_000
const VISIBILITY_CHECK_DELAY = 1000

const router = useRouter()
const visibility = useDocumentVisibility()

/* ============================================================
 * PWA 注册
 * ============================================================ */
let swRegistration: ServiceWorkerRegistration | undefined

const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW({
  onRegisteredSW(swUrl, registration) {
    console.log('[PWA] Service Worker registered:', swUrl)
    if (!registration || !import.meta.env.PROD) return
    swRegistration = registration

    // useIntervalFn：自动挂载/卸载 interval
    const { pause: stopPolling, resume: startPolling } = useIntervalFn(
      () => {
        registration.update().catch(() => {})
      },
      POLL_INTERVAL,
      { immediate: false },
    )

    // useTimeoutFn：页面可见时的延迟检查
    const { start: startVisibilityCheck } = useTimeoutFn(
      () => {
        registration.update().catch(() => {})
        startPolling()
      },
      VISIBILITY_CHECK_DELAY,
      { immediate: false },
    )

    // 监听可见性：可见恢复轮询，不可见暂停
    watch(visibility, (v) => {
      if (v === 'visible') startVisibilityCheck()
      else stopPolling()
    })

    // 路由切换检查（节流）
    let lastRouteCheck = 0
    const removeRouterHook = router.afterEach(() => {
      const now = Date.now()
      if (now - lastRouteCheck < ROUTE_CHECK_THROTTLE) return
      lastRouteCheck = now
      registration.update().catch(() => {})
    })

    // 组件 scope 销毁时清理
    tryOnScopeDispose(() => {
      stopPolling()
      removeRouterHook()
    })

    startPolling()
  },
  onRegisterError(error: unknown) {
    console.error('[PWA] Service Worker registration failed:', error)
  },
})

/* ============================================================
 * 状态
 * ============================================================ */
const updating = ref(false)
const autoUpdateCancelled = ref(false)
const countdown = ref(0)

// useTimestamp：响应式毫秒时间戳，用来驱动倒计时
const endTime = ref(0)
const timestamp = useTimestamp({ interval: 500 })

const visible = computed(() => offlineReady.value || needRefresh.value)
const isUpdate = computed(() => needRefresh.value)

const countdownProgress = computed(() => {
  if (!isUpdate.value || countdown.value === 0) return 0
  return ((AUTO_COUNTDOWN - countdown.value) / AUTO_COUNTDOWN) * 100
})

/* ============================================================
 * 倒计时（用 useTimestamp 计算剩余秒数）
 * ============================================================ */
const { pause: stopCountdownInterval, resume: startCountdownInterval } =
  useIntervalFn(
    () => {
      const remaining = Math.max(
        0,
        Math.ceil((endTime.value - timestamp.value) / 1000),
      )
      countdown.value = remaining
      if (remaining <= 0) {
        stopCountdownInterval()
        void handleUpdate()
      }
    },
    500,
    { immediate: false },
  )

function startCountdown() {
  if (AUTO_COUNTDOWN <= 0 || autoUpdateCancelled.value) return
  countdown.value = AUTO_COUNTDOWN
  endTime.value = Date.now() + AUTO_COUNTDOWN * 1000
  startCountdownInterval()
}

function stopCountdown() {
  stopCountdownInterval()
  countdown.value = 0
}

watch(
  () => needRefresh.value,
  (need) => {
    if (need) {
      autoUpdateCancelled.value = false
      startCountdown()
    } else {
      stopCountdown()
    }
  },
  { immediate: true },
)

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

function handleLater() {
  stopCountdown()
  autoUpdateCancelled.value = true
}

function close() {
  stopCountdown()
  offlineReady.value = false
  needRefresh.value = false
}

/* ============================================================
 * 开发调试
 * ============================================================ */
onMounted(() => {
  ;(window as any).__pwaCheckUpdate = async () => {
    const reg = swRegistration ?? (await navigator.serviceWorker.ready)
    await reg.update()
    console.log('[PWA] Manual update check triggered')
  }
})

// 顶层清理：组件卸载时取消倒计时
tryOnScopeDispose(stopCountdown)
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
      <div
        class="absolute inset-x-0 top-0 h-px"
        :class="
          isUpdate
            ? 'bg-gradient-to-r from-transparent via-blue-500/80 to-transparent'
            : 'bg-gradient-to-r from-transparent via-emerald-500/80 to-transparent'
        "
      />

      <div class="flex items-start gap-3 p-4 pr-3">
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
          <span
            v-if="isUpdate"
            class="pointer-events-none absolute inset-0 animate-[ping_2.5s_ease-out_infinite] rounded-2xl bg-blue-400/20"
          />
        </div>

        <div class="min-w-0 flex-1">
          <h3
            class="text-sm leading-5 font-semibold text-slate-800 dark:text-slate-100"
          >
            {{ isUpdate ? '发现新版本' : '离线可用' }}
          </h3>

          <p
            class="mt-1 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400"
          >
            {{
              isUpdate
                ? autoUpdateCancelled
                  ? '已暂停自动更新，点击「立即更新」获取最新内容。'
                  : '应用已更新，重新加载以获取最新内容。'
                : '应用已缓存到本地，断网也可继续使用。'
            }}
          </p>

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
                @click="handleLater"
              >
                稍后
                <span
                  v-if="countdown > 0 && !autoUpdateCancelled"
                  class="ml-1 text-slate-400 tabular-nums dark:text-slate-500"
                >
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

        <button
          type="button"
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="关闭"
          @click="close"
        >
          <Icon icon="carbon:close" class="text-sm" />
        </button>
      </div>

      <div
        v-if="isUpdate && countdown > 0 && !autoUpdateCancelled"
        class="h-0.5 w-full bg-slate-100/80 dark:bg-slate-800/60"
      >
        <div
          class="bg-ant-primary h-full transition-[width] duration-1000 ease-linear"
          :style="{ width: `${countdownProgress}%` }"
        />
      </div>
    </div>
  </Transition>
</template>

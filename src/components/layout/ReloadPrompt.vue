<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

defineOptions({ name: 'ReloadPrompt' })

/* ============================================================
 * 配置
 * ============================================================ */
const AUTO_COUNTDOWN = 10 // 倒计时秒数，0 = 关闭自动更新
const POLL_INTERVAL = 5 * 60 * 1000 // 轮询间隔 5 分钟
const ROUTE_CHECK_THROTTLE = 30_000 // 路由切换检查节流 30 秒
const VISIBILITY_CHECK_DELAY = 1000 // 页面可见后延迟 1 秒检查

const router = useRouter()

/* ============================================================
 * PWA 注册
 * ============================================================ */
const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW({
  onRegisteredSW(swUrl, registration) {
    console.log('[PWA] Service Worker registered:', swUrl)
    if (!registration || !import.meta.env.PROD) return

    let pollTimer: ReturnType<typeof setInterval> | null = null
    let lastRouteCheck = 0
    let visibilityTimer: ReturnType<typeof setTimeout> | null = null

    /* ---------- 1. 定时轮询 ---------- */
    const startPolling = () => {
      if (pollTimer) return
      pollTimer = setInterval(() => {
        registration.update().catch(() => {})
      }, POLL_INTERVAL)
    }

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }

    /* ---------- 2. 页面可见性感知 ---------- */
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // 页面回到前台 → 延迟 1 秒检查（避免刚切换就抢占资源）
        if (visibilityTimer) clearTimeout(visibilityTimer)
        visibilityTimer = setTimeout(() => {
          registration.update().catch(() => {})
          startPolling()
        }, VISIBILITY_CHECK_DELAY)
      } else {
        // 页面切到后台 → 暂停轮询，节省资源
        stopPolling()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    /* ---------- 3. 路由切换检查（节流 30 秒） ---------- */
    const removeRouterHook = router.afterEach(() => {
      const now = Date.now()
      if (now - lastRouteCheck < ROUTE_CHECK_THROTTLE) return
      lastRouteCheck = now
      registration.update().catch(() => {})
    })

    /* ---------- 4. WebSocket 推送（可选） ---------- */
    // 如果项目里有 wsManager，可以监听 'pwa-update' 消息
    // import { wsManager } from '~/core/ws/manager'
    // const offWs = wsManager.onMessage((msg) => {
    //   if (msg.type === 'pwa-update') {
    //     registration.update().catch(() => {})
    //   }
    // })

    /* ---------- 5. 启动 ---------- */
    startPolling()

    /* ---------- 6. 清理（SW 卸载或页面销毁时） ---------- */
    // 注意：这个 onRegisteredSW 回调里没法直接 onBeforeUnmount，
    //       用 window 事件监听兜底
    window.addEventListener('beforeunload', () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibility)
      if (visibilityTimer) clearTimeout(visibilityTimer)
      removeRouterHook()
    })
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
const autoUpdateCancelled = ref(false) // ⭐ 用户取消自动更新

let countdownTimer: ReturnType<typeof setInterval> | null = null

const visible = computed(() => offlineReady.value || needRefresh.value)
const isUpdate = computed(() => needRefresh.value)

const countdownProgress = computed(() => {
  if (!isUpdate.value || countdown.value === 0) return 0
  return ((AUTO_COUNTDOWN - countdown.value) / AUTO_COUNTDOWN) * 100
})

/* ============================================================
 * 倒计时
 * ============================================================ */
function startCountdown() {
  stopCountdown()
  if (AUTO_COUNTDOWN <= 0 || autoUpdateCancelled.value) return
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
    if (need) {
      // ⭐ 发现新版本时重置取消标记
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

/** ⭐ 用户点"稍后"：取消自动更新，只保留手动更新入口 */
function handleLater() {
  stopCountdown()
  autoUpdateCancelled.value = true
  // 不关闭弹窗，用户想更新还能点"立即更新"
}

/** ⭐ 用户点"X"：完全关闭弹窗，本次会话不再提示 */
function close() {
  stopCountdown()
  offlineReady.value = false
  needRefresh.value = false
}

onBeforeUnmount(stopCountdown)

/* ============================================================
 * 暴露给外部的调试方法（可选）
 * ============================================================ */
onMounted(() => {
  // 供开发者调试：window.__pwaCheckUpdate()
  ;(window as any).__pwaCheckUpdate = async () => {
    const reg = await navigator.serviceWorker.ready
    await reg.update()
    console.log('[PWA] Manual update check triggered')
  }
})
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
          <h3 class="text-sm leading-5 font-semibold text-slate-800 dark:text-slate-100">
            {{ isUpdate ? '发现新版本' : '离线可用' }}
          </h3>

          <p class="mt-1 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
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

<style scoped>
/* 无自定义 CSS */
</style>

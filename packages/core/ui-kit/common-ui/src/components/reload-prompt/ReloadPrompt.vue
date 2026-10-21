<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { Button } from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';
import {
  tryOnScopeDispose,
  useDocumentVisibility,
  useIntervalFn,
  useTimeoutFn,
  useTimestamp,
} from '@vueuse/core';

defineOptions({ name: 'ReloadPrompt' });

const props = withDefaults(defineProps<Props>(), {
  autoCountdown: 10,
  offlineReady: false,
  onCheckUpdate: undefined,
  pollInterval: 5 * 60 * 1000,
  visibilityCheckDelay: 1000,
  needRefresh: false,
});

const emit = defineEmits<{
  /** 用户点「立即更新」或倒计时到点：宿主在这一步调 `updateServiceWorker(true)` */
  update: [reloadPage: boolean];
  /** 关闭 / 「知道了」：宿主据此清掉自己的两个状态 */
  dismiss: [];
}>();

interface Props {
  /** 提示出现后多少秒自动更新；0 或负数表示不自动更新 */
  autoCountdown?: number;
  /** 离线就绪态（`useRegisterSW` 的 offlineReady） */
  offlineReady?: boolean;
  /** 轮询 SW 更新的间隔（毫秒） */
  pollInterval?: number;
  /** 页面重新可见后延迟多久再检查一次（毫秒） */
  visibilityCheckDelay?: number;
  /** 有新版本待刷新（`useRegisterSW` 的 needRefresh） */
  needRefresh?: boolean;
  /**
   * 宿主提供的「去问一次有没有新版本」。
   *
   * `virtual:pwa-register/vue` 是 Vite 插件注入的虚拟模块，公共组件包里引它，
   * 本包自己的 lib 构建与单测就解析不到（虚拟模块只存在于装了插件的宿主图上），
   * 所以注册 Service Worker 这一步留在宿主侧，这里只负责什么时候该问一次。
   */
  onCheckUpdate?: () => Promise<void> | void;
}

// 路由切换节流：与迁移前一致，30 秒内不重复问
const ROUTE_CHECK_THROTTLE = 30_000;

const visibility = useDocumentVisibility();

const updating = ref(false);
const autoUpdateCancelled = ref(false);
const countdown = ref(0);

// useTimestamp：响应式毫秒时间戳，用来驱动倒计时
const endTime = ref(0);
const timestamp = useTimestamp({ interval: 500 });

const visible = computed(() => props.offlineReady || props.needRefresh);
const isUpdate = computed(() => props.needRefresh);

const countdownProgress = computed(() => {
  if (!isUpdate.value || countdown.value === 0) return 0;
  return ((props.autoCountdown - countdown.value) / props.autoCountdown) * 100;
});

function checkUpdate() {
  return props.onCheckUpdate?.();
}

/* ============================================================
 * 轮询：更新检查的节奏都在这——定时 + 可见性恢复 + 路由切换节流
 * ============================================================ */
const { pause: stopPolling, resume: startPolling } = useIntervalFn(
  () => void checkUpdate(),
  () => props.pollInterval,
  { immediate: false },
);

const { start: startVisibilityCheck } = useTimeoutFn(
  () => {
    void checkUpdate();
    startPolling();
  },
  () => props.visibilityCheckDelay,
  { immediate: false },
);

// 监听可见性：可见恢复轮询，不可见暂停
watch(visibility, (v) => {
  if (v === 'visible') startVisibilityCheck();
  else stopPolling();
});

let lastRouteCheck = 0;
/**
 * 路由切换时的检查入口。迁移前是本组件自己 `useRouter().afterEach(...)`，
 * 公共包不吃 vue-router，改成宿主在自己的路由钩子里调这一句（节流仍在组件里）。
 */
function onRouteChange() {
  const now = Date.now();
  if (now - lastRouteCheck < ROUTE_CHECK_THROTTLE) return;
  lastRouteCheck = now;
  void checkUpdate();
}

/* ============================================================
 * 倒计时（用 useTimestamp 计算剩余秒数）
 * ============================================================ */
const { pause: stopCountdownInterval, resume: startCountdownInterval } =
  useIntervalFn(
    () => {
      const remaining = Math.max(
        0,
        Math.ceil((endTime.value - timestamp.value) / 1000),
      );
      countdown.value = remaining;
      if (remaining <= 0) {
        stopCountdownInterval();
        void handleUpdate();
      }
    },
    500,
    { immediate: false },
  );

function startCountdown() {
  if (props.autoCountdown <= 0 || autoUpdateCancelled.value) return;
  countdown.value = props.autoCountdown;
  endTime.value = Date.now() + props.autoCountdown * 1000;
  startCountdownInterval();
}

function stopCountdown() {
  stopCountdownInterval();
  countdown.value = 0;
}

watch(
  () => props.needRefresh,
  (need) => {
    if (need) {
      autoUpdateCancelled.value = false;
      startCountdown();
    } else {
      stopCountdown();
    }
  },
  { immediate: true },
);

/* ============================================================
 * 操作
 * ============================================================ */
function handleUpdate() {
  stopCountdown();
  // 与迁移前一致：只有失败才复位按钮的 loading —— 成功就意味着页面要重载，没有下一步
  updating.value = true;
  emit('update', true);
}

function handleLater() {
  stopCountdown();
  autoUpdateCancelled.value = true;
}

function close() {
  stopCountdown();
  emit('dismiss');
}

/* ============================================================
 * 装配：一挂上就开始轮询
 * ============================================================ */
onMounted(() => {
  startPolling();
});

// 顶层清理：组件卸载时取消倒计时与轮询
tryOnScopeDispose(() => {
  stopCountdown();
  stopPolling();
});

defineExpose({ checkUpdate, onRouteChange });
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
      ></div>

      <div class="flex items-start gap-3 p-4 pr-3">
        <div class="relative shrink-0">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-2xl transition-colors duration-300"
            :class="
              isUpdate
                ? 'text-primary bg-blue-50 dark:bg-blue-500/15 dark:text-blue-400'
                : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-400'
            "
          >
            <Icon
              :icon="
                isUpdate ? 'carbon:update-now' : 'carbon:checkmark-outline'
              "
              class="text-lg"
              :class="isUpdate && 'animate-[spin_3s_linear_infinite]'"
            />
          </div>
          <span
            v-if="isUpdate"
            class="pointer-events-none absolute inset-0 animate-[ping_2.5s_ease-out_infinite] rounded-2xl bg-blue-400/20"
          ></span>
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
              <Button
                size="sm"
                :disabled="updating"
                class="h-8 rounded-lg px-3 text-xs font-medium"
                @click="handleUpdate"
              >
                <Icon v-if="!updating" icon="carbon:renew" />
                立即更新
              </Button>

              <Button
                variant="outline"
                size="sm"
                class="h-8 rounded-lg px-3 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                @click="handleLater"
              >
                稍后
                <span
                  v-if="countdown > 0 && !autoUpdateCancelled"
                  class="ml-1 text-slate-400 tabular-nums dark:text-slate-500"
                >
                  ({{ countdown }}s)
                </span>
              </Button>
            </template>

            <Button
              v-else
              size="sm"
              class="h-8 rounded-lg px-3 text-xs font-medium"
              @click="close"
            >
              知道了
            </Button>
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
          class="bg-primary h-full transition-[width] duration-1000 ease-linear"
          :style="{ width: `${countdownProgress}%` }"
        ></div>
      </div>
    </div>
  </Transition>
</template>

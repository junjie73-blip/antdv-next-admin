<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { useRegisterSW } from "virtual:pwa-register/vue";
import { computed, ref } from "vue";

defineOptions({ name: "ReloadPrompt" });

const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW({
  // 可选：注册成功后的钩子
  onRegisteredSW(swUrl, registration) {
    console.log("[PWA] Service Worker registered:", swUrl);
    // 每小时检查一次更新（生产环境可选）
    if (registration && import.meta.env.PROD) {
      setInterval(
        () => {
          registration.update();
        },
        60 * 60 * 1000,
      );
    }
  },
  onRegisterError(error: any) {
    console.error("[PWA] Service Worker registration failed:", error);
  },
});

/** 主动更新中 */
const updating = ref(false);

/** 显示状态（任一为真就展示） */
const visible = computed(() => offlineReady.value || needRefresh.value);

/** 是否为"有新内容"状态 */
const isUpdate = computed(() => needRefresh.value);

/** 点击"立即更新" */
async function handleUpdate() {
  updating.value = true;
  try {
    // reloadPage = true 会在 SW 激活后自动刷新页面
    await updateServiceWorker(true);
  } catch (e) {
    console.error("[PWA] update failed:", e);
    updating.value = false;
  }
  // 注意：如果 reloadPage 为 true，这里不会被继续执行
  // 如果为 false，需要手动刷新
}

/** 关闭提示 */
function close() {
  offlineReady.value = false;
  needRefresh.value = false;
}
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-4"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-2"
  >
    <div
      v-if="visible"
      role="alert"
      aria-live="polite"
      class="fixed right-4 bottom-4 z-[9999] max-w-[360px] w-[calc(100vw-2rem)] sm:w-auto rounded-2xl overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl backdrop-saturate-150 border border-slate-200/80 dark:border-slate-700/60 shadow-[0_8px_32px_-8px_rgba(15,23,42,0.15),0_4px_12px_-4px_rgba(15,23,42,0.08)] dark:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)]"
    >
      <!-- 顶部高光条 -->
      <div
        class="absolute inset-x-0 top-0 h-[2px]"
        :class="
          isUpdate
            ? 'bg-gradient-to-r from-transparent via-blue-500 to-transparent'
            : 'bg-gradient-to-r from-transparent via-emerald-500 to-transparent'
        "
      />

      <div class="flex items-start gap-3 p-4">
        <!-- 图标 -->
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          :class="
            isUpdate
              ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-500'
              : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-500'
          "
        >
          <Icon :icon="isUpdate ? 'carbon:update-now' : 'carbon:cloud-ok'" class="text-lg" />
        </div>

        <!-- 内容 -->
        <div class="flex-1 min-w-0">
          <div class="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
            {{ isUpdate ? "发现新版本" : "离线可用" }}
          </div>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {{
              isUpdate
                ? "应用已更新，点击下方按钮重新加载以获取最新内容。"
                : "应用已缓存到本地，即使断网也可继续使用。"
            }}
          </p>

          <!-- 操作按钮 -->
          <div class="mt-3 flex items-center gap-2">
            <a-button
              v-if="isUpdate"
              type="primary"
              size="small"
              :loading="updating"
              class="!rounded-lg !text-xs"
              @click="handleUpdate"
            >
              <template #icon>
                <Icon v-if="!updating" icon="carbon:renew" />
              </template>
              立即更新
            </a-button>

            <a-button
              size="small"
              class="!rounded-lg !text-xs !text-slate-500 hover:!text-slate-700 dark:!text-slate-400 dark:hover:!text-slate-200"
              @click="close"
            >
              稍后
            </a-button>
          </div>
        </div>

        <!-- 关闭按钮（右上角） -->
        <button
          type="button"
          class="shrink-0 -mr-1 -mt-1 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors duration-200"
          aria-label="关闭"
          @click="close"
        >
          <Icon icon="carbon:close" class="text-base" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* 无自定义 CSS —— 全部使用 Tailwind */
</style>

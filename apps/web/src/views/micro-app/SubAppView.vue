<script setup lang="ts">
import type { MicroAppConfig } from '@antdv/types';

import { computed, onActivated, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { cn } from '@antdv/shared/cn';
import { buildIframeSandbox, canEscapeSandbox } from '@antdv/shared/iframe';
import { microAppConfig as registry } from '~/config/micro-app';
import { useUserStore } from '~/stores/modules/user';

interface Props {
  className?: string;
}

const props = defineProps<Props>();

const route = useRoute();
const userStore = useUserStore();

const microAppRef = ref<HTMLElement | null>(null);
const isLoading = ref(true);
const hasError = ref(false);

/** 注册表里可预览的子应用，供 ?app=<name> 挑选 */
const registryApps = registry.apps;

/**
 * 解析本页要加载哪个子应用，优先级：
 * 1. 路由 meta.microApp —— 由菜单/路由显式声明，生产用法；
 * 2. query `?app=<name>` —— 让人不改代码就能试注册表里的任意一个；
 * 3. 注册表里第一个 running 的应用 —— 菜单直接点进来就有东西可看。
 *
 * 之前只有第 1 条，而菜单 `/micro-app/SubAppView` 并没有配 meta，
 * 于是这个页面永远落在"配置不存在"的调试面板上，等于菜单里挂了个死页。
 */
const microAppConfig = computed<MicroAppConfig | undefined>(() => {
  const fromMeta = (route.meta as any)?.microApp as MicroAppConfig | undefined;
  if (fromMeta?.url) return fromMeta;

  const queryName = route.query.app;
  const picked =
    registryApps.find((a) => a.name === queryName) ??
    registryApps.find((a) => a.active) ??
    registryApps[0];
  if (!picked) return undefined;

  return {
    baseroute: picked.baseroute ?? '',
    keepAlive: true,
    name: picked.name,
    sameOrigin: picked.sameOrigin,
    title: picked.title,
    url: picked.url,
  };
});

const isEnabled = computed(() => registry.enabled);

// 判断是否为外部站点（使用 iframe 而非 micro-app）
const isExternalUrl = computed(() => {
  const url = microAppConfig.value?.url;
  return !!url && (url.startsWith('https://') || url.startsWith('http://'));
});

// micro-app 库是否可用：SDK 是运行时才注册 <micro-app> 自定义元素的，加载与否决定走哪条嵌入路径
const isMicroAppReady = computed(() => !!(window as any).microApp);

// 外部站点用 iframe，内部微前端用 micro-app 组件
const useIframe = computed(() => isExternalUrl.value || !isMicroAppReady.value);

// iframe 的稳定 key——只在 URL 变化时才重建 iframe
const iframeKey = computed(() => microAppConfig.value?.url ?? 'empty');

/**
 * 嵌入框架的 sandbox。默认不含 allow-same-origin：
 * 与 allow-scripts 同时开就是浏览器告警的"sandbox 可被逃逸"组合，
 * 框架脚本能顺着同源身份访问顶层文档、读主应用 token。
 * 只有同域部署、确需共享登录态的子应用才在配置里显式打开 sameOrigin。
 */
const sandbox = computed(() =>
  buildIframeSandbox({ sameOrigin: microAppConfig.value?.sameOrigin }),
);
const sandboxEscapable = computed(() => canEscapeSandbox(sandbox.value));

const containerClassName = computed(() =>
  cn('micro-app-wrapper', 'w-full h-full', props.className),
);

const loadingClassName = computed(() =>
  cn(
    'absolute inset-0 flex items-center justify-center',
    'bg-white/80 dark:bg-gray-900/80',
    'z-10',
  ),
);

const errorClassName = computed(() =>
  cn(
    'absolute inset-0 flex flex-col items-center justify-center',
    'bg-white dark:bg-gray-800',
    'z-20',
  ),
);

const token = computed(() => userStore.token);
const userInfo = computed(() => userStore.userInfo);

function sendDataToChild() {
  if (!microAppRef.value || !microAppConfig.value || useIframe.value) return;

  const childWindow = (microAppRef.value as any).getRootElement?.();
  if (childWindow) {
    childWindow.dispatchEvent(
      new CustomEvent('main-app-data', {
        detail: {
          token: token.value,
          userInfo: userInfo.value,
          route: {
            path: route.path,
            query: route.query,
            params: route.params,
          },
        },
      }),
    );
  }
}

function handleMounted() {
  isLoading.value = false;
  sendDataToChild();
}

function handleError(err: Event) {
  console.error('[SubAppView] micro-app error:', err);
  isLoading.value = false;
  hasError.value = true;
}

function handleUnmount() {
  isLoading.value = true;
  hasError.value = false;
}

function handleIframeLoad() {
  isLoading.value = false;
  hasError.value = false;
}

function handleIframeError() {
  console.error('[SubAppView] iframe load error');
  isLoading.value = false;
  hasError.value = true;
}

function retry() {
  hasError.value = false;
  isLoading.value = true;
  if (useIframe.value && microAppRef.value) {
    const iframeEl = microAppRef.value.querySelector(
      'iframe',
    ) as HTMLIFrameElement;
    if (iframeEl) {
      // 强制刷新 iframe
      const src = iframeEl.src;
      iframeEl.src = 'about:blank';
      setTimeout(() => {
        iframeEl.src = src;
      }, 50);
      return;
    }
  }
  if (!useIframe.value && microAppRef.value) {
    const microAppElement = microAppRef.value.querySelector('micro-app');
    if (microAppElement) {
      (microAppElement as any).reload();
    }
  }
}

watch(token, () => {
  sendDataToChild();
});

onMounted(() => {
  if (!useIframe.value) {
    microAppRef.value?.addEventListener('mounted', handleMounted);
    microAppRef.value?.addEventListener('error', handleError);
    microAppRef.value?.addEventListener('unmount', handleUnmount);
  }
});

// keep-alive 激活时检测并恢复 iframe 状态
onActivated(() => {
  if (useIframe.value) {
    // iframe 模式：检测 contentWindow 是否被清空，必要时重新加载
    const iframeEl = microAppRef.value?.querySelector(
      'iframe',
    ) as HTMLIFrameElement | null;
    if (
      iframeEl &&
      (!iframeEl.contentWindow ||
        !iframeEl.contentDocument ||
        iframeEl.contentDocument.readyState === 'uninitialized')
    ) {
      hasError.value = false;
      isLoading.value = true;
      // 重新设置 src 触发重新加载
      const currentSrc = iframeEl.src;
      iframeEl.src = 'about:blank';
      setTimeout(() => {
        iframeEl.src = currentSrc;
      }, 50);
    } else if (!hasError.value) {
      isLoading.value = false;
    }
  }
});

onUnmounted(() => {
  if (!useIframe.value) {
    microAppRef.value?.removeEventListener('mounted', handleMounted);
    microAppRef.value?.removeEventListener('error', handleError);
    microAppRef.value?.removeEventListener('unmount', handleUnmount);
  }
});
</script>

<template>
  <!-- 功能未启用：只说明状态，不去"假装"嵌了个子应用 -->
  <div
    v-if="!isEnabled"
    class="flex h-full flex-col items-center justify-center gap-2 p-6 text-center"
    style="min-height: 300px"
  >
    <Icon icon="carbon:warning-alt" class="text-4xl text-yellow-500" />
    <p class="font-medium text-gray-600 dark:text-gray-300">
      微前端功能未启用
    </p>
    <p class="max-w-md text-xs text-gray-400">
      在 <code>.env</code> 中设置
      <code>VITE_MICRO_APP=true</code>
      并重启，本页会按注册表加载子应用
      <template v-if="microAppConfig">
        （当前选中：{{ microAppConfig.title ?? microAppConfig.name }}）
</template>
    </p>
  </div>

  <!-- 注册表为空 / 菜单没配 meta：干净的空状态，不再打印调试 JSON -->
  <div
    v-else-if="!microAppConfig"
    class="flex h-full flex-col items-center justify-center gap-2 p-6 text-center"
    style="min-height: 300px"
  >
    <Icon icon="carbon:application" class="text-4xl text-gray-300" />
    <p class="font-medium text-gray-600 dark:text-gray-300">未指定子应用</p>
    <p class="max-w-md text-xs text-gray-400">
      在菜单或路由的 <code>meta.microApp</code> 中声明 name / url，
      或在 <code>src/config/micro-app.ts</code> 的注册表里登记一个子应用
    </p>
  </div>

  <!-- 有目标时：渲染嵌入内容 -->
  <div v-else ref="microAppRef" :class="containerClassName">
    <!-- 外部站点 / SDK 未就绪：使用 iframe 嵌入 -->
    <iframe
      v-if="useIframe"
      :key="iframeKey"
      :src="microAppConfig.url"
      class="w-full rounded-lg border-0"
      style="width: 100%; height: 100%"
      frameborder="0"
      allow="clipboard-write; autoplay; fullscreen"
      :sandbox="sandbox"
      @load="handleIframeLoad"
      @error="handleIframeError"
    ></iframe>

    <!-- 内部微前端：使用 micro-app 自定义元素（由 SDK 在运行时注册） -->
    <micro-app
      v-else
      :name="microAppConfig.name"
      :url="microAppConfig.url"
      :baseroute="microAppConfig.baseroute"
      :keep-alive="microAppConfig.keepAlive ?? true"
      :disable-memory-router="microAppConfig.disableMemoryRouter ?? true"
      :disable-patch-request="microAppConfig.disablePatchRequest ?? false"
      :inline="microAppConfig.inline ?? false"
      :destroy="microAppConfig.destroy ?? false"
      :data="{
        token,
        userInfo,
        route: {
          path: route.path,
          query: route.query,
          params: route.params,
        },
      }"
    />

    <!-- 加载态 -->
    <div v-if="isLoading" :class="loadingClassName">
      <a-spin size="large" />
      <p class="mt-2 text-sm text-gray-500">
        正在加载 {{ microAppConfig.title ?? microAppConfig.name }}...
      </p>
    </div>

    <!-- 打开了同源身份：把风险标出来，别让它藏在配置里 -->
    <a-tag
      v-if="sandboxEscapable"
      color="orange"
      class="absolute top-2 right-2 z-20"
    >
      同源预览
    </a-tag>

    <!-- 错误态 -->
    <div v-if="hasError" :class="errorClassName">
      <Icon icon="carbon:cloud-offline" class="mb-4 text-5xl text-red-500" />
      <p class="mb-4 text-gray-600 dark:text-gray-400">子应用加载失败</p>
      <p class="mb-4 max-w-xs text-center text-xs break-all text-gray-400">
        {{ microAppConfig.url }}
      </p>
      <a-button type="primary" @click="retry"> 重试 </a-button>
    </div>
  </div>
</template>

<style scoped>
.micro-app-wrapper {
  position: relative;
}
</style>

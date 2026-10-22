<script setup lang="tsx">
import type { MicroAppItem } from '@antdv/types';

import { computed, ref, watch } from 'vue';

import { PageHeader, Scrollbar, Tag, Tooltip } from '@antdv/common-ui';
import {
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import {
  buildIframeSandbox,
  canEscapeSandbox,
} from '@antdv/shared/utils/iframe';
import { Icon } from '@iconify/vue';
import { getAllMicroApps, microAppConfig } from '~/config/micro-app';

/** 状态下拉框的选项（原来是 antd 的 SelectOption 子节点） */
const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '运行中', value: 'running' },
  { label: '已停止', value: 'stopped' },
];

// 状态
const apps = ref<MicroAppItem[]>(getAllMicroApps());
const isEnabled = computed(() => microAppConfig.enabled);
const searchKeyword = ref('');
const statusFilter = ref<string>('all');
const activeAppKey = ref<string>('');
const iframeLoaded = ref<Record<string, boolean>>({});
const iframeLoading = ref<null | string>(null);

// 当前选中的子应用
const currentApp = computed(() => {
  return apps.value.find((app) => app.name === activeAppKey.value) || null;
});

// 筛选后的列表
const filteredApps = computed(() => {
  return apps.value.filter((app) => {
    const matchKeyword =
      !searchKeyword.value ||
      app.title.includes(searchKeyword.value) ||
      app.name.includes(searchKeyword.value) ||
      (app.owner && app.owner.includes(searchKeyword.value));
    const matchStatus =
      statusFilter.value === 'all' ||
      (statusFilter.value === 'running' ? app.active : !app.active);
    return matchKeyword && matchStatus;
  });
});

// 样式类名
// 概览小卡嵌在左侧面板里：用 muted 而不是 card，否则和外面的面板一个颜色、看不出是格子
// 内边距留给模板上的 `p-2` 指定 —— 这里再写 `p-4` 会出现两个 padding 档位打架
const statCardClassName = cn(
  'bg-muted border-border rounded-lg border transition-shadow hover:shadow-md',
);

function getStatusTagClass(active: boolean) {
  return cn(
    'rounded-full px-2.5 py-1 text-xs font-medium',
    active
      ? 'bg-success/15 text-success'
      : 'bg-muted border-border text-muted-foreground border',
  );
}

/**
 * 加载方式标签。
 *
 * iframe 与 Web Component 是两类东西，颜色要能分开；但不能写死 `purple-50` / `blue-50`
 * 那类调色板色 —— 换预设时它们不跟主色走，深浅色下还得各配一遍 dark。
 * 这里用状态色与主色的淡档：iframe 走 warning（隔离成本高），WC 走主色。
 */
function getLoaderBadgeClass(loader?: string) {
  if (loader === 'iframe') {
    return cn('bg-warning/15 text-warning rounded-sm px-2 py-0.5 text-xs');
  }
  return cn('bg-primary/10 text-primary rounded-sm px-2 py-0.5 text-xs');
}

// 操作函数
function handleToggleStatus(app: MicroAppItem) {
  app.active = !app.active;
}

function handleSelectApp(app: MicroAppItem) {
  activeAppKey.value = app.name;
}

function handleIframeLoad(name: string) {
  iframeLoaded.value[name] = true;
  iframeLoading.value = null;
}

function handleIframeError(name: string) {
  iframeLoaded.value[name] = false;
  iframeLoading.value = null;
}

function _handleResetFilters() {
  searchKeyword.value = '';
  statusFilter.value = 'all';
}

function handleRefreshIframe() {
  if (!currentApp.value) return;
  iframeLoaded.value[currentApp.value.name] = false;
  const iframeEl = document.querySelector(
    `iframe[data-app="${currentApp.value.name}"]`,
  ) as HTMLIFrameElement;
  if (iframeEl) {
    // 强制刷新 iframe
    const src = iframeEl.src;
    iframeEl.src = 'about:blank';
    setTimeout(() => {
      iframeEl.src = src;
    }, 50);
  }
}

// 获取子应用预览 URL
function previewUrl(app: MicroAppItem): string {
  return app.url ?? '';
}

/**
 * 预览 iframe 的 sandbox。
 *
 * 不再硬编码 `allow-scripts allow-same-origin`：那两个同时给就是浏览器告警的
 * "sandbox 可被逃逸"组合（框架脚本能顺着同源身份爬到顶层文档读主应用 token）。
 * 默认不给同源身份，只有注册表里显式 `sameOrigin: true` 的同域子应用才打开，
 * 打开后由 `previewEscapable` 在界面上标出来，让人看见这个决定。
 */
function sandboxFor(app: MicroAppItem): string {
  return buildIframeSandbox({ sameOrigin: app.sameOrigin });
}

const previewSandbox = computed(() =>
  currentApp.value ? sandboxFor(currentApp.value) : '',
);
const previewEscapable = computed(() => canEscapeSandbox(previewSandbox.value));

/** 「同源预览」标签的提示文案 */
const sandboxWarningTitle =
  '该子应用注册时打开了 sameOrigin：iframe 同时拥有 allow-scripts 与 allow-same-origin，' +
  '其脚本可以顺着同源身份访问顶层文档。仅对同域部署、确需共享登录态的子应用开放。';

// 初始选中第一个
watch(
  () => filteredApps.value,
  (list) => {
    if (list.length > 0 && !activeAppKey.value) {
      handleSelectApp(list[0]);
    }
  },
  { immediate: true },
);
</script>

<template>
  <div data-page-view class="flex h-full flex-col gap-4">
    <PageHeader
      title="微前端管理"
      description="登记子应用并在右侧预览；沙箱策略跟着注册表里的 sameOrigin 配置"
      icon="carbon:application-web"
    >
      <template #extra>
        <Button v-if="isEnabled && currentApp" @click="handleRefreshIframe">
          <Icon icon="carbon:restart" />
          刷新预览
        </Button>
      </template>
    </PageHeader>

    <!-- 未启用提示 -->
    <div
      v-if="!isEnabled"
      class="border-warning/30 bg-warning/10 text-warning flex items-center gap-2 rounded-lg border p-3 text-sm"
    >
      <Icon icon="carbon:warning-alt" class="shrink-0" />
      <span>微前端功能未启用，请在 .env 中设置 VITE_MICRO_APP=true</span>
    </div>

    <!-- 主内容区：左右分栏 -->
    <div class="flex min-h-0 flex-1 gap-4">
      <!-- 左侧：应用列表 -->
      <div
        class="flex w-[320px] shrink-0 flex-col gap-3 rounded-lg border-border bg-card border p-3"
      >
        <!-- 统计概览 -->
        <div class="grid grid-cols-3 gap-2">
          <div :class="statCardClassName" class="p-2 text-center">
            <p class="text-foreground text-lg font-bold">
              {{ apps.length }}
            </p>
            <p class="text-[10px] text-muted-foreground">总数</p>
          </div>
          <div :class="statCardClassName" class="p-2 text-center">
            <p class="text-success text-lg font-bold">
              {{ apps.filter((a) => a.active).length }}
            </p>
            <p class="text-[10px] text-muted-foreground">运行</p>
          </div>
          <div :class="statCardClassName" class="p-2 text-center">
            <p class="text-muted-foreground text-lg font-bold">
              {{ apps.filter((a) => !a.active).length }}
            </p>
            <p class="text-[10px] text-muted-foreground">停止</p>
          </div>
        </div>

        <!-- 搜索筛选 -->
        <div class="flex flex-col gap-2">
          <InputGroup class="w-full">
            <InputGroupAddon>
              <Icon icon="carbon:search" />
            </InputGroupAddon>
            <InputGroupInput
              v-model="searchKeyword"
              placeholder="搜索子应用..."
            />
            <InputGroupAddon v-if="searchKeyword" align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label="清空搜索条件"
                @click="searchKeyword = ''"
              >
                <Icon icon="carbon:close" />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <Select v-model="statusFilter">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in statusOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- 应用列表 -->
        <Scrollbar root-class="min-h-0 flex-1">
          <div class="space-y-2">
            <div
              v-for="app in filteredApps"
              :key="app.name"
              :class="
                cn(
                  'cursor-pointer rounded-lg border p-3 transition-all duration-150',
                  'border-border bg-card',
                  activeAppKey === app.name
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'hover:border-primary/40 hover:shadow-sm',
                )
              "
              @click="handleSelectApp(app)"
            >
              <!-- 应用头部 -->
              <div class="mb-1.5 flex items-center gap-2">
                <div
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                  :class="
                    app.active
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  "
                >
                  <!--
                    注册表存的是 Iconify 名（`carbon:application`），必须交给 Icon 组件渲染。
                    写成 `:class="app.icon"` 时项目里没有 unocss 图标预设，
                    结果每个子应用的头像都是一只空色块 —— 不报错，只是看不见。
                  -->
                  <Icon v-if="app.icon" :icon="app.icon" class="size-4" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-foreground truncate text-sm font-medium">
                    {{ app.title }}
                  </p>
                  <p class="text-muted-foreground truncate text-[10px]">
                    {{ app.name }}
                  </p>
                </div>
                <span
                  :class="getStatusTagClass(!!app.active)"
                  class="shrink-0 px-1.5 py-0.5 text-[10px]"
                >
                  {{ app.active ? '运行' : '停止' }}
                </span>
              </div>

              <!-- 元信息 -->
              <div
                class="text-muted-foreground flex items-center gap-2 text-[10px]"
              >
                <span>v{{ app.version ?? '-' }}</span>
                <span :class="getLoaderBadgeClass(app.loader)">{{
                  app.loader === 'iframe' ? 'iframe' : 'WC'
                }}</span>
              </div>
            </div>

            <!-- 空状态 -->
            <div
              v-if="filteredApps.length === 0"
              class="text-muted-foreground flex flex-col items-center justify-center py-8"
            >
              <Icon icon="carbon:application" class="mb-2 size-8 opacity-40" />
              <p class="text-xs">无匹配的子应用</p>
            </div>
          </div>
        </Scrollbar>
      </div>

      <!-- 右侧：iframe 预览区域 -->
      <div
        class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border-border bg-muted border"
      >
        <!-- 预览头部信息栏 -->
        <div
          v-if="currentApp"
          class="flex items-center justify-between border-border bg-card border-b px-4 py-2.5"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex h-8 w-8 items-center justify-center rounded-lg"
              :class="
                currentApp.active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              "
            >
              <Icon
                v-if="currentApp.icon"
                :icon="currentApp.icon"
                class="size-5"
              />
            </div>
            <div>
              <p class="text-foreground text-sm font-semibold">
                {{ currentApp.title }}
              </p>
              <p class="text-[10px] text-muted-foreground">
                {{ previewUrl(currentApp) }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <!-- 打开同源身份意味着 sandbox 可被逃逸，必须让人在界面上看到 -->
            <Tooltip v-if="previewEscapable" :title="sandboxWarningTitle">
              <Tag color="orange">同源预览</Tag>
            </Tooltip>
            <span :class="getStatusTagClass(!!currentApp.active)">
              {{ currentApp.active ? '运行中' : '已停止' }}
            </span>
            <Button
              size="sm"
              :variant="currentApp.active ? 'outline' : 'default'"
              @click="handleToggleStatus(currentApp!)"
            >
              {{ currentApp.active ? '停止' : '启动' }}
            </Button>
          </div>
        </div>

        <!-- iframe 容器 -->
        <div class="relative flex-1 bg-card">
          <!--
            未启用时不做"假预览"。
            过去这里会把子应用 URL 映射到本站页面（/#/dashboard 之类）来"演示"嵌入效果，
            代价是同源 + 可脚本的 iframe，等于把主应用会话暴露给一个自己套自己的框架，
            也让注册表看起来"跑通了"，其实一个真子应用都没接进来。
          -->
          <div
            v-if="!isEnabled"
            class="flex h-full flex-col items-center justify-center gap-1 px-6 text-center text-muted-foreground"
          >
            <!-- 原来的 i-carbon-document-blurred 既没有 unocss 预设，名字也不在 carbon 集合里，
                 渲染出来是一只空框；换成真实存在的 Iconify 名。 -->
            <Icon icon="carbon:video-off" class="mb-2 size-12 opacity-20" />
            <p class="text-sm">预览未启用</p>
            <p class="mt-1 max-w-md text-xs opacity-70">
              设置 VITE_MICRO_APP=true 并重启后，这里会按注册表里的 URL
              加载子应用
            </p>
          </div>

          <template v-else>
            <!-- 加载态 -->
            <div
              v-if="currentApp && !iframeLoaded[currentApp.name]"
              class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card"
            >
              <Spinner class="size-8" />
              <p class="text-muted-foreground mt-2 text-xs">
                正在加载子应用 {{ currentApp.title }}...
              </p>
            </div>

            <!-- iframe 嵌入子应用 -->
            <iframe
              v-if="currentApp"
              :key="currentApp.name"
              :data-app="currentApp.name"
              :src="previewUrl(currentApp)"
              class="h-full w-full border-0"
              :style="{ minHeight: '500px' }"
              frameborder="0"
              allow="clipboard-write; autoplay; fullscreen"
              :sandbox="previewSandbox"
              @load="handleIframeLoad(currentApp.name)"
              @error="handleIframeError(currentApp.name)"
            ></iframe>

            <!-- 无选中状态 -->
            <div
              v-if="!currentApp"
              class="flex h-full flex-col items-center justify-center text-muted-foreground"
            >
              <Icon icon="carbon:application" class="mb-3 size-12 opacity-20" />
              <p class="text-sm">选择左侧子应用开始预览</p>
              <p class="mt-1 text-xs opacity-60">支持 iframe 嵌套模式</p>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

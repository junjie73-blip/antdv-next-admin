<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { Scrollbar } from '@antdv/scrollbar-ui';
import {
  Empty,
  EmptyDescription,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/cn';
import { Icon, loadIcons } from '@iconify/vue';

interface Props {
  currentIcon?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: 'large' | 'middle' | 'small';
  allowClear?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  currentIcon: '',
  placeholder: '选择图标',
  disabled: false,
  size: 'middle',
  allowClear: true,
});

const emit = defineEmits<{
  change: [value: string];
  select: [value: string];
}>();

/** v-model 简化：直接读写，无需手动 emit update:modelValue */
const modelValue = defineModel<string>({ default: '' });

const PAGE_SIZE = 108;
const SCROLLER_HEIGHT = 360;

type Prefix = 'ant-design' | 'carbon' | 'fa6-regular' | 'lucide' | 'mdi';

interface CollectionMeta {
  prefix: Prefix;
  name: string;
  /** 说明性描述，仅显示在 select option 里 */
  hint: string;
}

const COLLECTIONS: CollectionMeta[] = [
  { prefix: 'lucide', name: 'Lucide', hint: '通用线性' },
  { prefix: 'mdi', name: 'Material Design', hint: 'Material' },
  { prefix: 'ant-design', name: 'Ant Design', hint: 'Antd' },
  { prefix: 'fa6-regular', name: 'Font Awesome', hint: 'FA Regular' },
  { prefix: 'carbon', name: 'Carbon', hint: 'Carbon Icons' },
];

/**
 * 图标集 lazily loader
 * - 每个 icons.json 会被 Vite 打包成独立的 chunk
 * - 只在切换到该分类时加载，不切就不下载
 */
const COLLECTION_LOADERS: Record<
  Prefix,
  () => Promise<{ default: { icons: Record<string, unknown> } }>
> = {
  lucide: () => import('@iconify-json/lucide/icons.json') as any,
  mdi: () => import('@iconify-json/mdi/icons.json') as any,
  'ant-design': () => import('@iconify-json/ant-design/icons.json') as any,
  'fa6-regular': () => import('@iconify-json/fa6-regular/icons.json') as any,
  carbon: () => import('@iconify-json/carbon/icons.json') as any,
};

const visible = ref(false);
const searchValue = ref('');
const selectedPrefix = ref<Prefix>('lucide');
const currentPage = ref(1);
const loading = ref(false);

/** 已加载的图标名（按 prefix 分组缓存） */
const iconNamesMap = ref<Record<string, string[]>>({});
const loadingPrefixes = new Set<Prefix>();

const selectedIcon = computed(() => modelValue.value || props.currentIcon);

/**
 * 加载某个分类的图标名列表
 * - 已加载过则直接返回
 * - 加载中不重复请求
 */
async function loadCollection(prefix: Prefix): Promise<void> {
  if (iconNamesMap.value[prefix] || loadingPrefixes.has(prefix)) return;
  loadingPrefixes.add(prefix);
  try {
    const mod = await COLLECTION_LOADERS[prefix]();
    const icons = mod.default?.icons ?? {};
    const names = Object.keys(icons);
    iconNamesMap.value = { ...iconNamesMap.value, [prefix]: names };
  } catch (error) {
    console.error(`[IconPicker] 加载图标集 "${prefix}" 失败:`, error);
    iconNamesMap.value = { ...iconNamesMap.value, [prefix]: [] };
  } finally {
    loadingPrefixes.delete(prefix);
  }
}

/**
 * 当前分类下的图标列表（含搜索过滤）
 * 搜索只在当前分类内进行，不跨分类
 */
const currentIcons = computed(() => {
  const names = iconNamesMap.value[selectedPrefix.value] ?? [];
  const q = searchValue.value.trim().toLowerCase();
  const filtered = q ? names.filter((n) => n.toLowerCase().includes(q)) : names;
  return filtered.map((n) => `${selectedPrefix.value}:${n}`);
});

const pagedIcons = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE;
  return currentIcons.value.slice(start, start + PAGE_SIZE);
});

const totalCount = computed(() => currentIcons.value.length);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(totalCount.value / PAGE_SIZE)),
);

const selectedCollectionName = computed(
  () =>
    COLLECTIONS.find((c) => c.prefix === selectedPrefix.value)?.name ??
    selectedPrefix.value,
);

/**
 * 预加载当前页图标的 SVG（Iconify 内部有缓存，翻页不会重复请求）
 * 用 50ms 防抖，避免快速翻页时对每一页都发请求
 */
let preloadTimer: null | ReturnType<typeof setTimeout> = null;
function schedulePreload(icons: string[]) {
  if (preloadTimer) clearTimeout(preloadTimer);
  preloadTimer = setTimeout(() => {
    if (icons.length > 0) {
      loadIcons(icons);
    }
  }, 50);
}

watch(pagedIcons, (icons) => schedulePreload(icons));

// 切换分类：重置搜索/页码，并加载该分类
watch(selectedPrefix, async (prefix) => {
  searchValue.value = '';
  currentPage.value = 1;
  if (!iconNamesMap.value[prefix]) {
    loading.value = true;
    await loadCollection(prefix);
    loading.value = false;
  }
});

// 搜索时回到第 1 页
watch(searchValue, () => {
  currentPage.value = 1;
});

// 首次打开时加载默认分类
watch(visible, async (val) => {
  if (!val) return;
  const prefix = selectedPrefix.value;
  if (!iconNamesMap.value[prefix]) {
    loading.value = true;
    await loadCollection(prefix);
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  if (preloadTimer) clearTimeout(preloadTimer);
});

function handleSelect(icon: string) {
  modelValue.value = icon;
  emit('change', icon);
  emit('select', icon);
  visible.value = false;
}

function handleClear(e: MouseEvent) {
  e.stopPropagation();
  modelValue.value = '';
  emit('change', '');
}

function stepPage(delta: number) {
  const next = Math.min(totalPages.value, Math.max(1, currentPage.value + delta));
  currentPage.value = next;
}

/**
 * 触发器高度档位
 * 原来是 antd `a-input` 的 `size`（large/middle/small）；shadcn 的 `Input` 只有
 * 固定的 `h-9`，所以档位在这里换成显式的 `h-*` 类 —— 保持三档视觉差异，
 * 也避免把 `middle` 这类 antd 专有取值泄漏给调用方。
 */
const triggerSizeClass = computed(() =>
  cn(
    props.size === 'large' && 'h-10 text-base',
    props.size === 'middle' && 'h-9 text-sm',
    props.size === 'small' && 'h-8 text-xs',
  ),
);

const prefixOptions = COLLECTIONS.map((c) => ({
  label: c.name,
  value: c.prefix,
}));
</script>

<template>
  <Popover v-model:open="visible">
    <PopoverTrigger as-child>
      <button
        type="button"
        role="combobox"
        aria-haspopup="dialog"
        :aria-expanded="visible"
        :disabled="props.disabled"
        :class="
          cn(
            'relative flex w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left shadow-xs outline-hidden transition-[color,box-shadow]',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3',
            'cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
            triggerSizeClass,
          )
        "
      >
        <Icon
          v-if="selectedIcon"
          :icon="selectedIcon"
          :width="16"
          class="shrink-0"
        />
        <span
          v-if="selectedIcon"
          class="flex-1 truncate font-mono text-xs"
          data-picker-value
        >
          {{ selectedIcon }}
        </span>
        <span v-else class="text-muted-foreground flex-1 truncate">
          {{ props.placeholder }}
        </span>
        <span class="text-muted-foreground flex shrink-0 items-center">
          <Icon
            v-if="props.allowClear && selectedIcon"
            icon="lucide:x"
            :width="14"
            class="cursor-pointer transition-colors hover:text-foreground"
            @click.stop="handleClear"
          />
          <Icon v-else icon="lucide:chevron-down" :width="14" />
        </span>
      </button>
    </PopoverTrigger>

    <PopoverContent align="start" class="w-[560px] max-w-[92vw] p-3">
      <!-- 工具栏：分类下拉 + 搜索，同一行更紧凑 -->
      <div class="mb-3 flex items-center gap-2">
        <Select v-model="selectedPrefix">
          <SelectTrigger class="w-[150px]" size="sm">
            <SelectValue placeholder="图标集" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem
              v-for="opt in prefixOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <div class="relative flex-1">
          <Icon
            icon="lucide:search"
            :width="13"
            class="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2"
          />
          <Input
            v-model="searchValue"
            :placeholder="`在 ${selectedCollectionName} 中搜索...`"
            class="h-8 pl-7 text-sm"
          />
        </div>
      </div>

      <!--
        图标网格：固定高度，滚动交给 @antdv/scrollbar-ui（全站不留系统滚动条）。
        `min-h-full` 让"加载中/空态"仍然垂直居中，同时不限制网格把内容撑高。
      -->
      <div class="pr-1" :style="{ height: `${SCROLLER_HEIGHT}px` }">
        <Scrollbar
          root-class="h-full"
          wrap-class="overflow-x-hidden"
          view-class="min-h-full"
        >
          <div
            v-if="loading"
            class="flex h-full items-center justify-center"
            data-picker-loading
          >
            <Spinner class="text-muted-foreground size-7 animate-spin" />
          </div>

          <Empty
            v-else-if="currentIcons.length === 0"
            class="min-h-0 border-0 pt-24"
            data-picker-empty
          >
            <EmptyDescription>
              {{ searchValue ? '没有匹配的图标' : '暂无图标' }}
            </EmptyDescription>
          </Empty>

          <TooltipProvider v-else :delay-duration="300">
            <div class="grid grid-cols-12 gap-1">
              <Tooltip v-for="icon in pagedIcons" :key="icon">
                <TooltipTrigger as-child>
                  <button
                    type="button"
                    :class="
                      cn(
                        'flex size-9 cursor-pointer items-center justify-center rounded-md transition-colors duration-100',
                        selectedIcon === icon
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      )
                    "
                    @click="handleSelect(icon)"
                  >
                    <Icon :icon="icon" :width="18" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{{ icon }}</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </Scrollbar>
      </div>

      <!-- 底部分页：仅超过一页时显示 -->
      <div
        v-if="totalCount > PAGE_SIZE"
        class="border-input mt-3 flex items-center justify-between border-t pt-3"
      >
        <span class="text-muted-foreground text-xs">{{ totalCount }} 个图标</span>
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex size-6 items-center justify-center rounded-md disabled:pointer-events-none disabled:opacity-40"
            :disabled="currentPage <= 1"
            aria-label="上一页"
            @click="stepPage(-1)"
          >
            <Icon icon="lucide:chevron-left" :width="14" />
          </button>
          <span class="text-xs tabular-nums">
            {{ currentPage }} / {{ totalPages }}
          </span>
          <button
            type="button"
            class="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex size-6 items-center justify-center rounded-md disabled:pointer-events-none disabled:opacity-40"
            :disabled="currentPage >= totalPages"
            aria-label="下一页"
            @click="stepPage(1)"
          >
            <Icon icon="lucide:chevron-right" :width="14" />
          </button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>

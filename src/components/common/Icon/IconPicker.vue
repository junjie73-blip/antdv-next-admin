<script setup lang="ts">
import { Icon, loadIcons } from "@iconify/vue";
import { computed, onBeforeUnmount, ref, watch } from "vue";

interface Props {
  currentIcon?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: "small" | "middle" | "large";
  allowClear?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  currentIcon: "",
  placeholder: "选择图标",
  disabled: false,
  size: "middle",
  allowClear: true,
});

/** v-model 简化：直接读写，无需手动 emit update:modelValue */
const modelValue = defineModel<string>({ default: "" });

const emit = defineEmits<{
  change: [value: string];
  select: [value: string];
}>();

const PAGE_SIZE = 108;
const SCROLLER_HEIGHT = 360;

type Prefix = "lucide" | "mdi" | "ant-design" | "fa6-regular";

interface CollectionMeta {
  prefix: Prefix;
  name: string;
  /** 说明性描述，仅显示在 select option 里 */
  hint: string;
}

const COLLECTIONS: CollectionMeta[] = [
  { prefix: "lucide", name: "Lucide", hint: "通用线性" },
  { prefix: "mdi", name: "Material Design", hint: "Material" },
  { prefix: "ant-design", name: "Ant Design", hint: "Antd" },
  { prefix: "fa6-regular", name: "Font Awesome", hint: "FA Regular" },
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
  lucide: () => import("@iconify-json/lucide/icons.json") as any,
  mdi: () => import("@iconify-json/mdi/icons.json") as any,
  "ant-design": () => import("@iconify-json/ant-design/icons.json") as any,
  "fa6-regular": () => import("@iconify-json/fa6-regular/icons.json") as any,
};

const visible = ref(false);
const searchValue = ref("");
const selectedPrefix = ref<Prefix>("lucide");
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
  } catch (e) {
    console.error(`[IconPicker] 加载图标集 "${prefix}" 失败:`, e);
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

/**
 * 预加载当前页图标的 SVG（Iconify 内部有缓存，翻页不会重复请求）
 * 用 50ms 防抖，避免快速翻页时对每一页都发请求
 */
let preloadTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePreload(icons: string[]) {
  if (preloadTimer) clearTimeout(preloadTimer);
  preloadTimer = setTimeout(() => {
    if (icons.length) {
      loadIcons(icons);
    }
  }, 50);
}

watch(pagedIcons, (icons) => schedulePreload(icons));

// 切换分类：重置搜索/页码，并加载该分类
watch(selectedPrefix, async (prefix) => {
  searchValue.value = "";
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
  emit("change", icon);
  emit("select", icon);
  visible.value = false;
}

function handleClear(e: MouseEvent) {
  e.stopPropagation();
  modelValue.value = "";
  emit("change", "");
}

function iconBtnClass(icon: string) {
  const isActive = selectedIcon.value === icon;
  return [
    "flex items-center justify-center w-9 h-9 rounded-md",
    "transition-colors duration-100 cursor-pointer",
    isActive
      ? "bg-blue-500 text-white hover:bg-blue-500"
      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white",
  ];
}

const prefixOptions = COLLECTIONS.map((c) => ({
  label: c.name,
  value: c.prefix,
}));
</script>

<template>
  <a-popover
    v-model:open="visible"
    trigger="click"
    placement="bottomLeft"
    :disabled="props.disabled"
    overlay-class-name="icon-picker-popover"
  >
    <template #content>
      <div class="w-[560px]">
        <!-- 工具栏：分类下拉 + 搜索，同一行更紧凑 -->
        <div class="flex items-center gap-2 mb-3">
          <a-select
            v-model:value="selectedPrefix"
            :options="prefixOptions"
            size="small"
            style="width: 150px"
          />
          <a-input
            v-model:value="searchValue"
            :placeholder="`在 ${COLLECTIONS.find((c) => c.prefix === selectedPrefix)?.name ?? ''} 中搜索...`"
            allow-clear
            size="small"
            class="flex-1"
          >
            <template #prefix>
              <Icon icon="lucide:search"
:width="13"
class="text-gray-400" />
            </template>
          </a-input>
        </div>

        <!-- 图标网格：固定高度 + 原生滚动 -->
        <div
          class="overflow-y-auto overflow-x-hidden pr-1"
          :style="{ height: `${SCROLLER_HEIGHT}px` }"
        >
          <div v-if="loading"
class="h-full flex items-center justify-center">
            <a-spin size="large" />
          </div>

          <a-empty
            v-else-if="currentIcons.length === 0"
            :description="searchValue ? '没有匹配的图标' : '暂无图标'"
            class="pt-24"
          />

          <div v-else
class="grid grid-cols-12 gap-1">
            <a-tooltip
              v-for="icon in pagedIcons"
              :key="icon"
              :title="icon"
              placement="top"
              :mouse-enter-delay="0.3"
            >
              <button type="button"
:class="iconBtnClass(icon)"
@click="handleSelect(icon)">
                <Icon :icon="icon"
:width="18" />
              </button>
            </a-tooltip>
          </div>
        </div>

        <!-- 底部分页：仅超过一页时显示 -->
        <div
          v-if="totalCount > PAGE_SIZE"
          class="flex items-center justify-between pt-3 mt-3 border-t border-gray-200 dark:border-gray-700"
        >
          <span class="text-xs text-gray-400">{{ totalCount }} 个图标</span>
          <a-pagination
            v-model:current="currentPage"
            :total="totalCount"
            :page-size="PAGE_SIZE"
            size="small"
            simple
            :show-size-changer="false"
          />
        </div>
      </div>
    </template>

    <!-- 触发输入框 -->
    <a-input
      :value="selectedIcon"
      :placeholder="props.placeholder"
      :disabled="props.disabled"
      :size="props.size"
      readonly
      class="cursor-pointer"
    >
      <template v-if="selectedIcon"
#prefix>
        <Icon :icon="selectedIcon"
:width="16" />
      </template>
      <template #suffix>
        <Icon
          v-if="props.allowClear && selectedIcon"
          icon="lucide:x"
          :width="14"
          class="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
          @click="handleClear"
        />
        <Icon v-else
icon="lucide:chevron-down"
:width="14"
class="text-gray-400" />
      </template>
    </a-input>
  </a-popover>
</template>

<style scoped>
.icon-picker-popover :deep(.ant-popover-inner) {
  padding: 12px;
}
</style>

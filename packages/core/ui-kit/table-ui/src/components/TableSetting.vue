<script setup lang="ts">
import type { BasicColumn, TableSetting } from '../types';

import { computed, ref, watch } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';
import {
  Button,
  Checkbox,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { cloneDeep } from 'es-toolkit';

const props = defineProps<{
  setting?: TableSetting;
  columns?: BasicColumn[];
  cacheColumns?: BasicColumn[];
}>();

const emit = defineEmits<{
  (e: 'redo'): void;
  (e: 'update:columns', columns: BasicColumn[]): void;
  (e: 'reset'): void;
}>();

const isFullscreen = ref(false);
const settingVisible = ref(false);
const localColumns = ref<BasicColumn[]>([]);

watch(
  () => props.columns,
  (newColumns) => {
    if (newColumns) {
      localColumns.value = cloneDeep(newColumns);
    }
  },
  { immediate: true, deep: true },
);

function handleRedo() {
  emit('redo');
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
    isFullscreen.value = false;
  } else {
    document.documentElement.requestFullscreen();
    isFullscreen.value = true;
  }
}

const getSetting = computed(() => {
  return {
    redo: true,
    setting: true,
    fullScreen: true,
    ...props.setting,
  };
});

const configurableColumns = computed(() => {
  return localColumns.value.filter((col) => {
    const key = col.key || col.dataIndex;
    return (
      key !== 'ant-table-selection-column' &&
      key !== 'index' &&
      key !== 'action'
    );
  });
});

function isColumnVisible(col: BasicColumn): boolean {
  return col.ifShow !== false;
}

function toggleColumnVisible(col: BasicColumn, checked: boolean) {
  // 用 key/dataIndex 定位，不能直接比 col.key —— 未声明 key 的列两者都是 undefined，会误伤第一列
  const colId = col.key || col.dataIndex;
  const index = localColumns.value.findIndex(
    (c) => (c.key || c.dataIndex) === colId,
  );
  if (index !== -1) {
    localColumns.value[index] = {
      ...localColumns.value[index],
      ifShow: checked,
    };
    emit('update:columns', cloneDeep(localColumns.value));
  }
}

function handleReset() {
  emit('reset');
}

function handleSelectAll(checked: boolean) {
  localColumns.value = localColumns.value.map((col) => {
    const key = col.key || col.dataIndex;
    if (
      key !== 'ant-table-selection-column' &&
      key !== 'index' &&
      key !== 'action'
    ) {
      return { ...col, ifShow: checked };
    }
    return col;
  });
  emit('update:columns', cloneDeep(localColumns.value));
}

const isAllSelected = computed(() => {
  return configurableColumns.value.every((col) => isColumnVisible(col));
});

const isIndeterminate = computed(() => {
  const visibleCount = configurableColumns.value.filter((col) =>
    isColumnVisible(col),
  ).length;
  return visibleCount > 0 && visibleCount < configurableColumns.value.length;
});
</script>

<template>
  <TooltipProvider>
    <div :class="cn('basic-table-setting flex items-center gap-1')">
      <Tooltip v-if="getSetting.redo">
        <TooltipTrigger as-child>
          <Button variant="ghost" size="sm" title="刷新" @click="handleRedo">
            <Icon icon="ant-design:redo-outlined" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>刷新</TooltipContent>
      </Tooltip>

      <!--
        这里刻意不再套 reka 的 Tooltip。TooltipRoot 与 PopoverRoot 各提供一份 PopperRoot，
        而 inject 只认组件树上最近的那一份：Trigger 落在 Tooltip 子树里，锚点就注册到 tooltip
        的 PopperRoot 上，面板自己的那一份永远是空的，于是按零尺寸锚点算坐标（实测 y=-784，
        弹层跑到视口外）。悬停提示改用下面 Button 的原生 title。
      -->
      <Popover v-if="getSetting.setting" v-model:open="settingVisible">
        <PopoverTrigger as-child>
          <Button variant="ghost" size="sm" title="列设置">
            <Icon icon="ant-design:setting-outlined" />
          </Button>
        </PopoverTrigger>

        <PopoverContent align="end" :class="cn('basic-table-setting-panel w-auto p-0')">
          <div :class="cn('w-56 p-3')">
            <div :class="cn('mb-3 flex items-center justify-between')">
              <span :class="cn('font-medium')">列设置</span>
              <Button variant="link" size="sm" @click="handleReset">
                重置
              </Button>
            </div>

            <div
              :class="
                cn('mb-2 border-b border-gray-100 pb-2 dark:border-gray-700')
              "
            >
              <label
                :class="cn('flex cursor-pointer items-center gap-2 text-sm')"
              >
                <Checkbox
                  :model-value="
                    isAllSelected
                      ? true
                      : isIndeterminate
                        ? 'indeterminate'
                        : false
                  "
                  @update:model-value="
                    (v: any) => handleSelectAll(v === true)
                  "
                />
                全选
              </label>
            </div>

            <div :class="cn('max-h-64 overflow-y-auto')">
              <div :class="cn('space-y-1')">
                <div
                  v-for="(col, idx) in configurableColumns"
                  :key="String(col.key || col.dataIndex || idx)"
                  :class="cn('flex items-center justify-between py-1')"
                >
                  <label
                    :class="cn('flex cursor-pointer items-center gap-2')"
                  >
                    <Checkbox
                      :model-value="isColumnVisible(col)"
                      @update:model-value="
                        (v: any) => toggleColumnVisible(col, v === true)
                      "
                    />
                    <span :class="cn('text-sm')">{{ col.title }}</span>
                  </label>
                </div>
              </div>
            </div>

            <div
              v-if="configurableColumns.length === 0"
              :class="cn('py-4 text-center text-gray-400 dark:text-gray-500')"
            >
              暂无可用列
            </div>

            <Separator class="my-2" />
            <div :class="cn('text-xs text-gray-400')">
              共 {{ configurableColumns.length }} 列
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Tooltip v-if="getSetting.fullScreen">
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="sm"
            :title="isFullscreen ? '退出全屏' : '全屏'"
            @click="toggleFullscreen"
          >
            <Icon
              :icon="
                isFullscreen
                  ? 'ant-design:fullscreen-exit-outlined'
                  : 'ant-design:fullscreen-outlined'
              "
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {{ isFullscreen ? '退出全屏' : '全屏' }}
        </TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>
</template>

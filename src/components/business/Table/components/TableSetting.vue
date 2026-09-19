<script setup lang="ts">
import { Button, Checkbox, Popover, Tooltip } from "antdv-next";
import { cloneDeep } from "es-toolkit";
import { computed, ref, watch } from "vue";

import type { BasicColumn, TableSetting } from "../types";

import { IconifyIcon as Icon } from "~/components/common/Icon";
import { cn } from "~/utils/cn";

const props = defineProps<{
  setting?: TableSetting;
  columns?: BasicColumn[];
  cacheColumns?: BasicColumn[];
}>();

const emit = defineEmits<{
  (e: "redo"): void;
  (e: "update:columns", columns: BasicColumn[]): void;
  (e: "reset"): void;
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
  emit("redo");
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    isFullscreen.value = true;
  } else {
    document.exitFullscreen();
    isFullscreen.value = false;
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
    return key !== "ant-table-selection-column" && key !== "index" && key !== "action";
  });
});

function isColumnVisible(col: BasicColumn): boolean {
  return col.ifShow !== false;
}

function toggleColumnVisible(col: BasicColumn, checked: boolean) {
  const index = localColumns.value.findIndex(
    (c) => c.key === col.key || c.dataIndex === col.dataIndex,
  );
  if (index > -1) {
    localColumns.value[index] = { ...localColumns.value[index], ifShow: checked };
    emit("update:columns", cloneDeep(localColumns.value));
  }
}

function handleReset() {
  emit("reset");
}

function handleSelectAll(checked: boolean) {
  localColumns.value = localColumns.value.map((col) => {
    const key = col.key || col.dataIndex;
    if (key !== "ant-table-selection-column" && key !== "index" && key !== "action") {
      return { ...col, ifShow: checked };
    }
    return col;
  });
  emit("update:columns", cloneDeep(localColumns.value));
}

const isAllSelected = computed(() => {
  return configurableColumns.value.every((col) => isColumnVisible(col));
});

const isIndeterminate = computed(() => {
  const visibleCount = configurableColumns.value.filter((col) => isColumnVisible(col)).length;
  return visibleCount > 0 && visibleCount < configurableColumns.value.length;
});
</script>

<template>
  <div :class="cn('flex items-center gap-1')">
    <Tooltip v-if="getSetting.redo" title="刷新">
      <Button type="text" @click="handleRedo">
        <template #icon>
          <Icon icon="ant-design:redo-outlined" />
        </template>
      </Button>
    </Tooltip>

    <Popover
      v-if="getSetting.setting"
      v-model:open="settingVisible"
      trigger="click"
      placement="bottomRight"
      :overlay-class-name="cn('table-column-setting')"
    >
      <template #content>
        <div :class="cn('w-56')">
          <div :class="cn('mb-3 flex items-center justify-between')">
            <span :class="cn('font-medium')">列设置</span>
            <Button type="link" @click="handleReset"> 重置 </Button>
          </div>

          <div :class="cn('mb-2 border-b border-gray-100 pb-2 dark:border-gray-700')">
            <Checkbox
              :checked="isAllSelected"
              :indeterminate="isIndeterminate"
              @change="(e) => handleSelectAll(e.target.checked)"
            >
              全选
            </Checkbox>
          </div>

          <PerfectScrollbar :class="cn('max-h-64')">
            <div :class="cn('space-y-1')">
              <div
                v-for="(col, idx) in configurableColumns"
                :key="String(col.key || col.dataIndex || idx)"
                :class="cn('flex items-center justify-between py-1')"
              >
                <Checkbox
                  :checked="isColumnVisible(col)"
                  @change="(e) => toggleColumnVisible(col, e.target.checked)"
                >
                  <span :class="cn('text-sm')">{{ col.title }}</span>
                </Checkbox>
              </div>
            </div>
          </PerfectScrollbar>

          <div
            v-if="configurableColumns.length === 0"
            :class="cn('py-4 text-center text-gray-400 dark:text-gray-500')"
          >
            暂无可用列
          </div>
        </div>
      </template>
      <Tooltip title="列设置">
        <Button type="text">
          <template #icon>
            <Icon icon="ant-design:setting-outlined" />
          </template>
        </Button>
      </Tooltip>
    </Popover>

    <Tooltip v-if="getSetting.fullScreen" :title="isFullscreen ? '退出全屏' : '全屏'">
      <Button type="text" @click="toggleFullscreen">
        <template #icon>
          <Icon
            :icon="
              isFullscreen
                ? 'ant-design:fullscreen-exit-outlined'
                : 'ant-design:fullscreen-outlined'
            "
          />
        </template>
      </Button>
    </Tooltip>
  </div>
</template>

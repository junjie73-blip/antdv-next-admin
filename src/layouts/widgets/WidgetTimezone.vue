<script setup lang="ts">
import type { RenderItem } from "antdv-next/dist/menu/menu";

import { Icon } from "@iconify/vue";
import { Dropdown } from "antdv-next";
import { computed, onMounted, onUnmounted, ref } from "vue";

import { TIMEZONE_OPTIONS } from "../components/SettingDrawer/constants.js";
import { useAppStore } from "~/stores/modules/app";
import { nowTz } from "~/utils/dayjs";
import { cn } from "~/utils/index.js";

import WidgetButton from "./components/WidgetButton.vue";

defineOptions({ name: "WidgetTimezone" });

const appStore = useAppStore();

/* ============================================================
 * 实时时钟
 * ============================================================ */
const now = ref(nowTz());
let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  timer = setInterval(() => {
    now.value = nowTz();
  }, 30_000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

/* ============================================================
 * 打开/关闭
 * ============================================================ */
const open = ref(false);

function handleSelect(value: string) {
  if (value === appStore.timezone) {
    open.value = false;
    return;
  }
  appStore.updateSetting({ timezone: value });
  now.value = nowTz();
  open.value = false;
}

const items = computed(() =>
  TIMEZONE_OPTIONS.map((item) => ({
    ...item,
    key: item.value,
    label: item.label,
  })),
);
const btnClass = computed(() => (item: RenderItem) => {
  return cn(
    "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors",
    item.value === appStore.timezone
      ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  );
});
</script>

<template>
  <Dropdown
    v-model:open="open"
    placement="bottomRight"
    :trigger="['click']"
    :arrow="false"
    :overlay-style="{ padding: 0 }"
    :menu="{ items: items }"
  >
    <WidgetButton>
      <Icon icon="carbon:time" class="text-base" />
    </WidgetButton>
    <template #labelRender="item">
      <button @click="handleSelect(item.value)" :class="btnClass(item)">
        <div class="truncate text-[12px] leading-tight">
          {{ item.value }}
        </div>
      </button>
    </template>
  </Dropdown>
</template>

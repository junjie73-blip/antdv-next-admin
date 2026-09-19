<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { Input, InputNumber, Segmented, Select, Switch, Tooltip } from "antdv-next";
import { computed, h, ref } from "vue";

import { LAYOUT_OPTIONS, LayoutIcon } from "./LayoutIcon";

import type { SegmentedProps, SelectProps } from "antdv-next";

import type { LayoutMode } from "../composables/useLayout";

import type { ComponentSize, ThemeStyle, TransitionEffect } from "~/settings";

import { useThemeTransition } from "~/composables/web/useThemeTransition";
import { THEME_PRESETS } from "~/settings/theme";
import { useAppStore } from "~/stores/modules/app";
import { cn } from "~/utils/cn";

defineOptions({ name: "SettingDrawer" });

const visible = defineModel<boolean>("visible", { default: false });

const appStore = useAppStore();
const { toggleThemeWithAnimation } = useThemeTransition();

type SectionKey = "appearance" | "interface" | "advanced";
const activeSection = ref<SectionKey>("appearance");

// ============================================================
// 顶部 Segmented 分区
// ============================================================
const sectionOptions: SegmentedProps["options"] = [
  { value: "appearance", label: "外观", icon: h(Icon, { icon: "carbon:color-palette" }) },
  { value: "interface", label: "界面", icon: h(Icon, { icon: "carbon:view" }) },
  { value: "advanced", label: "扩展", icon: h(Icon, { icon: "carbon:tools" }) },
];

const sectionStyles: SegmentedProps["styles"] = {
  root: {
    padding: "4px",
    width: "100%",
    background: "rgba(241, 245, 249, 0.8)",
    borderRadius: "10px",
  },
  item: { borderRadius: "8px", transition: "all 200ms ease" },
  icon: { fontSize: "14px" },
  label: { fontSize: "12px", fontWeight: 500 },
};

// ============================================================
// 主题模式
// ============================================================
const themeModeOptions: SegmentedProps["options"] = [
  { value: "light", label: "明亮", icon: h(Icon, { icon: "carbon:sun" }) },
  { value: "dark", label: "黑暗", icon: h(Icon, { icon: "carbon:moon" }) },
  { value: "auto", label: "自动", icon: h(Icon, { icon: "carbon:laptop" }) },
];

// ============================================================
// 组件大小
// ============================================================
const sizeOptions: SelectProps["options"] = [
  { value: "small", label: "小" },
  { value: "medium", label: "中" },
  { value: "large", label: "大" },
];

// ============================================================
// 通知位置
// ============================================================
const notificationPositionOptions: SegmentedProps["options"] = [
  { value: "topLeft", label: "左上" },
  { value: "topRight", label: "右上" },
  { value: "bottomLeft", label: "左下" },
  { value: "bottomRight", label: "右下" },
];

// ============================================================
// 下拉选项
// ============================================================
const transitionOptions: { value: TransitionEffect; label: string }[] = [
  { value: "fade", label: "默认" },
  { value: "slide", label: "滑动" },
  { value: "slide-right", label: "右滑" },
  { value: "slide-left", label: "左滑" },
  { value: "slide-up", label: "上滑" },
  { value: "slide-down", label: "下滑" },
  { value: "zoom", label: "缩放" },
  { value: "fade-slide", label: "淡入滑动" },
  { value: "scale", label: "缩放淡入" },
  { value: "flip", label: "翻转" },
];

const allowedStyles = [
  "default",
  "compact",
  "illustration",
  "bootstrap",
  "skeuomorphism",
  "glass",
  "geek",
] as ThemeStyle[];

const themeStyles = computed(() =>
  Object.values(THEME_PRESETS).filter((s) => allowedStyles.includes(s.name as ThemeStyle)),
);

const primaryColors = [
  "#1677FF",
  "#1890FF",
  "#2F54EB",
  "#722ED1",
  "#8B5CF6",
  "#EB2F96",
  "#F5222D",
  "#FA541C",
  "#FAAD14",
  "#13C2C2",
  "#52C41A",
  "#1D39C4",
];

// ============================================================
// 通用样式常量
// ============================================================
const groupIconClassName = cn(
  "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
  "bg-gradient-to-br from-blue-500/15 to-indigo-500/15",
  "text-ant-primary text-[15px]",
);

/** 大分组容器（浅色大圆角） */
const groupBoxClassName = cn(
  "rounded-2xl p-3 space-y-2",
  "bg-slate-50/80 dark:bg-slate-900/40",
  "outline outline-1 outline-slate-200/70 dark:outline-slate-700/50",
);

/** 设置项卡片（a-button 自带水波纹） */
const itemBtnClassName = cn(
  "!h-auto !p-0 !rounded-xl !justify-stretch overflow-hidden",
  "!bg-white dark:!bg-slate-800",
  "!outline !outline-1 !outline-slate-200 dark:!outline-slate-700",
  "hover:!outline-ant-primary/50 hover:shadow-sm",
  "transition-all duration-200",
);
const groupTitleClassName = cn(
  "relative flex items-center gap-2 mb-3 pb-2 w-fit",
  "text-[13px] font-semibold text-slate-700 dark:text-slate-200",
  // 下划线：位置
  "after:content-[''] after:absolute after:left-9 after:right-0 after:bottom-0",
  "after:h-[2px] after:rounded-full",
  // 下划线：渐变
  "after:bg-gradient-to-r after:from-ant-primary after:to-ant-primary/20",
  // 下划线：动画（origin-left 确保展开从左、收起从右）
  "after:origin-left after:scale-x-0",
  "after:transition-transform after:duration-300 after:ease-out",
  "hover:after:scale-x-100",
);
// ============================================================
// 事件
// ============================================================
function handleThemeModeChange(mode: string | number, event?: MouseEvent) {
  if (mode === appStore.themeMode) return;
  toggleThemeWithAnimation(event);
}
function handleLayoutChange(v: string | number) {
  appStore.updateSetting({ layout: v as LayoutMode });
}
function handleThemeStyleChange(v: string) {
  appStore.updateSetting({ themeStyle: v as ThemeStyle });
}
function handlePrimaryColorChange(color: string) {
  appStore.updateSetting({ primaryColor: color });
}
function handleReset() {
  appStore.resetSetting();
}
function getPrimaryColor(style: { token?: Record<string, unknown> }): string {
  const c = style.token?.colorPrimary;
  return typeof c === "string" ? c : "#1677ff";
}
function isColorActive(color: string): boolean {
  return appStore.primaryColor?.toLowerCase() === color.toLowerCase();
}

/** 当前色是否在预设色板里 */
const isPresetColor = computed(() => {
  const cur = appStore.primaryColor?.toLowerCase();
  if (!cur) return false;
  return primaryColors.some((c) => c.toLowerCase() === cur);
});
</script>

<template>
  <a-drawer
    v-model:open="visible"
    placement="right"
    :width="360"
    :closable="false"
    :body-style="{ padding: '0' }"
    :header-style="{ display: 'none' }"
    root-class-name="setting-drawer"
  >
    <div class="flex flex-col h-full bg-white dark:bg-slate-950">
      <!-- ============================================================ -->
      <!-- 顶部                                                          -->
      <!-- ============================================================ -->
      <div class="flex-shrink-0 border-b border-slate-100 dark:border-slate-800">
        <div class="flex items-center justify-between px-5 pt-5 pb-3">
          <div class="flex items-center gap-2.5">
            <div
              class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 flex items-center justify-center"
            >
              <Icon icon="carbon:settings" class="text-ant-primary text-lg" />
            </div>
            <div>
              <div class="text-[15px] font-semibold text-slate-800 dark:text-slate-100">
                主题配置
              </div>
              <div class="text-[11px] text-slate-400 mt-0.5">定制你的工作空间</div>
            </div>
          </div>
          <a-button
            type="text"
            size="small"
            class="!w-8 !h-8 !p-0 !rounded-lg !text-slate-400 hover:!text-slate-700 hover:!bg-slate-100 dark:hover:!bg-slate-800 dark:hover:!text-slate-200"
            @click="visible = false"
          >
            <Icon icon="carbon:close" class="text-lg" />
          </a-button>
        </div>
      </div>

      <div class="flex-1 min-h-0 overflow-hidden">
        <div class="p-4">
          <Segmented
            v-model:value="activeSection"
            :options="sectionOptions"
            :styles="sectionStyles"
            block
          />
        </div>
        <PerfectScrollbar class="h-max">
          <div class="p-5 space-y-6">
            <template v-if="activeSection === 'appearance'">
              <div>
                <div :class="groupTitleClassName">
                  <div :class="groupIconClassName">
                    <Icon icon="carbon:layout" />
                  </div>
                  <span>布局样式</span>
                </div>
                <div :class="groupBoxClassName">
                  <div class="grid grid-cols-2 gap-3">
                    <button
                      v-for="item in LAYOUT_OPTIONS"
                      :key="item.value"
                      type="button"
                      class="relative flex flex-col items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 transition-all duration-200 outline outline-1"
                      :class="
                        appStore.layout === item.value
                          ? 'bg-ant-primary/5 outline outline-2 outline-ant-primary shadow-[0_0_20px_-4px_var(--ant-primary-color)]'
                          : 'outline-slate-200 dark:outline-slate-700 hover:outline-ant-primary/40'
                      "
                      @click="handleLayoutChange(item.value)"
                    >
                      <div
                        class="w-full aspect-[16/10] rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900 transition-all duration-300"
                        :style="
                          appStore.layout === item.value
                            ? {
                                boxShadow:
                                  '0 0 0 1.5px var(--ant-primary-color, #1677ff), ' +
                                  '0 0 14px 3px color-mix(in srgb, var(--ant-primary-color, #1677ff) 35%, transparent)',
                              }
                            : {}
                        "
                      >
                        <LayoutIcon :type="item.value" :active="appStore.layout === item.value" />
                      </div>
                      <span
                        class="text-[11px] font-medium"
                        :class="
                          appStore.layout === item.value
                            ? 'text-ant-primary'
                            : 'text-slate-500 dark:text-slate-400'
                        "
                      >
                        {{ item.label }}
                      </span>
                      <div
                        v-if="appStore.layout === item.value"
                        class="absolute top-3 right-3 w-5 h-5 rounded-full bg-ant-primary flex items-center justify-center"
                      >
                        <Icon icon="carbon:checkmark" class="text-white text-xs" />
                      </div>
                    </button>
                  </div>
                </div>
              </div>
              <!-- 主题模式 -->
              <div>
                <div :class="groupTitleClassName">
                  <div :class="groupIconClassName">
                    <Icon icon="carbon:contrast" />
                  </div>
                  <span>主题模式</span>
                </div>
                <Segmented
                  :value="appStore.themeMode"
                  :options="themeModeOptions"
                  :styles="sectionStyles"
                  block
                  @change="handleThemeModeChange"
                />
              </div>

              <!-- 主题颜色 -->
              <div>
                <div :class="groupTitleClassName">
                  <div :class="groupIconClassName">
                    <Icon icon="carbon:color-palette" />
                  </div>
                  <span>主题颜色</span>
                </div>
                <div :class="groupBoxClassName">
                  <div class="grid grid-cols-6 gap-2.5">
                    <button
                      v-for="color in primaryColors"
                      :key="color"
                      type="button"
                      class="relative aspect-square rounded-full transition-all duration-300"
                      :class="isColorActive(color) ? 'scale-110' : 'hover:scale-110'"
                      :style="{
                        backgroundColor: color,
                        boxShadow: isColorActive(color)
                          ? `0 0 0 2px #fff, 0 0 0 3.5px ${color}, 0 0 16px 4px ${color}66`
                          : `0 2px 6px ${color}40`,
                      }"
                      @click="handlePrimaryColorChange(color)"
                    />
                  </div>

                  <!-- ⭐ 如果当前色不在预设里，显示自定义色提示 -->
                  <div
                    v-if="!isPresetColor"
                    class="mt-3 flex items-center gap-2.5 p-2.5 rounded-lg bg-white dark:bg-slate-800 outline outline-1 outline-ant-primary"
                  >
                    <div
                      class="w-6 h-6 rounded-full flex-shrink-0"
                      :style="{
                        backgroundColor: appStore.primaryColor,
                        boxShadow: `0 0 0 2px #fff, 0 0 0 3.5px ${appStore.primaryColor}, 0 0 16px 4px ${appStore.primaryColor}66`,
                      }"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="text-[11px] text-slate-500">自定义颜色</div>
                      <div class="text-xs font-mono text-slate-700 dark:text-slate-200 truncate">
                        {{ appStore.primaryColor }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 主题风格 -->
              <div>
                <div :class="groupTitleClassName">
                  <div :class="groupIconClassName">
                    <Icon icon="carbon:brush-freehand" />
                  </div>
                  <span>主题风格</span>
                </div>
                <div :class="groupBoxClassName">
                  <button
                    v-for="style in themeStyles"
                    :key="style.name"
                    type="button"
                    class="flex items-center gap-2.5 w-full p-2.5 rounded-xl transition-all duration-200 text-left outline outline-1"
                    :class="
                      appStore.themeStyle === style.name
                        ? 'bg-ant-primary/8 outline-2 outline-ant-primary'
                        : 'bg-white dark:bg-slate-800 outline-slate-200 dark:outline-slate-700 hover:outline-ant-primary/40'
                    "
                    @click="handleThemeStyleChange(style.name)"
                  >
                    <div
                      class="w-8 h-8 rounded-full flex-shrink-0"
                      :style="{
                        backgroundColor: getPrimaryColor(style),
                        boxShadow: `0 2px 8px ${getPrimaryColor(style)}40`,
                      }"
                    />
                    <span class="text-xs text-slate-600 dark:text-slate-300 truncate">
                      {{ style.label }}
                    </span>
                  </button>
                </div>
              </div>
            </template>

            <!-- ============================================================ -->
            <!-- 界面                                                        -->
            <!-- ============================================================ -->
            <template v-else-if="activeSection === 'interface'">
              <!-- 基础选项 -->
              <div>
                <div :class="groupTitleClassName">
                  <div :class="groupIconClassName">
                    <Icon icon="carbon:view" />
                  </div>
                  <span>基础选项</span>
                </div>
                <div :class="groupBoxClassName">
                  <!-- 路由动画 -->
                  <a-button type="text" block :class="itemBtnClassName">
                    <div class="flex items-center justify-between w-full px-4 py-3">
                      <div class="text-left">
                        <div class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                          路由动画
                        </div>
                      </div>
                      <div class="flex-shrink-0" @click.stop>
                        <Select
                          :value="appStore.transitionEffect"
                          :options="transitionOptions"
                          size="small"
                          class="!w-28"
                          @change="(v: any) => appStore.updateSetting({ transitionEffect: v })"
                        />
                      </div>
                    </div>
                  </a-button>

                  <!-- 菜单宽度 -->
                  <a-button type="text" block :class="itemBtnClassName">
                    <div class="flex items-center justify-between w-full px-4 py-3">
                      <div class="text-left">
                        <div class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                          菜单宽度
                        </div>
                      </div>
                      <div class="flex-shrink-0" @click.stop>
                        <InputNumber
                          :value="appStore.sidebarWidth"
                          :min="180"
                          :max="280"
                          :step="10"
                          size="small"
                          class="!w-28"
                          @change="
                            (v: any) => v !== null && appStore.updateSetting({ sidebarWidth: v })
                          "
                        />
                      </div>
                    </div>
                  </a-button>

                  <!-- 标签页风格 -->
                  <a-button type="text" block :class="itemBtnClassName">
                    <div class="flex items-center justify-between w-full px-4 py-3">
                      <div class="text-left">
                        <div class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                          标签页风格
                        </div>
                      </div>
                      <div class="flex-shrink-0" @click.stop>
                        <Select
                          :value="appStore.tabShowIcon ? 'icon' : 'plain'"
                          :options="[
                            { value: 'plain', label: '谷歌风格' },
                            { value: 'icon', label: '带图标' },
                          ]"
                          size="small"
                          class="!w-28"
                          @change="
                            (v: any) => appStore.updateSetting({ tabShowIcon: v === 'icon' })
                          "
                        />
                      </div>
                    </div>
                  </a-button>

                  <!-- 组件尺寸 -->
                  <a-button type="text" block :class="itemBtnClassName">
                    <div class="flex items-center justify-between w-full px-4 py-3">
                      <div class="text-left">
                        <div class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                          组件尺寸
                        </div>
                      </div>
                      <div class="flex-shrink-0" @click.stop>
                        <Select
                          :value="appStore.componentSize"
                          :options="sizeOptions"
                          size="small"
                          class="!w-28"
                          @change="
                            (v: any) =>
                              appStore.updateSetting({ componentSize: v as ComponentSize })
                          "
                        />
                      </div>
                    </div>
                  </a-button>
                </div>
              </div>

              <!-- 显示与交互 -->
              <div>
                <div :class="groupTitleClassName">
                  <div :class="groupIconClassName">
                    <Icon icon="carbon:magic-wand" />
                  </div>
                  <span>显示与交互</span>
                </div>
                <div :class="groupBoxClassName">
                  <!-- 显示标签页 -->
                  <a-button type="text" block :class="itemBtnClassName">
                    <div class="flex items-center justify-between w-full px-4 py-3">
                      <div class="text-left">
                        <div
                          class="text-[13px] font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1"
                        >
                          显示标签页
                          <Tooltip title="主内容区顶部多标签导航">
                            <Icon icon="carbon:information" class="text-slate-400 text-xs" />
                          </Tooltip>
                        </div>
                        <div class="text-[11px] text-slate-400 mt-0.5">主内容区顶部多标签导航</div>
                      </div>
                      <div class="flex-shrink-0" @click.stop>
                        <Switch
                          :checked="appStore.showTabs"
                          size="small"
                          @change="appStore.toggleTabs"
                        />
                      </div>
                    </div>
                  </a-button>

                  <!-- 菜单手风琴 -->
                  <a-button type="text" block :class="itemBtnClassName">
                    <div class="flex items-center justify-between w-full px-4 py-3">
                      <div class="text-left">
                        <div class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                          菜单手风琴
                        </div>
                        <div class="text-[11px] text-slate-400 mt-0.5">仅展开一个子菜单</div>
                      </div>
                      <div class="flex-shrink-0" @click.stop>
                        <Switch :checked="false" size="small" />
                      </div>
                    </div>
                  </a-button>

                  <!-- 侧边栏反转 -->
                  <a-button type="text" block :class="itemBtnClassName">
                    <div class="flex items-center justify-between w-full px-4 py-3">
                      <div class="text-left">
                        <div class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                          侧边栏反转色
                        </div>
                        <div class="text-[11px] text-slate-400 mt-0.5">侧栏与内容区对比配色</div>
                      </div>
                      <div class="flex-shrink-0" @click.stop>
                        <Switch
                          :checked="appStore.darkSidebar"
                          size="small"
                          @change="appStore.toggleDarkSidebar"
                        />
                      </div>
                    </div>
                  </a-button>

                  <!-- 头部反转 -->
                  <a-button type="text" block :class="itemBtnClassName">
                    <div class="flex items-center justify-between w-full px-4 py-3">
                      <div class="text-left">
                        <div class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                          头部反转色
                        </div>
                        <div class="text-[11px] text-slate-400 mt-0.5">顶栏与内容区对比配色</div>
                      </div>
                      <div class="flex-shrink-0" @click.stop>
                        <Switch
                          :checked="appStore.darkHeader"
                          size="small"
                          @change="appStore.toggleDarkHeader"
                        />
                      </div>
                    </div>
                  </a-button>

                  <!-- 灰色模式 -->
                  <a-button type="text" block :class="itemBtnClassName">
                    <div class="flex items-center justify-between w-full px-4 py-3">
                      <div class="text-left">
                        <div class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                          灰色模式
                        </div>
                        <div class="text-[11px] text-slate-400 mt-0.5">整体灰度显示</div>
                      </div>
                      <div class="flex-shrink-0" @click.stop>
                        <Switch
                          :checked="appStore.grayMode"
                          size="small"
                          @change="appStore.toggleGrayMode"
                        />
                      </div>
                    </div>
                  </a-button>

                  <!-- 色弱模式 -->
                  <a-button type="text" block :class="itemBtnClassName">
                    <div class="flex items-center justify-between w-full px-4 py-3">
                      <div class="text-left">
                        <div class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                          色弱模式
                        </div>
                        <div class="text-[11px] text-slate-400 mt-0.5">适配色弱阅读</div>
                      </div>
                      <div class="flex-shrink-0" @click.stop>
                        <Switch
                          :checked="appStore.colorWeak"
                          size="small"
                          @change="appStore.toggleColorWeak"
                        />
                      </div>
                    </div>
                  </a-button>

                  <!-- 折叠菜单 -->
                  <a-button type="text" block :class="itemBtnClassName">
                    <div class="flex items-center justify-between w-full px-4 py-3">
                      <div class="text-left">
                        <div class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                          折叠菜单
                        </div>
                        <div class="text-[11px] text-slate-400 mt-0.5">侧栏仅保留图标</div>
                      </div>
                      <div class="flex-shrink-0" @click.stop>
                        <Switch
                          :checked="appStore.sidebarCollapsed"
                          size="small"
                          @change="appStore.toggleSidebar"
                        />
                      </div>
                    </div>
                  </a-button>
                </div>
              </div>
              <div>
                <div :class="groupTitleClassName">
                  <div :class="groupIconClassName">
                    <Icon icon="carbon:ruler" />
                  </div>
                  <span>尺寸参数</span>
                </div>
                <div :class="groupBoxClassName">
                  <a-button type="text" block :class="itemBtnClassName">
                    <div class="flex items-center justify-between w-full px-4 py-3">
                      <span class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                        侧边栏宽度
                      </span>
                      <div @click.stop>
                        <InputNumber
                          :value="appStore.sidebarWidth"
                          :min="180"
                          :max="280"
                          :step="10"
                          size="small"
                          class="!w-28"
                          @change="
                            (v: any) => v !== null && appStore.updateSetting({ sidebarWidth: v })
                          "
                        />
                      </div>
                    </div>
                  </a-button>

                  <a-button type="text" block :class="itemBtnClassName">
                    <div class="flex items-center justify-between w-full px-4 py-3">
                      <span class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                        圆角大小
                      </span>
                      <div @click.stop>
                        <InputNumber
                          :value="appStore.borderRadius"
                          :min="0"
                          :max="16"
                          :step="1"
                          size="small"
                          class="!w-28"
                          @change="
                            (v: any) => v !== null && appStore.updateSetting({ borderRadius: v })
                          "
                        />
                      </div>
                    </div>
                  </a-button>
                </div>
              </div>
            </template>

            <!-- ============================================================ -->
            <!-- 扩展                                                        -->
            <!-- ============================================================ -->
            <template v-else-if="activeSection === 'advanced'">
              <!-- 水印 -->
              <div>
                <div :class="groupTitleClassName">
                  <div :class="groupIconClassName">
                    <Icon icon="carbon:watermark" />
                  </div>
                  <span>水印配置</span>
                </div>
                <div :class="groupBoxClassName">
                  <a-button type="text" block :class="itemBtnClassName">
                    <div class="flex items-center justify-between w-full px-4 py-3">
                      <div class="text-left">
                        <div class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                          显示全局水印
                        </div>
                        <div class="text-[11px] text-slate-400 mt-0.5">覆盖整个管理后台页面</div>
                      </div>
                      <div @click.stop>
                        <Switch
                          :checked="appStore.enableWatermark"
                          size="small"
                          @change="appStore.toggleWatermark"
                        />
                      </div>
                    </div>
                  </a-button>

                  <a-button
                    v-if="appStore.enableWatermark"
                    type="text"
                    block
                    :class="itemBtnClassName"
                  >
                    <div class="flex items-center justify-between w-full px-4 py-3">
                      <span class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                        水印内容
                      </span>
                      <div @click.stop>
                        <Input
                          :value="appStore.watermarkContent"
                          placeholder="请输入"
                          size="small"
                          class="!w-32"
                          @update:value="
                            (v: string) => appStore.updateSetting({ watermarkContent: v })
                          "
                        />
                      </div>
                    </div>
                  </a-button>
                </div>
              </div>

              <!-- 工具栏 -->
              <div>
                <div :class="groupTitleClassName">
                  <div :class="groupIconClassName">
                    <Icon icon="carbon:tool-kit" />
                  </div>
                  <span>工具栏</span>
                </div>
                <div :class="groupBoxClassName">
                  <a-button type="text" block :class="itemBtnClassName">
                    <div class="flex items-center justify-between w-full px-4 py-3">
                      <div class="text-left">
                        <div class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                          水波纹效果
                        </div>
                        <div class="text-[11px] text-slate-400 mt-0.5">按钮点击涟漪反馈</div>
                      </div>
                      <div @click.stop>
                        <Switch
                          :checked="appStore.enableWaterRipple"
                          size="small"
                          @change="appStore.toggleWaterRipple"
                        />
                      </div>
                    </div>
                  </a-button>
                </div>
              </div>

              <!-- 消息通知 -->
              <div>
                <div :class="groupTitleClassName">
                  <div :class="groupIconClassName">
                    <Icon icon="carbon:notification" />
                  </div>
                  <span>消息通知</span>
                </div>
                <div :class="groupBoxClassName">
                  <a-button type="text" block :class="itemBtnClassName">
                    <div class="flex items-center justify-between w-full px-4 py-3">
                      <span class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                        通知位置
                      </span>
                    </div>
                  </a-button>

                  <Segmented
                    :value="appStore.notificationPosition"
                    :options="notificationPositionOptions"
                    :styles="sectionStyles"
                    block
                    @change="(v: any) => appStore.updateSetting({ notificationPosition: v })"
                  />
                </div>
              </div>

              <!-- 系统维护 -->
              <div>
                <div :class="groupTitleClassName">
                  <div :class="groupIconClassName">
                    <Icon icon="carbon:tools" />
                  </div>
                  <span>系统维护</span>
                </div>
                <div :class="groupBoxClassName">
                  <a-button type="text" block :class="itemBtnClassName" @click="handleReset">
                    <div class="flex items-center gap-3 w-full px-4 py-3">
                      <div
                        class="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-500/15 to-pink-500/15 flex items-center justify-center flex-shrink-0"
                      >
                        <Icon icon="carbon:reset" class="text-rose-500 text-base" />
                      </div>
                      <div class="text-left">
                        <div class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                          重置设置
                        </div>
                        <div class="text-[11px] text-slate-400 mt-0.5">恢复所有选项为默认值</div>
                      </div>
                    </div>
                  </a-button>
                </div>
              </div>
            </template>
          </div>
        </PerfectScrollbar>
      </div>
    </div>
  </a-drawer>
</template>

<style scoped>
/* ============================================================
   抽屉毛玻璃
   ============================================================ */
:global(.setting-drawer .ant-drawer-content) {
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}

:global(.dark .setting-drawer .ant-drawer-content) {
  background: rgba(2, 6, 23, 0.96);
}

/* ============================================================
   Segmented 微调
   ============================================================ */
:global(.ant-segmented-item-selected) {
  color: var(--ant-color-primary, #1677ff) !important;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06) !important;
}

:global(.ant-segmented-item:hover:not(.ant-segmented-item-selected)) {
  color: var(--ant-color-primary, #1677ff);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  :global(.setting-drawer .ant-drawer-content) {
    background: #fff;
  }

  :global(.dark .setting-drawer .ant-drawer-content) {
    background: #020617;
  }
}
</style>

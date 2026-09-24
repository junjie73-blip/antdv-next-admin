<script setup lang="ts">
import { Input } from "antdv-next";

import { LAYOUT_OPTIONS, LayoutIcon } from "~/layouts/components/LayoutIcon";
import { useAppStore } from "~/stores/modules/app";

import SettingGroup from "./SettingGroup.vue";
import SettingItem from "./SettingItem.vue";

defineOptions({ name: "LayoutPanel" });

const appStore = useAppStore();
</script>

<template>
  <div class="space-y-6">
    <!-- ============================================================ -->
    <!-- 布局样式                                                        -->
    <!-- ============================================================ -->
    <SettingGroup title="布局样式" icon="carbon:layout">
      <div class="grid grid-cols-2 gap-3">
        <button
          v-for="item in LAYOUT_OPTIONS"
          :key="item.value"
          type="button"
          class="relative flex flex-col items-center gap-2 rounded-xl p-2 outline outline-1 transition-all duration-200"
          :class="
            appStore.layout === item.value
              ? 'bg-ant-primary/5 outline-ant-primary outline-2'
              : 'hover:outline-ant-primary/40 bg-white outline-slate-200 dark:bg-slate-800 dark:outline-slate-700'
          "
          @click="appStore.updateSetting({ layout: item.value })"
        >
          <LayoutIcon :type="item.value" :active="appStore.layout === item.value" />
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
            class="bg-ant-primary absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full"
          >
            <span class="text-xs text-white">✓</span>
          </div>
        </button>
      </div>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 侧边栏                                                          -->
    <!-- ============================================================ -->
    <SettingGroup title="侧边栏" icon="carbon:side-panel-close">
      <SettingItem label="折叠菜单栏" desc="侧栏仅保留图标">
        <a-switch
          :checked="appStore.sidebarCollapsed"
          size="small"
          @change="appStore.toggles.sidebarCollapsed"
        />
      </SettingItem>

      <SettingItem label="菜单手风琴" desc="仅展开一个子菜单">
        <a-switch
          :checked="appStore.menuAccordion"
          size="small"
          @change="appStore.toggles.menuAccordion"
        />
      </SettingItem>

      <SettingItem label="菜单栏宽度" desc="180 - 280 px">
        <a-input-number
          :value="appStore.sidebarWidth"
          :min="180"
          :max="280"
          :step="10"
          size="small"
          class="!w-24"
          @change="(v: number | null) => v !== null && appStore.updateSetting({ sidebarWidth: v })"
        />
      </SettingItem>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 标签页                                                          -->
    <!-- ============================================================ -->
    <SettingGroup title="标签页" icon="carbon:tabs">
      <SettingItem label="显示标签页" desc="主内容区顶部多标签导航">
        <a-switch :checked="appStore.showTabs" size="small" @change="appStore.toggles.showTabs" />
      </SettingItem>

      <SettingItem label="标签带图标" desc="标签页显示图标">
        <a-switch
          :checked="appStore.tabShowIcon"
          size="small"
          @change="appStore.toggles.tabShowIcon"
        />
      </SettingItem>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 面包屑                                                          -->
    <!-- ============================================================ -->
    <SettingGroup title="面包屑" icon="carbon:gui">
      <SettingItem label="开启面包屑">
        <a-switch
          :checked="appStore.showBreadcrumb"
          size="small"
          @change="appStore.toggles.showBreadcrumb"
        />
      </SettingItem>

      <SettingItem label="仅一个时隐藏" desc="只有一级菜单时隐藏面包屑">
        <a-switch
          :checked="appStore.hideBreadcrumbWhenOnlyOne"
          size="small"
          @change="appStore.toggles.hideBreadcrumbWhenOnlyOne"
        />
      </SettingItem>

      <SettingItem label="显示面包屑图标">
        <a-switch
          :checked="appStore.showBreadcrumbIcon"
          size="small"
          @change="appStore.toggles.showBreadcrumbIcon"
        />
      </SettingItem>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 小部件                                                          -->
    <!-- ============================================================ -->
    <SettingGroup title="小部件" icon="carbon:widget">
      <SettingItem label="通知小部件">
        <a-switch
          :checked="appStore.widgetNotice"
          size="small"
          @change="appStore.toggles.widgetNotice"
        />
      </SettingItem>

      <SettingItem label="全屏小部件">
        <a-switch
          :checked="appStore.widgetFullscreen"
          size="small"
          @change="appStore.toggles.widgetFullscreen"
        />
      </SettingItem>

      <SettingItem label="主题小部件">
        <a-switch
          :checked="appStore.widgetTheme"
          size="small"
          @change="appStore.toggles.widgetTheme"
        />
      </SettingItem>

      <SettingItem label="时区小部件">
        <a-switch
          :checked="appStore.widgetTimezone"
          size="small"
          @change="appStore.toggles.widgetTimezone"
        />
      </SettingItem>

      <SettingItem label="退出登录小部件">
        <a-switch
          :checked="appStore.widgetLogout"
          size="small"
          @change="appStore.toggles.widgetLogout"
        />
      </SettingItem>

      <SettingItem label="搜索菜单小部件">
        <a-switch
          :checked="appStore.widgetSearch"
          size="small"
          @change="appStore.toggles.widgetSearch"
        />
      </SettingItem>

      <SettingItem label="偏好设置小部件">
        <a-switch
          :checked="appStore.widgetPreferences"
          size="small"
          @change="appStore.toggles.widgetPreferences"
        />
      </SettingItem>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 底栏 + 版权                                                    -->
    <!-- ============================================================ -->
    <SettingGroup title="底栏与版权" icon="carbon:text-align-center">
      <SettingItem label="显示底栏">
        <a-switch
          :checked="appStore.showFooter"
          size="small"
          @change="appStore.toggles.showFooter"
        />
      </SettingItem>

      <SettingItem label="显示版权">
        <a-switch
          :checked="appStore.showCopyright"
          size="small"
          @change="appStore.toggles.showCopyright"
        />
      </SettingItem>

      <SettingItem label="公司名">
        <Input
          :value="appStore.copyrightCompany"
          placeholder="请输入公司名"
          size="small"
          class="!w-32"
          @update:value="(v: string) => appStore.updateSetting({ copyrightCompany: v })"
        />
      </SettingItem>

      <SettingItem label="备案信息">
        <Input
          :value="appStore.copyrightIcp"
          placeholder="如：京ICP备..."
          size="small"
          class="!w-32"
          @update:value="(v: string) => appStore.updateSetting({ copyrightIcp: v })"
        />
      </SettingItem>
    </SettingGroup>
  </div>
</template>

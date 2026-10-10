<script setup lang="ts">
import type { TabStyle } from '@antdv/types';

import {
  CONTENT_MAX_WIDTH,
  CONTENT_MIN_WIDTH,
  CONTENT_MODE_OPTIONS,
  LAYOUT_MODE_OPTIONS,
  LAYOUT_SIDEBAR_MAX_WIDTH,
  LAYOUT_SIDEBAR_MIN_WIDTH,
  showsHeaderNav,
  showsNavRail,
} from '@antdv/layouts';
import { Input, Segmented } from 'antdv-next';
import { LayoutIcon } from '~/layouts/components/LayoutIcon';
import { TAB_STYLE_OPTIONS } from '~/layouts/composables/useTabStyle';
import { useAppStore } from '~/stores/modules/app';

import SettingGroup from './SettingGroup.vue';
import SettingItem from './SettingItem.vue';

defineOptions({ name: 'LayoutPanel' });

const appStore = useAppStore();

/** Segmented 的 `value` 只能是 string | number，偏好里的联合类型在这里收窄一次 */
const tabStyleOptions = TAB_STYLE_OPTIONS.map((item) => ({
  label: item.label,
  value: item.value as string,
}));
</script>

<template>
  <div class="space-y-6">
    <!-- ============================================================ -->
    <!-- 布局形态：7 种，全部来自 @antdv/layouts 的 LAYOUT_MODE_OPTIONS     -->
    <!-- ============================================================ -->
    <SettingGroup title="布局" icon="carbon:grid">
      <div class="grid grid-cols-3 gap-3">
        <button
          v-for="item in LAYOUT_MODE_OPTIONS"
          :key="item.value"
          type="button"
          class="relative flex flex-col items-center gap-2 rounded-xl p-2 outline outline-1 transition-all duration-200"
          :class="
            appStore.layout === item.value
              ? 'bg-ant-primary/5 outline-ant-primary outline-2'
              : 'hover:outline-ant-primary/40 bg-white outline-slate-200 dark:bg-slate-800 dark:outline-slate-700'
          "
          :title="item.description"
          @click="appStore.updateSetting({ layout: item.value })"
        >
          <LayoutIcon
            :type="item.value"
            :active="appStore.layout === item.value"
          />
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
    <!-- 内容区宽度：与布局形态正交，7 种形态都能配流式或定宽                   -->
    <!-- ============================================================ -->
    <SettingGroup title="内容" icon="carbon:align-box-middle-left">
      <div class="grid grid-cols-2 gap-3">
        <button
          v-for="item in CONTENT_MODE_OPTIONS"
          :key="item.value"
          type="button"
          class="flex flex-col items-center gap-1 rounded-xl p-2 outline outline-1 transition-all duration-200"
          :class="
            appStore.contentMode === item.value
              ? 'bg-ant-primary/5 outline-ant-primary outline-2'
              : 'hover:outline-ant-primary/40 bg-white outline-slate-200 dark:bg-slate-800 dark:outline-slate-700'
          "
          :title="item.description"
          @click="appStore.updateSetting({ contentMode: item.value })"
        >
          <LayoutIcon
            :type="item.value === 'fixed' ? 'content-fixed' : 'content-full'"
            :active="appStore.contentMode === item.value"
          />
          <span
            class="text-[11px] font-medium"
            :class="
              appStore.contentMode === item.value
                ? 'text-ant-primary'
                : 'text-slate-500 dark:text-slate-400'
            "
          >
            {{ item.label }}
          </span>
        </button>
      </div>

      <SettingItem
        v-if="appStore.contentMode === 'fixed'"
        label="定宽宽度"
        :desc="`${CONTENT_MIN_WIDTH} - ${CONTENT_MAX_WIDTH} px，超出后居中留白`"
      >
        <a-slider
          :value="appStore.contentWidth"
          :min="CONTENT_MIN_WIDTH"
          :max="CONTENT_MAX_WIDTH"
          :step="20"
          class="!w-32 !m-0"
          @change="
            (v: number) => appStore.updateSetting({ contentWidth: v })
          "
        />
      </SettingItem>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 顶部导航栏（顶栏承载一级菜单的形态）                              -->
    <!-- ============================================================ -->
    <SettingGroup
      v-if="showsHeaderNav(appStore.layout)"
      title="顶部导航栏"
      icon="carbon:border-top"
    >
      <SettingItem
        label="溢出横向滚动"
        desc="菜单过多时用滚动条/触摸滑动查看，而不是折叠进「···」"
      >
        <a-switch
          :checked="appStore.headerMenuScroll"
          size="small"
          @change="appStore.toggles.headerMenuScroll"
        />
      </SettingItem>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 侧边栏                                                          -->
    <!-- ============================================================ -->
    <SettingGroup title="侧边栏" icon="carbon:side-panel-close">
      <!--
        侧边导航现在是"常驻侧栏"形态，折叠开关对它有效；
        窄屏下它会被 useShell 升级成浮层抽屉，那时折叠由抽屉自己管。
      -->
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

      <SettingItem
        label="菜单栏宽度"
        :desc="`${LAYOUT_SIDEBAR_MIN_WIDTH} - ${LAYOUT_SIDEBAR_MAX_WIDTH} px`"
      >
        <a-input-number
          :value="appStore.sidebarWidth"
          :min="LAYOUT_SIDEBAR_MIN_WIDTH"
          :max="LAYOUT_SIDEBAR_MAX_WIDTH"
          :step="10"
          size="small"
          class="!w-24"
          @change="
            (v: number | null) =>
              v !== null && appStore.updateSetting({ sidebarWidth: v })
          "
        />
      </SettingItem>

      <SettingItem
        v-if="showsNavRail(appStore.layout)"
        label="图标栏宽度"
        desc="双列形态第一列的宽度"
      >
        <a-input-number
          :value="appStore.railWidth"
          :min="48"
          :max="96"
          :step="4"
          size="small"
          class="!w-24"
          @change="
            (v: number | null) => v !== null && appStore.updateSetting({ railWidth: v })
          "
        />
      </SettingItem>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 标签页                                                          -->
    <!-- ============================================================ -->
    <SettingGroup title="标签页" icon="carbon:bookmark">
      <SettingItem label="显示标签页" desc="主内容区顶部多标签导航">
        <a-switch
          :checked="appStore.showTabs"
          size="small"
          @change="appStore.toggles.showTabs"
        />
      </SettingItem>

      <SettingItem label="标签带图标" desc="标签页显示图标">
        <a-switch
          :checked="appStore.tabShowIcon"
          size="small"
          @change="appStore.toggles.tabShowIcon"
        />
      </SettingItem>

      <!--
        风格/拖拽/右键这三项早有偏好字段与渲染逻辑（useTabStyle、TabList 的 draggable、
        LayoutTabs 的 openContextMenu），但抽屉里没有入口，等于功能只在代码里存在、
        用户在界面上永远切不到。这里补上开关，行为不改，只是把已有的能力接出来。
      -->
      <SettingItem
        label="标签风格"
        desc="卡片带底色、谷歌是浏览器标签、胶囊圆角、下划线仅指示条、纯文本用分隔线"
        stacked
      >
        <Segmented
          block
          size="small"
          :options="tabStyleOptions"
          :value="appStore.tabStyle"
          @change="(v: string | number) => appStore.updateSetting({ tabStyle: v as TabStyle })"
        />
      </SettingItem>

      <SettingItem label="拖拽排序" desc="按住标签左右拖动调整顺序，固定标签始终排在最前">
        <a-switch
          :checked="appStore.tabDragSort"
          size="small"
          @change="appStore.toggles.tabDragSort"
        />
      </SettingItem>

      <SettingItem label="右键菜单" desc="在标签上右键呼出关闭/固定/放大等操作">
        <a-switch
          :checked="appStore.tabContextMenu"
          size="small"
          @change="appStore.toggles.tabContextMenu"
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
    <SettingGroup title="小部件" icon="carbon:application">
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
          @update:value="
            (v: string) => appStore.updateSetting({ copyrightCompany: v })
          "
        />
      </SettingItem>

      <SettingItem label="备案信息">
        <Input
          :value="appStore.copyrightIcp"
          placeholder="如：京ICP备..."
          size="small"
          class="!w-32"
          @update:value="
            (v: string) => appStore.updateSetting({ copyrightIcp: v })
          "
        />
      </SettingItem>
    </SettingGroup>
  </div>
</template>

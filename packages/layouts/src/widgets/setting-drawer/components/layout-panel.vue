<script setup lang="ts">
import type { TabStyle } from '@antdv/types';

import { computed } from 'vue';

import { Segmented } from '@antdv/common-ui';
import {
  LAYOUT_SIDEBAR_MAX_WIDTH,
  LAYOUT_SIDEBAR_MIN_WIDTH,
  useLayoutI18n,
} from '@antdv/layout-ui';
import {
  Input,
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
  Slider,
  Switch,
} from '@antdv/shadcn-ui';
import { TAB_STYLE_OPTIONS } from '@antdv/tabs-ui';
import { useAppStore } from '@antdv/stores';

import { mixWithWhite } from '@antdv/shared/color';
import {
  CONTENT_MAX_WIDTH,
  CONTENT_MIN_WIDTH,
  CONTENT_MODE_OPTIONS,
} from '../../../content';
import LayoutIcon from '../../layout-icon.vue';
import {
  LAYOUT_MODE_OPTIONS,
  showsHeaderNav,
  showsNavRail,
} from '../../../modes';
import SettingGroup from './setting-group.vue';
import SettingItem from './setting-item.vue';

defineOptions({ name: 'LayoutPanel' });

const appStore = useAppStore();
const { t } = useLayoutI18n();

/**
 * 示意图的主色跟着主题走。
 *
 * `@antdv/layouts` 的 `LayoutIcon` 不 import 组件库（那份 `.tsx` 以前直接
 * `theme.useToken()`，在 StyleProvider 之外一调用就抛错，也没法进单测），
 * 改成外部注入四个主色派生值 —— 用户换了主色，示意图还得跟着变。
 * 三个派生值按白色占比混合，对应 antd 色板里 hover / bg / border 的档位。
 */
const iconPalette = computed(() => ({
  primary: appStore.primaryColor,
  primaryHover: mixWithWhite(appStore.primaryColor, 0.3),
  primaryBg: mixWithWhite(appStore.primaryColor, 0.9),
  primaryBorder: mixWithWhite(appStore.primaryColor, 0.6),
}));

/**
 * 必须包在 computed 里：`TAB_STYLE_OPTIONS` 的 `label` 是 getter，
 * 在 setup 里 map 一次就把文案固化成了字符串，切语言不跟着变；
 * 放进 computed 后读 getter 的那次求值才挂上 locale 依赖。
 *
 * 另外 Segmented 的 `value` 只能是 string | number，偏好里的联合类型在这里收窄一次。
 */
const tabStyleOptions = computed(() =>
  TAB_STYLE_OPTIONS.map((item) => ({
    label: item.label,
    value: item.value as string,
  })),
);
</script>

<template>
  <div class="space-y-6">
    <!-- ============================================================ -->
    <!-- 布局形态：7 种，全部来自 @antdv/layouts 的 LAYOUT_MODE_OPTIONS     -->
    <!-- ============================================================ -->
    <SettingGroup :title="t('preferences.layout')" icon="carbon:grid">
      <div class="grid grid-cols-3 gap-3">
        <button
          v-for="item in LAYOUT_MODE_OPTIONS"
          :key="item.value"
          type="button"
          class="relative flex flex-col items-center gap-2 rounded-xl p-2 outline outline-1 transition-all duration-200"
          :class="
            appStore.layout === item.value
              ? 'bg-primary/5 outline-primary outline-2'
              : 'hover:outline-primary/40 bg-white outline-slate-200 dark:bg-slate-800 dark:outline-slate-700'
          "
          :title="item.description"
          @click="appStore.updateSetting({ layout: item.value })"
        >
          <LayoutIcon
            :type="item.value"
            :active="appStore.layout === item.value"
            :palette="iconPalette"
          />
          <span
            class="text-[11px] font-medium"
            :class="
              appStore.layout === item.value
                ? 'text-primary'
                : 'text-slate-500 dark:text-slate-400'
            "
          >
            {{ item.label }}
          </span>
          <div
            v-if="appStore.layout === item.value"
            class="bg-primary absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full"
          >
            <span class="text-xs text-white">✓</span>
          </div>
        </button>
      </div>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 内容区宽度：与布局形态正交，7 种形态都能配流式或定宽                   -->
    <!-- ============================================================ -->
    <SettingGroup
      :title="t('preferences.content')"
      icon="carbon:align-box-middle-left"
    >
      <div class="grid grid-cols-2 gap-3">
        <button
          v-for="item in CONTENT_MODE_OPTIONS"
          :key="item.value"
          type="button"
          class="flex flex-col items-center gap-1 rounded-xl p-2 outline outline-1 transition-all duration-200"
          :class="
            appStore.contentMode === item.value
              ? 'bg-primary/5 outline-primary outline-2'
              : 'hover:outline-primary/40 bg-white outline-slate-200 dark:bg-slate-800 dark:outline-slate-700'
          "
          :title="item.description"
          @click="appStore.updateSetting({ contentMode: item.value })"
        >
          <LayoutIcon
            :type="item.value === 'fixed' ? 'content-fixed' : 'content-full'"
            :active="appStore.contentMode === item.value"
            :palette="iconPalette"
          />
          <span
            class="text-[11px] font-medium"
            :class="
              appStore.contentMode === item.value
                ? 'text-primary'
                : 'text-slate-500 dark:text-slate-400'
            "
          >
            {{ item.label }}
          </span>
        </button>
      </div>

      <SettingItem
        v-if="appStore.contentMode === 'fixed'"
        :label="t('preferences.fixedWidth')"
        :desc="
          t('preferences.fixedWidthDesc', {
            max: CONTENT_MAX_WIDTH,
            min: CONTENT_MIN_WIDTH,
          })
        "
      >
        <Slider
          :model-value="[appStore.contentWidth]"
          :min="CONTENT_MIN_WIDTH"
          :max="CONTENT_MAX_WIDTH"
          :step="20"
          class="w-32"
          @update:model-value="
            (v: number[] | undefined) =>
              v && appStore.updateSetting({ contentWidth: v[0] })
          "
        />
      </SettingItem>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 顶部导航栏（顶栏承载一级菜单的形态）                              -->
    <!-- ============================================================ -->
    <SettingGroup
      v-if="showsHeaderNav(appStore.layout)"
      :title="t('preferences.headerNav')"
      icon="carbon:border-top"
    >
      <SettingItem
        :label="t('preferences.headerMenuScroll')"
        :desc="t('preferences.headerMenuScrollDesc')"
      >
        <Switch
          :model-value="appStore.headerMenuScroll"
          @update:model-value="appStore.toggles.headerMenuScroll"
        />
      </SettingItem>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 侧边栏                                                          -->
    <!-- ============================================================ -->
    <SettingGroup
      :title="t('preferences.sidebar')"
      icon="carbon:side-panel-close"
    >
      <!--
        侧边导航现在是"常驻侧栏"形态，折叠开关对它有效；
        窄屏下它会被 useShell 升级成浮层抽屉，那时折叠由抽屉自己管。
      -->
      <SettingItem
        :label="t('preferences.sidebarCollapsed')"
        :desc="t('preferences.sidebarCollapsedDesc')"
      >
        <Switch
          :model-value="appStore.sidebarCollapsed"
          @update:model-value="appStore.toggles.sidebarCollapsed"
        />
      </SettingItem>

      <SettingItem
        :label="t('preferences.menuAccordion')"
        :desc="t('preferences.menuAccordionDesc')"
      >
        <Switch
          :model-value="appStore.menuAccordion"
          @update:model-value="appStore.toggles.menuAccordion"
        />
      </SettingItem>

      <SettingItem
        :label="t('preferences.sidebarWidth')"
        :desc="`${LAYOUT_SIDEBAR_MIN_WIDTH} - ${LAYOUT_SIDEBAR_MAX_WIDTH} px`"
      >
        <NumberField
          :model-value="appStore.sidebarWidth"
          :min="LAYOUT_SIDEBAR_MIN_WIDTH"
          :max="LAYOUT_SIDEBAR_MAX_WIDTH"
          :step="10"
          class="w-24"
          @update:model-value="
            (v: number | undefined) =>
              v !== undefined && appStore.updateSetting({ sidebarWidth: v })
          "
        >
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput class="h-8" />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>
      </SettingItem>

      <SettingItem
        v-if="showsNavRail(appStore.layout)"
        :label="t('preferences.railWidth')"
        :desc="t('preferences.railWidthDesc')"
      >
        <NumberField
          :model-value="appStore.railWidth"
          :min="48"
          :max="96"
          :step="4"
          class="w-24"
          @update:model-value="
            (v: number | undefined) =>
              v !== undefined && appStore.updateSetting({ railWidth: v })
          "
        >
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput class="h-8" />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>
      </SettingItem>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 标签页                                                          -->
    <!-- ============================================================ -->
    <SettingGroup :title="t('preferences.tabs')" icon="carbon:bookmark">
      <SettingItem
        :label="t('preferences.showTabs')"
        :desc="t('preferences.showTabsDesc')"
      >
        <Switch
          :model-value="appStore.showTabs"
          @update:model-value="appStore.toggles.showTabs"
        />
      </SettingItem>

      <SettingItem
        :label="t('preferences.tabShowIcon')"
        :desc="t('preferences.tabShowIconDesc')"
      >
        <Switch
          :model-value="appStore.tabShowIcon"
          @update:model-value="appStore.toggles.tabShowIcon"
        />
      </SettingItem>

      <!--
        风格/拖拽/右键这三项早有偏好字段与渲染逻辑（@antdv/tabs-ui 的 useTabStyle、
        TabList 的 draggable、TabContextMenu），但抽屉里没有入口，等于功能只在代码里存在、
        用户在界面上永远切不到。这里补上开关，行为不改，只是把已有的能力接出来。
      -->
      <SettingItem
        :label="t('preferences.tabStyle')"
        :desc="t('preferences.tabStyleDesc')"
        stacked
      >
        <Segmented
          block
          :options="tabStyleOptions"
          :value="appStore.tabStyle"
          @change="
            (v: string | number) =>
              appStore.updateSetting({ tabStyle: v as TabStyle })
          "
        />
      </SettingItem>

      <SettingItem
        :label="t('preferences.tabDragSort')"
        :desc="t('preferences.tabDragSortDesc')"
      >
        <Switch
          :model-value="appStore.tabDragSort"
          @update:model-value="appStore.toggles.tabDragSort"
        />
      </SettingItem>

      <SettingItem
        :label="t('preferences.tabContextMenu')"
        :desc="t('preferences.tabContextMenuDesc')"
      >
        <Switch
          :model-value="appStore.tabContextMenu"
          @update:model-value="appStore.toggles.tabContextMenu"
        />
      </SettingItem>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 面包屑                                                          -->
    <!-- ============================================================ -->
    <SettingGroup :title="t('preferences.breadcrumb')" icon="carbon:gui">
      <SettingItem :label="t('preferences.showBreadcrumb')">
        <Switch
          :model-value="appStore.showBreadcrumb"
          @update:model-value="appStore.toggles.showBreadcrumb"
        />
      </SettingItem>

      <SettingItem
        :label="t('preferences.breadcrumbHideOnlyOne')"
        :desc="t('preferences.breadcrumbHideOnlyOneDesc')"
      >
        <Switch
          :model-value="appStore.hideBreadcrumbWhenOnlyOne"
          @update:model-value="appStore.toggles.hideBreadcrumbWhenOnlyOne"
        />
      </SettingItem>

      <SettingItem :label="t('preferences.showBreadcrumbIcon')">
        <Switch
          :model-value="appStore.showBreadcrumbIcon"
          @update:model-value="appStore.toggles.showBreadcrumbIcon"
        />
      </SettingItem>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 小部件                                                          -->
    <!-- ============================================================ -->
    <SettingGroup :title="t('preferences.widgets')" icon="carbon:application">
      <SettingItem :label="t('preferences.widgetNotice')">
        <Switch
          :model-value="appStore.widgetNotice"
          @update:model-value="appStore.toggles.widgetNotice"
        />
      </SettingItem>

      <SettingItem :label="t('preferences.widgetFullscreen')">
        <Switch
          :model-value="appStore.widgetFullscreen"
          @update:model-value="appStore.toggles.widgetFullscreen"
        />
      </SettingItem>

      <SettingItem :label="t('preferences.widgetTheme')">
        <Switch
          :model-value="appStore.widgetTheme"
          @update:model-value="appStore.toggles.widgetTheme"
        />
      </SettingItem>

      <SettingItem :label="t('preferences.widgetTimezone')">
        <Switch
          :model-value="appStore.widgetTimezone"
          @update:model-value="appStore.toggles.widgetTimezone"
        />
      </SettingItem>

      <SettingItem :label="t('preferences.widgetLogout')">
        <Switch
          :model-value="appStore.widgetLogout"
          @update:model-value="appStore.toggles.widgetLogout"
        />
      </SettingItem>

      <SettingItem :label="t('preferences.widgetSearch')">
        <Switch
          :model-value="appStore.widgetSearch"
          @update:model-value="appStore.toggles.widgetSearch"
        />
      </SettingItem>

      <SettingItem :label="t('preferences.widgetPreferences')">
        <Switch
          :model-value="appStore.widgetPreferences"
          @update:model-value="appStore.toggles.widgetPreferences"
        />
      </SettingItem>
    </SettingGroup>

    <!-- ============================================================ -->
    <!-- 底栏 + 版权                                                    -->
    <!-- ============================================================ -->
    <SettingGroup
      :title="t('preferences.footerCopyright')"
      icon="carbon:text-align-center"
    >
      <SettingItem :label="t('preferences.showFooter')">
        <Switch
          :model-value="appStore.showFooter"
          @update:model-value="appStore.toggles.showFooter"
        />
      </SettingItem>

      <SettingItem :label="t('preferences.showCopyright')">
        <Switch
          :model-value="appStore.showCopyright"
          @update:model-value="appStore.toggles.showCopyright"
        />
      </SettingItem>

      <SettingItem :label="t('preferences.copyrightCompany')">
        <Input
          :model-value="appStore.copyrightCompany"
          :placeholder="t('preferences.copyrightCompanyPlaceholder')"
          class="w-32"
          @update:model-value="
            (v: string | number) =>
              appStore.updateSetting({ copyrightCompany: String(v) })
          "
        />
      </SettingItem>

      <SettingItem :label="t('preferences.copyrightIcp')">
        <Input
          :model-value="appStore.copyrightIcp"
          :placeholder="t('preferences.copyrightIcpPlaceholder')"
          class="w-32"
          @update:model-value="
            (v: string | number) =>
              appStore.updateSetting({ copyrightIcp: String(v) })
          "
        />
      </SettingItem>
    </SettingGroup>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { useMagicKeys, whenever } from '@vueuse/core';

import { useMobile } from '../hooks/use-layout';
import GlobalSearch from './global-search/index.vue';
import SettingDrawer from './setting-drawer/index.vue';
import { partitionVisibleWidgets, useVisibleWidgets } from './registry';

defineOptions({ name: 'LayoutWidgetBar' });

/**
 * 顶栏右侧的小部件条（`@antdv/layout-ui` 顶栏的 `tools` 插槽内容）。
 *
 * 胶囊外壳（那圈 rounded-xl + 阴影）属于表现层，已经进了 layout-ui；
 * 这里摆"哪几个按钮、点了开哪个面板"，开关来自 app store，
 * 面板与视图靠 `configureLayoutHost` 交进来的数据工作。
 *
 * 窄屏（< 768px）时这一层还要做一次分流：顶栏只留「退出登录」，
 * 设置抽屉与主题切换挪到屏幕右缘居中的悬浮簇，其余全部不渲染
 * （分流口径见 `registry.ts` 的 `partitionVisibleWidgets`）。
 * 分流只看视口，不改偏好：`widgetXxx` 那些开关仍然是"能不能出现"的唯一真相，
 * 用户关掉的主题切换在窄屏上也不会被这条规则强行塞回来。
 */
const visibleWidgets = useVisibleWidgets();
const mobile = useMobile();
const widgets = computed(() =>
  partitionVisibleWidgets(visibleWidgets.value, mobile.value),
);

const showSetting = ref(false);
/** 顶栏搜索按钮与 Ctrl+K 都开这同一个弹层（以前指向一个从没渲染过的 `showNotification`，按了没反应） */
const showSearch = ref(false);

/**
 * 快捷键绑在这一层，而不是绑在 `WidgetSearch` 里。
 *
 * 小部件是异步分包的：登录首屏之后还要等那一小块 chunk 落地并挂载，
 * `useMagicKeys` 的监听才存在。实测这段窗口足够咬到用例（按下 Ctrl+K 完全没有反应），
 * 对用户同样是"刚进系统时快捷键时灵时不灵"。绑定挪到这里，
 * 外壳一挂载就能用；`WidgetSearch` 只负责那颗按钮。
 */
const { ctrl_k, meta_k } = useMagicKeys();
whenever(
  () => Boolean(ctrl_k?.value || meta_k?.value),
  () => {
    showSearch.value = true;
  },
);

/** 需要额外事件的组件（其余小部件自己处理自己的 `open`） */
function handleWidgetEvent(key: string) {
  if (key === 'preferences') showSetting.value = true;
  if (key === 'search') showSearch.value = true;
}
</script>

<template>
  <!--
    `v-motion` 要挂在元素上：小部件的根节点是 reka 的 Popover/Dropdown 容器（非元素根），
    指令落不进去，Vue 只会给一条警告，动画和 hover 缩放都静默失效。

    `data-layout-widget="header"` 是给用例的槽位钩子：窄屏那一簇是 `fixed`，
    但 DOM 上仍然是工具区的后代，只按 `[data-layout-region="header"] button` 数会把
    悬浮簇的两颗一起数进去，问不出"顶栏这一槽到底留了谁"。
  -->
  <div
    v-for="meta in widgets.header"
    :key="meta.key"
    v-motion
    class="flex shrink-0 items-center"
    data-layout-widget="header"
    :initial="{ opacity: 0, y: -6 }"
    :enter="{
      opacity: 1,
      y: 0,
      transition: { duration: 220, delay: 40 },
    }"
    :hovered="{ scale: 1.08 }"
    :tapped="{ scale: 0.94 }"
  >
    <component :is="meta.component" @open="handleWidgetEvent(meta.key)" />
  </div>

  <!--
    窄屏右缘居中的悬浮簇：设置抽屉 + 主题切换。
    `z-30` 刻意压在浮层菜单的遮罩（z-40）与面板（z-50）之下 ——
    抽屉打开时这一簇该被盖住，而不是和菜单抢同一块屏幕；
    贴右缘不留圆角右侧（只 `rounded-l-xl`），视觉上就是挂在屏幕边上的一个把手。
    这里不叠 `v-motion`：位移动画与居中的 `-translate-y-1/2` 会互相覆盖。
  -->
  <div
    v-if="widgets.floating.length > 0"
    class="fixed right-0 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-1 rounded-l-xl bg-white px-1 py-2 shadow-lg shadow-gray-300/40 dark:bg-gray-800 dark:shadow-black/40"
    data-layout-floating-widgets
  >
    <component
      :is="meta.component"
      v-for="meta in widgets.floating"
      :key="meta.key"
      @open="handleWidgetEvent(meta.key)"
    />
  </div>

  <SettingDrawer v-model:visible="showSetting" />
  <GlobalSearch v-model:open="showSearch" />
</template>

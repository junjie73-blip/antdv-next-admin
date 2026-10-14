<script setup lang="ts">
import { ref } from 'vue';

import { useMagicKeys, whenever } from '@vueuse/core';

import { useVisibleWidgets } from '../widgets';
import MenuSearchModal from './MenuSearchModal.vue';
import SettingDrawer from './SettingDrawer/index.vue';

defineOptions({ name: 'HeaderWidgets' });

/**
 * 顶栏右侧的小部件条（`@antdv/layout-ui` 顶栏的 `tools` 插槽内容）。
 *
 * 胶囊外壳（那圈 rounded-xl + 阴影）属于表现层，已经进了包；
 * 这里只负责"摆哪几个按钮、点了开哪个面板"，两者都带业务依赖：
 * 开关来自 app store，面板是应用自己的抽屉。
 */
const visibleWidgets = useVisibleWidgets();

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
  -->
  <div
    v-for="meta in visibleWidgets"
    :key="meta.key"
    v-motion
    class="flex shrink-0 items-center"
    :initial="{ opacity: 0, y: -6 }"
    :enter="{
      opacity: 1,
      y: 0,
      transition: { duration: 220, delay: 40 },
    }"
    :hovered="{ scale: 1.08 }"
    :tapped="{ scale: 0.94 }"
  >
    <component
      :is="meta.component"
      @open="handleWidgetEvent(meta.key)"
    />
  </div>

  <SettingDrawer v-model:visible="showSetting" />
  <MenuSearchModal v-model:open="showSearch" />
</template>

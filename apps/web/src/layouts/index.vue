<script setup lang="ts">
import { onMounted } from 'vue';

import {
  BasicLayout,
  LayoutUserDropdown,
  LayoutWidgetBar,
} from '@antdv/layouts';

import logoUrl from '~/assets/images/logo.png';
import { useDictStore } from '~/stores';

defineOptions({
  name: 'DefaultLayout',
});

/**
 * 应用侧只留这一层薄壳，因为 `vite-plugin-vue-layouts-next` 按目录约定取布局
 * （`src/layouts/index.vue` 就是 defaultLayout），外壳本体与顶栏小部件都在 `@antdv/layouts`。
 *
 * 这里只交两样"包内不该知道"的东西：
 * - 品牌图标与产品名：打包资源路径与 `.env`，属于宿主；
 * - 字典：业务数据，进入后台才拉一次。
 *
 * 小部件要的接口、语言候选与账户页面走 `plugins/layouts-host.ts` 的注入，
 * 不在这里逐个传 props。
 */
const appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Next Admin';
const dictStore = useDictStore();

onMounted(() => {
  dictStore.fetchAllDicts();
});
</script>

<template>
  <BasicLayout :logo="logoUrl" :title="appTitle">
    <template #tools>
      <LayoutWidgetBar />
    </template>

    <template #user>
      <LayoutUserDropdown />
    </template>
  </BasicLayout>
</template>

<script setup lang="ts">
import type { LayoutFooterConfig } from '../../layout';

import { computed } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';

import { useLayoutStyle } from '../../hooks/use-layout';

defineOptions({ name: 'LayoutFooter' });

const props = withDefaults(defineProps<LayoutFooterConfig>(), {
  company: 'Antdv Admin',
  companyHref: 'https://github.com/junjie73-blip/antdv-next-admin',
  icp: '',
  icpHref: 'https://beian.miit.gov.cn/',
  showCopyright: true,
  year: undefined,
});

const style = useLayoutStyle(() => ({}));

/** 年份在渲染时取：跨天不重渲染也不会写死成打包那天的年份 */
const currentYear = computed(() => props.year ?? new Date().getFullYear());
</script>

<template>
  <!--
    壳层可见性由使用方决定（`regions.footerVisible && showFooter`），
    这里只关心"版权这一行画什么"。
    `data-layout-region="footer"`：迁移前靠 antd 的 `.ant-layout-footer` 定位，
    换成自绘壳后必须自己给出稳定钩子。
  -->
  <footer data-layout-region="footer" :class="style.footerClass()">
    <template v-if="props.showCopyright">
      <span class="flex items-center gap-1">
        <Icon icon="carbon:license" class="text-sm" />
        <span>{{ currentYear }}</span>
        <a
          v-if="props.companyHref"
          :href="props.companyHref"
          target="_blank"
          rel="noopener noreferrer"
          class="font-medium text-slate-600 transition-colors hover:text-primary dark:text-slate-300 dark:hover:text-blue-400"
        >
          {{ props.company }}
        </a>
        <span v-else class="font-medium text-slate-600 dark:text-slate-300">
          {{ props.company }}
        </span>
      </span>

      <!-- 备案号是可选的：没配置就整段不出现，不留一个孤零零的分隔点 -->
      <span v-if="props.icp" class="flex items-center gap-2">
        <span class="text-slate-300 dark:text-slate-700">·</span>
        <a
          :href="props.icpHref"
          target="_blank"
          rel="noopener noreferrer"
          class="transition-colors hover:text-slate-600 dark:hover:text-slate-300"
        >
          {{ props.icp }}
        </a>
      </span>

      <span class="flex items-center gap-2">
        <span class="text-slate-300 dark:text-slate-700">·</span>
        <span>All Rights Reserved</span>
      </span>
    </template>
  </footer>
</template>

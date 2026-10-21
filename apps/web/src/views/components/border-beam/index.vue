<script setup lang="ts">
import { BorderBeam, Card } from '@antdv/common-ui';
import { cn } from '@antdv/shared/utils/cn';

/**
 * BorderBeam 示例页。
 *
 * 组件是个"带内容的容器"：默认插槽放正文，光带作为一层遮罩环盖在边框上，
 * 所以颜色、粗细、时长、弧长全部可以按卡片单独配，互不影响。
 */

const containerClassName = cn('space-y-6');
const pageHeaderClassName = cn('mb-2');
const pageTitleClassName = cn(
  'text-2xl font-bold text-gray-800 dark:text-gray-100',
);
const pageDescClassName = cn('mt-1 text-gray-500 dark:text-gray-400');
const gridClassName = cn(
  'grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3',
);
const demoClassName = cn('p-6 text-sm');
const labelClassName = cn('text-muted-foreground text-xs');

/** 演示用的几组配置，直接对应组件的可配项 */
const VARIANTS = [
  {
    desc: '默认：主色光带、25% 弧长、6 秒一圈、2px 粗细',
    props: {},
    title: '跟随主题',
  },
  {
    desc: 'color / tailColor 换成琥珀到透明',
    props: {
      color: 'hsl(var(--warning))',
      tailColor: 'rgba(250, 173, 20, 0.15)',
    },
    title: '自定义颜色',
  },
  {
    desc: 'borderWidth 6 + size 60：粗光带、大弧长',
    props: { borderWidth: 6, size: 60 },
    title: '加粗加长',
  },
  {
    desc: 'duration 18 + delay -6：慢速且中途入场，不留首屏空转',
    props: { delay: -6, duration: 18 },
    title: '慢速常驻',
  },
  {
    desc: 'radius 999px：胶囊容器上半径跟着走',
    props: { radius: '999px' },
    title: '大圆角',
  },
  {
    desc: 'radius 0：把光带压成直角描边',
    props: { borderWidth: 3, radius: 0 },
    title: '无圆角',
  },
] as const;
</script>

<template>
  <div :class="containerClassName">
    <div :class="pageHeaderClassName">
      <h2 :class="pageTitleClassName">边框光带 BorderBeam</h2>
      <p :class="pageDescClassName">
        绕容器边缘跑一圈的装饰性光带，颜色、粗细、时长、弧长与半径都可配
      </p>
    </div>

    <div :class="gridClassName">
      <BorderBeam
        v-for="variant in VARIANTS"
        :key="variant.title"
        v-bind="variant.props"
        class="bg-card"
      >
        <div :class="demoClassName">
          <p class="font-medium">{{ variant.title }}</p>
          <p :class="labelClassName" class="mt-1">{{ variant.desc }}</p>
        </div>
      </BorderBeam>
    </div>

    <Card title="用在真实卡片上" variant="borderless">
      <BorderBeam class="rounded-lg" :border-width="2" :duration="8" :size="35">
        <div class="flex items-center justify-between gap-4 p-6">
          <div>
            <p class="text-sm text-muted-foreground">本月同步任务</p>
            <p class="mt-1 text-2xl font-semibold">1 284</p>
          </div>
          <p class="text-xs text-muted-foreground">
            光带只是装饰：系统开了"减少动效"时它会停在原位，
            <br />
            边框本身仍然在。
          </p>
        </div>
      </BorderBeam>
    </Card>
  </div>
</template>

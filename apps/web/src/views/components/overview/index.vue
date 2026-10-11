<script setup lang="ts">
import type { MenuConfig } from '@antdv/types';

import { computed, ref } from 'vue';

import { cn } from '@antdv/shared/cn';
import { Icon } from '@iconify/vue';
import { useRouteStore } from '~/stores/modules/route';

/**
 * 组件示例总览。
 *
 * 示例页有 30 多张，散在「组件画廊 → 分类 → 页面」三级菜单里，侧栏手风琴一次只
 * 展开一个分类，想"看看都有些什么"只能一个个点。这一页把同一棵树摊平成卡片墙，
 * 配一个关键字过滤，当作整个画廊的目录。
 *
 * 数据**不另写一份清单**：直接读路由 store 里已经归一化好的菜单树
 * （`useRouteStore().menus`）。菜单是这些页面唯一的"可达 + 有标题 + 有权限"来源，
 * 再抄一份就必然对不上 —— 新增示例页只要进菜单就会自动出现在这里。
 */

const GALLERY_NAME = 'DemoGallery';

const routeStore = useRouteStore();

const keyword = ref('');

const containerClassName = cn('space-y-4');
const headerClassName = cn('flex', 'flex-wrap', 'items-center', 'gap-3');
const countClassName = cn('text-sm', 'text-gray-500', 'dark:text-gray-400');
const groupClassName = cn('space-y-3');
const groupTitleClassName = cn(
  'flex',
  'items-center',
  'gap-2',
  'text-base',
  'font-semibold',
);
const gridClassName = cn(
  'grid',
  'grid-cols-1',
  'sm:grid-cols-2',
  'lg:grid-cols-3',
  'xl:grid-cols-4',
  'gap-3',
);
const cardClassName = cn(
  'group',
  'flex',
  'items-center',
  'gap-3',
  'rounded-lg',
  'border',
  'border-gray-200',
  'bg-white',
  'px-4',
  'py-3',
  'no-underline',
  'text-inherit',
  'cursor-pointer',
  'transition-all',
  'hover:border-ant-primary',
  'hover:shadow-sm',
  'dark:border-gray-700',
  'dark:bg-gray-900',
);
const iconClassName = cn(
  'shrink-0',
  'text-xl',
  'text-gray-400',
  'transition-colors',
  'group-hover:text-ant-primary',
  'dark:text-gray-500',
);
const titleClassName = cn('truncate', 'text-sm', 'font-medium');
const pathClassName = cn(
  'truncate',
  'font-mono',
  'text-xs',
  'text-gray-400',
  'dark:text-gray-500',
);

interface GalleryGroup {
  items: MenuConfig[];
  key: string;
  title: string;
}

/** 只收"能点、且点了真的会换页"的叶子：外链与分组节点（path 为空）都不算 */
function isPage(node: MenuConfig): boolean {
  return !node.children?.length && !!node.path && !node.isExternal;
}

function collectPages(nodes: MenuConfig[]): MenuConfig[] {
  return nodes.flatMap((node) =>
    node.children?.length ? collectPages(node.children) : isPage(node) ? [node] : [],
  );
}

const groups = computed<GalleryGroup[]>(() => {
  const gallery = findGallery(routeStore.menus);
  if (!gallery) return [];
  const text = keyword.value.trim().toLowerCase();
  const match = (node: MenuConfig) =>
    !text ||
    node.title.toLowerCase().includes(text) ||
    node.path.toLowerCase().includes(text);

  return (gallery.children ?? [])
    .map((group) => ({
      items: collectPages(group.children ?? []).filter(match),
      key: group.name ?? group.path ?? group.title,
      title: group.title,
    }))
    .filter((group) => group.items.length > 0);
});

function findGallery(nodes: MenuConfig[]): MenuConfig | undefined {
  for (const node of nodes) {
    if (node.name === GALLERY_NAME) return node;
    const hit = node.children?.length ? findGallery(node.children) : undefined;
    if (hit) return hit;
  }
  return undefined;
}

const total = computed(() =>
  groups.value.reduce((sum, group) => sum + group.items.length, 0),
);
</script>

<template>
  <div :class="containerClassName">
    <div :class="headerClassName">
      <span :class="groupTitleClassName">组件示例总览</span>
      <a-input
        v-model:value="keyword"
        allow-clear
        class="w-60"
        placeholder="按名称或路径过滤"
      >
        <template #prefix>
          <Icon icon="carbon:search" />
        </template>
      </a-input>
      <span :class="countClassName">
        共 {{ total }} 个示例{{ keyword.trim() ? '（已过滤）' : '' }}
      </span>
    </div>

    <a-empty v-if="total === 0" description="没有匹配的示例页" />

    <section
      v-for="group in groups"
      :key="group.key"
      :class="groupClassName"
    >
      <h3 :class="groupTitleClassName">
        <Icon icon="carbon:folder-open" />
        <span>{{ group.title }}</span>
        <span :class="countClassName">{{ group.items.length }}</span>
      </h3>
      <div :class="gridClassName">
        <!--
          用真链接而不是 div + click：hash 路由下 `#/path` 天然可用，
          于是中键/右键"在新标签页打开"这种浏览器自带行为不用重新发明，
          键盘 Tab 也自然停得住（div 得自己补 role 与 keydown）。
        -->
        <a
          v-for="item in group.items"
          :key="item.path"
          :class="cardClassName"
          :href="`#${item.path}`"
        >
          <Icon :class="iconClassName" :icon="item.icon ?? 'carbon:document'" />
          <div class="min-w-0 flex-1">
            <div :class="titleClassName">{{ item.title }}</div>
            <div :class="pathClassName">{{ item.path }}</div>
          </div>
          <Icon
            class="shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 dark:text-gray-600"
            icon="carbon:chevron-right"
          />
        </a>
      </div>
    </section>
  </div>
</template>

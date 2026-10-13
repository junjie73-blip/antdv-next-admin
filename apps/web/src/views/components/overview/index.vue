<script setup lang="ts">
import type { MenuConfig } from '@antdv/types';

import { computed, ref } from 'vue';

import { cn } from '@antdv/shared/cn';
import { Icon } from '@iconify/vue';
import { Empty as AEmpty, Input as AInput } from 'antdv-next';
import { useRouteStore } from '~/stores/modules/route';

/**
 * 组件示例总览。
 *
 * 示例页有 30 多张。侧栏只给「表单」「表格」留了三级，其余全是二级叶子，
 * 一屏列不完，想"看看都有些什么"仍然得靠这一页：把同一棵树摊平成卡片墙，
 * 配一个关键字过滤，当作整个画廊的目录。
 *
 * 数据**不另写一份清单**：直接读路由 store 里已经归一化好的菜单树
 * （`useRouteStore().menus`）。菜单是这些页面唯一的"可达 + 有标题 + 有权限"来源，
 * 再抄一份就必然对不上 —— 新增示例页只要进菜单就会自动出现在这里。
 *
 * 分组同理，不引入第二套分类字段：有子菜单的节点（表单 / 表格）自成一组，
 * 剩下的叶子归到画廊自己名下。侧栏怎么摊平都不影响这里的分组来源。
 */

const GALLERY_NAME = 'Demo';
/** 本页自己不进卡片墙 */
const SELF_PATH = '/components/overview';

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
    node.children?.length
      ? collectPages(node.children)
      : isPage(node)
        ? [node]
        : [],
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

  const buckets = new Map<string, MenuConfig[]>();
  const push = (title: string, nodes: MenuConfig[]) => {
    const items = nodes.filter(match);
    if (items.length > 0)
      buckets.set(title, [...(buckets.get(title) ?? []), ...items]);
  };

  for (const node of gallery.children ?? []) {
    if (node.children?.length) push(node.title, collectPages(node.children));
    else if (isPage(node) && node.path !== SELF_PATH)
      push(gallery.title, [node]);
  }

  return [...buckets].map(([title, items]) => ({ items, key: title, title }));
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
      <AInput
        v-model:value="keyword"
        allow-clear
        class="w-60"
        placeholder="按名称或路径过滤"
      >
        <template #prefix>
          <Icon icon="carbon:search" />
        </template>
      </AInput>
      <span :class="countClassName">
        共 {{ total }} 个示例{{ keyword.trim() ? '（已过滤）' : '' }}
      </span>
    </div>

    <AEmpty v-if="total === 0" description="没有匹配的示例页" />

    <section v-for="group in groups" :key="group.key" :class="groupClassName">
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

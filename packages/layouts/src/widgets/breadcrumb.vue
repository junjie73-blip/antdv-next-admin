<script setup lang="ts">
import type { LayoutBreadcrumbConfig } from '../breadcrumb';

import { computed } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { isExternalPath } from '@antdv/utils';

import { shouldShowBreadcrumb } from '../breadcrumb';

defineOptions({ name: 'LayoutBreadcrumb' });

const props = withDefaults(defineProps<LayoutBreadcrumbConfig>(), {
  enabled: true,
  hideWhenOnlyOne: false,
  resolveHref: undefined,
  showIcon: true,
  variant: 'header',
});

/**
 * 类名写在这里而不是取自 `@antdv/layout-ui`：面包屑住在装配层，
 * 反过来依赖渲染包就成环了（layout-ui 要用这里的蓝图与 `shouldShowBreadcrumb`）。
 * 两档取值与迁移前一致：`header` 窄屏让位给 Logo 与工具区，`content` 独立成行。
 */
const rootClass = computed(() =>
  cn(
    'min-w-0 text-sm text-gray-500 dark:text-gray-400',
    props.variant === 'header'
      ? 'hidden items-center md:flex'
      : 'flex h-9 shrink-0 items-center bg-white px-4 dark:bg-gray-800',
  ),
);

const visible = computed(() =>
  shouldShowBreadcrumb(props.items, {
    enabled: props.enabled,
    hideWhenOnlyOne: props.hideWhenOnlyOne,
  }),
);

/**
 * 链接一律由使用方给的 `resolveHref` 生成，包内不碰 vue-router。
 *
 * 迁移前这里是 `router.resolve(path).href`：hash 模式得到 `#/system/user`，
 * history 模式得到 `/system/user`。当时不能改用 antd 面包屑的 `path`，因为它会把
 * 前面每一级拼到当前这一级（`#/system/system/user`），中键 / 右键"新标签页打开"
 * 全都指向不存在的页面，看起来就是"面包屑点不动"。
 * 换成注入函数后语义不变：外链原样交给浏览器，站内链接由使用方的路由解析。
 */
function hrefOf(path: string): string | undefined {
  if (!path) return undefined;
  const resolved = props.resolveHref?.(path);
  if (resolved) return resolved;
  return isExternalPath(path) ? path : undefined;
}

function externalOf(href?: string) {
  return Boolean(href && isExternalPath(href));
}

const entries = computed(() =>
  props.items.map((item, index) => ({
    external: externalOf(hrefOf(item.path)),
    href: hrefOf(item.path),
    icon: item.icon,
    isLast: index === props.items.length - 1,
    title: item.title,
  })),
);
</script>

<template>
  <!--
    整条不可见时不渲染，也不留下 `data-layout-region="breadcrumb"` 的空壳：
    巡检用例把它当作"这一行该不该存在"的判据。
  -->
  <Breadcrumb v-if="visible" data-layout-region="breadcrumb" :class="rootClass">
    <BreadcrumbList class="flex-wrap items-center gap-1.5">
      <BreadcrumbItem
        v-for="(entry, index) in entries"
        :key="`${entry.title}-${index}`"
        data-breadcrumb-item
        class="inline-flex min-w-0 items-center gap-1.5"
      >
        <!-- 最后一级是当前页：不输出链接，避免"点自己" -->
        <component
          :is="entry.isLast || !entry.href ? 'span' : 'a'"
          :aria-current="entry.isLast ? 'page' : undefined"
          :href="entry.isLast || !entry.href ? undefined : entry.href"
          :rel="entry.external ? 'noopener noreferrer' : undefined"
          :target="entry.external ? '_blank' : undefined"
          :class="
            cn(
              'inline-flex min-w-0 items-center gap-1.5',
              entry.isLast || !entry.href
                ? ''
                : 'hover:text-gray-700 dark:hover:text-gray-200',
            )
          "
        >
          <!-- 每一级只取自己声明的图标：菜单里画什么就画什么，渲染侧不补房子或文件夹 -->
          <Icon
            v-if="props.showIcon && entry.icon"
            data-breadcrumb-icon
            :icon="entry.icon"
            class="text-sm"
          />
          <span data-breadcrumb-label class="truncate">
            {{ entry.title }}
          </span>
        </component>

        <BreadcrumbSeparator
          v-if="!entry.isLast"
          class="inline-flex items-center text-gray-400"
        >
          <Icon icon="carbon:chevron-right" class="text-xs opacity-50" />
        </BreadcrumbSeparator>
      </BreadcrumbItem>
    </BreadcrumbList>
  </Breadcrumb>
</template>

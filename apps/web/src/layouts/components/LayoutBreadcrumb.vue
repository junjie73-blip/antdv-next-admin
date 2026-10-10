<script setup lang="ts">
import type { BreadcrumbProps } from 'antdv-next';

import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { shouldShowBreadcrumb } from '@antdv/layouts';
import { cn } from '@antdv/shared/cn';
import { isExternalPath } from '@antdv/shared/menu';
import { Icon } from '@iconify/vue';
import { useAppStore } from '~/stores/modules/app';

import { useBreadcrumb } from '../composables/useLayout';

defineOptions({ name: 'LayoutBreadcrumb' });

/**
 * 面包屑是同一个东西，只是"住在哪一行"不同：
 * - `header`：顶栏左侧就是面包屑的形态（垂直 / 双列），Logo 让位给它；
 * - `content`：顶栏被 Logo 与横向导航占据的形态（水平 / 侧边导航 / 混合），
 *   面包屑作为内容列的第一行贴在顶栏下方。
 *
 * 早先只有 `header` 一条路径，于是"Logo 系"形态里 `showBreadcrumb` 开关
 * 完全不起作用——配置项存在，渲染分支却不属于它，用户点了没反应。
 */
const props = withDefaults(
  defineProps<{
    variant?: 'content' | 'header';
  }>(),
  { variant: 'header' },
);

const appStore = useAppStore();
const router = useRouter();
const { breadcrumbs } = useBreadcrumb();

const visible = computed(() =>
  shouldShowBreadcrumb(breadcrumbs.value, {
    enabled: appStore.showBreadcrumb,
    hideWhenOnlyOne: appStore.hideBreadcrumbWhenOnlyOne,
  }),
);

/**
 * 链接一律用 `href`，不用 antd 的 `path`。
 *
 * 这不是风格选择：antd 的 `path` 会把**前面每一级的 path 拼到当前这一级**
 * （`BreadcrumbItemType.path` 的注释原话是 "It will concat all prev `path`
 * to the current one"，实现在 `href = '#/' + paths.join('/')`）。
 * 我们的菜单 path 本来就是完整路径，于是"系统管理 / 用户管理"画出来是
 * `#/system` 和 `#/system/system/user` —— 链接指向一个不存在的页面，
 * 鼠标中键、右键"在新标签页打开"、状态栏预览全都错，看起来像"面包屑点不动"。
 *
 * `href` 则由 `router.resolve` 生成：hash 模式得到 `#/system/user`，
 * history 模式得到 `/system/user`，切换历史模式不用改这里。
 * 外链（菜单里 `https://` 那种）原样交给浏览器，不进路由。
 */
function hrefOf(path?: string): string | undefined {
  if (!path) return undefined;
  if (isExternalPath(path)) return path;
  return router.resolve(path).href;
}

const items = computed<BreadcrumbProps['items']>(() =>
  breadcrumbs.value.map((item) => ({
    href: hrefOf(item.path),
    title: item.title,
  })),
);

/**
 * 每一级只取自己声明的图标 —— 菜单里画的是什么，面包屑就画什么。
 *
 * 这里原本写死过两个 fallback：第 0 级给「房子」，其余没有图标时给「文件夹」。
 * 那等于渲染侧替数据编故事：导航的根节点用的是 `carbon:dashboard`，
 * 面包屑却画一座房子，用户看到的就是"两边对不上"。
 * 菜单数据是唯一的真相，没有图标就不占位（见 `@antdv/layouts` 的面包屑来源注释）。
 *
 * 返回值用空串而不是 `undefined` 表示"没有图标"：模板里 `v-if` 与 `:icon`
 * 是两次独立调用，TS 不会把前者对后者的收窄关系连起来，`string | undefined`
 * 会在 `<Icon :icon>` 上报类型错。空串既让 `v-if` 为假，也让 `:icon` 保持 `string`。
 */
function iconOf(index: number): string {
  return breadcrumbs.value[index]?.icon ?? '';
}
</script>

<template>
  <a-breadcrumb
    v-if="visible"
    data-layout-region="breadcrumb"
    :class="
      cn(
        'min-w-0 text-sm',
        props.variant === 'header'
          ? // 顶栏里空间紧张：窄屏（<md）先让位给 Logo 与工具区
            'hidden items-center md:flex'
          : // 独立成行时补上顶栏的底色，与标签栏连成同一块白色外壳
            'flex h-9 shrink-0 items-center bg-white px-4 dark:bg-gray-800',
      )
    "
    :items="items"
  >
    <template #separator>
      <Icon icon="carbon:chevron-right" class="text-xs opacity-50" />
    </template>
    <template #titleRender="{ item, index }">
      <!-- 链接本身交给 antd 的 `.ant-breadcrumb-link`（上面 `hrefOf` 生成的 href），
           这里只负责"图标 + 文字"的排布，不再自己绑一次点击，避免两套导航。 -->
      <span class="inline-flex items-center gap-1.5">
        <Icon
          v-if="appStore.showBreadcrumbIcon && iconOf(index)"
          :icon="iconOf(index)"
          class="text-sm"
        />
        <span>{{ item.title }}</span>
      </span>
    </template>
  </a-breadcrumb>
</template>

<style scoped>
/* 分隔符要跟文字基线对齐，antd 默认按行盒排，带图标时会偏上 */
:deep(.ant-breadcrumb-separator) {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

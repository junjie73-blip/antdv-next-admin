<script setup lang="ts">
import type { LayoutTone } from '../../../layout';

import { IconifyIcon as Icon } from '@antdv/icons/icon';

import { useLayoutStyle } from '../../../hooks/use-layout';

defineOptions({ name: 'SidebarCollapsedButton' });

/**
 * 侧栏折叠入口。
 *
 * 两个落点、同一颗按钮（`variant`）：
 * - `bar`：贴着常驻侧栏的底边 —— 放在顶栏时用户要点到右上角才收起"左边这一列"，
 *   动作和目标隔着整个屏幕，本包的惯例是做在侧栏底部的一条横杠上；
 * - `icon`：顶栏左侧那颗，只服务于"侧栏不在场"的形态（浮层抽屉 / 只剩图标栏）。
 *
 * 两个 `data-layout-*` 属性是端到端用例与样式覆盖的定位钩子，不是装饰。
 */
const props = withDefaults(
  defineProps<{
    /** 菜单此刻是不是展开的：图标要表示"点了会变成什么"，而不是当前状态 */
    label?: string;
    open?: boolean;
    tone?: LayoutTone;
    variant?: 'bar' | 'icon';
  }>(),
  {
    label: undefined,
    open: true,
    tone: () => ({}),
    variant: 'bar',
  },
);

const emit = defineEmits<{ click: [] }>();

const style = useLayoutStyle(() => props.tone);
</script>

<template>
  <button
    type="button"
    :class="
      props.variant === 'icon' ? style.triggerClass() : style.collapseBarClass()
    "
    :data-layout-sidebar-collapse="props.variant === 'bar' ? 'true' : undefined"
    :data-layout-sidebar-trigger="props.variant === 'icon' ? 'true' : undefined"
    :aria-label="props.label"
    :aria-expanded="props.open"
    :title="props.label"
    @click="emit('click')"
  >
    <Icon
      :icon="props.open ? 'carbon:side-panel-close' : 'carbon:side-panel-open'"
      class="text-lg"
    />
  </button>
</template>

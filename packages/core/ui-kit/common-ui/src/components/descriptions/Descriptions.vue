<script lang="ts">
import type { PropType, VNode } from 'vue';

import type { ResponsiveColumn } from './grid';

import {
  computed,
  defineComponent,
  Fragment,
  getCurrentInstance,
  h,
  provide,
} from 'vue';

import { cn } from '@antdv/shared/utils/cn';

import { DESCRIPTIONS_KEY } from './context';
import { buildResponsiveCss } from './grid';

/** 展开 Fragment 并过滤 Text / Comment，避免空白节点成为 flex item */
function flattenItems(nodes: VNode[]): VNode[] {
  const result: VNode[] = [];
  for (const node of nodes) {
    if (!node) continue;
    if (node.type === Fragment && Array.isArray(node.children)) {
      result.push(...flattenItems(node.children as VNode[]));
    } else if (typeof node.type !== 'symbol') {
      result.push(node);
    }
  }
  return result;
}

export default defineComponent({
  name: 'Descriptions',
  props: {
    bordered: { type: Boolean, default: false },
    column: {
      type: [Number, Object] as PropType<ResponsiveColumn>,
      default: 3,
    },
    layout: {
      type: String as PropType<'horizontal' | 'vertical'>,
      default: 'horizontal',
    },
    size: {
      type: String as PropType<'default' | 'middle' | 'small'>,
      default: 'default',
    },
    title: { type: String, default: undefined },
    labelWidth: { type: [Number, String], default: undefined },
  },
  setup(props, { slots }) {
    // 每个实例一个作用域 class，响应式 CSS 互不污染
    const scope = `antdv-desc-${getCurrentInstance()?.uid ?? 0}`;
    const responsiveCss = computed(() =>
      buildResponsiveCss(`.${scope}`, props.column),
    );

    provide(
      DESCRIPTIONS_KEY,
      computed(() => ({
        bordered: props.bordered,
        column: props.column,
        layout: props.layout,
        size: props.size,
        labelWidth: props.labelWidth,
      })),
    );

    return () => {
      const rootStyle: Record<string, string> = {};
      if (
        props.labelWidth !== undefined &&
        props.labelWidth !== null &&
        props.labelWidth !== ''
      ) {
        rootStyle['--desc-label-width'] =
          typeof props.labelWidth === 'number'
            ? `${props.labelWidth}px`
            : props.labelWidth;
      }

      const header =
        props.title || slots.title
          ? h(
              'div',
              {
                'data-common-descriptions-title': '',
                class: 'mb-2 text-base font-medium',
              },
              slots.title ? slots.title() : props.title,
            )
          : null;

      return h(
        'div',
        {
          'data-common-descriptions': '',
          'data-bordered': String(props.bordered),
          class: cn(scope, 'w-full text-sm'),
          style: rootStyle,
        },
        [
          h('style', null, responsiveCss.value),
          header,
          h(
            'div',
            {
              'data-common-descriptions-row': '',
              class: cn(
                'flex w-full flex-wrap items-start',
                props.bordered && 'overflow-hidden rounded-md border',
              ),
            },
            flattenItems(slots.default?.() ?? []),
          ),
          slots.extra?.(),
        ],
      );
    };
  },
});
</script>

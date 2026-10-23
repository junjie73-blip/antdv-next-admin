import type { ComputedRef } from 'vue';

import type { FormProps } from '../../../types';

import { computed } from 'vue';

import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';

import {
  buildRowStyle,
  DEFAULT_GUTTER_PX,
  GRID_TOTAL,
  pickResponsiveCols,
  resolveGutterPx,
  resolveLabelCol,
  resolveRowGapPx,
  resolveWrapperCol,
} from '../helpers/grid';

export interface UseFormGridOptions {
  getProps: ComputedRef<FormProps>;
}

/**
 * 排版层：列数、间距、行容器样式，以及要注入给字段的 `labelCol` / `wrapperCol`。
 *
 * 响应式断点与"外部显式配置优先"的优先级都收在这里；`useFormRows` 只关心
 * "一行能放多少栅格"，不必知道断点是怎么算出来的。
 */
export function useFormGrid(options: UseFormGridOptions) {
  const { getProps } = options;

  // 响应式断点（Tailwind 约定）：<640 → 1 列 / <768 → 2 列 / <1280 → 3 列 / ≥1280 → 4 列
  const breakpoints = useBreakpoints(breakpointsTailwind);

  const responsiveCols = computed(() =>
    pickResponsiveCols((name) => breakpoints.smaller(name).value),
  );

  /** 实际生效的列数：`grid.cols` 在 1-4 内才认，否则走响应式 */
  const effectiveCols = computed(() => {
    const configured = getProps.value.grid?.cols;
    if (configured !== undefined && configured >= 1 && configured <= 4) {
      return configured;
    }
    return responsiveCols.value;
  });

  /** 单个字段默认占的栅格数 */
  const gridColSpan = computed(() =>
    Math.floor(GRID_TOTAL / effectiveCols.value),
  );

  const gutter = computed(
    () => getProps.value.grid?.gutter ?? DEFAULT_GUTTER_PX,
  ) as ComputedRef<[number, number] | number>;

  /** 行内边距取 gutter 的水平分量，行容器与字段各吃掉一半 */
  const gutterPx = computed(() => resolveGutterPx(gutter.value));

  /**
   * 行与行（以及行内换行后）的垂直间距。
   *
   * antd 的 `gutter` 只有写成 `[水平, 垂直]` 才有垂直分量，单值时垂直为 0；
   * 字段本身带 `min-h-9`，两行贴在一起就是一屏拥挤，所以要兜一个默认值。
   */
  const rowGapPx = computed(() => resolveRowGapPx(gutter.value));

  const rowStyle = computed(() =>
    buildRowStyle({
      baseRowStyle: getProps.value.baseRowStyle,
      gap: rowGapPx.value,
      gutter: gutterPx.value,
    }),
  );

  const labelCol = computed(() => resolveLabelCol(getProps.value));
  const wrapperCol = computed(() => resolveWrapperCol(getProps.value));

  return {
    effectiveCols,
    gridColSpan,
    gutter,
    gutterPx,
    labelCol,
    rowGapPx,
    rowStyle,
    wrapperCol,
  };
}

export type UseFormGridReturn = ReturnType<typeof useFormGrid>;

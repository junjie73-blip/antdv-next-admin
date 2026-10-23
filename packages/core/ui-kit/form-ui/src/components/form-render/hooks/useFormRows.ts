import type { ComputedRef, Ref } from 'vue';

import type { FormProps } from '../../../types';
import type { FormRow } from '../helpers/rows';
import type { FormSchema } from '../schema';

import { computed, ref } from 'vue';

import { groupSchemasIntoRows, pickActionsSpan } from '../helpers/rows';

export interface UseFormRowsOptions {
  /** 每行默认栅格数（来自 `useFormGrid`） */
  gridColSpan: ComputedRef<number>;
  getProps: ComputedRef<FormProps>;
  schemaRef: Ref<FormSchema[]>;
}

/**
 * 行分组 + 折叠状态。
 *
 * "哪些行参与渲染"和"折叠开合"是同一件事的两面，放在一起才能避免出现第二套
 * 折叠判断（历史上动作区的宿主行就曾经按未折叠的行数算，展开时抖一下）。
 */
export function useFormRows(options: UseFormRowsOptions) {
  const { getProps, gridColSpan, schemaRef } = options;

  const isAdvanced = ref(false);

  /** 折叠时仍然常显的行数 */
  const alwaysShowLines = computed(() => getProps.value.alwaysShowLines ?? 3);

  const allRows = computed<FormRow[]>(() =>
    groupSchemasIntoRows(schemaRef.value || [], gridColSpan.value),
  );

  /** 开了折叠开关、且行数真的超过常显行数，才需要"展开"这颗按钮 */
  const needCollapse = computed(() => {
    return (
      !!getProps.value.showAdvancedButton &&
      allRows.value.length > alwaysShowLines.value
    );
  });

  const displayRows = computed<FormRow[]>(() => {
    const rows = allRows.value;
    if (needCollapse.value && !isAdvanced.value) {
      return rows.slice(0, alwaysShowLines.value);
    }
    return rows;
  });

  /**
   * 渲染用的行：schema 为空时也要给动作区留一个宿主行容器，
   * 否则「只有按钮组」的表单会一个节点都不渲染。
   */
  const rowsWithActions = computed<FormRow[]>(() => {
    const rows = displayRows.value;
    if (rows.length > 0 || !getProps.value.showActionButtonGroup) return rows;
    return [{ isDivider: false, schemas: [], span: 0 }];
  });

  const actionsSpan = computed(() => pickActionsSpan(rowsWithActions.value));

  function toggleAdvanced() {
    isAdvanced.value = !isAdvanced.value;
  }

  const isDividerRow = (row: FormRow) => row.isDivider;

  return {
    actionsSpan,
    allRows,
    alwaysShowLines,
    displayRows,
    isAdvanced,
    isDividerRow,
    needCollapse,
    rowsWithActions,
    toggleAdvanced,
  };
}

export type UseFormRowsReturn = ReturnType<typeof useFormRows>;
export type { FormRow };

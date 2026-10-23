import type { ComputedRef, Ref } from 'vue';

import type { Recordable, TableRowKey, TableRowSelection } from '../types';
import type { DisplayRow } from './useTableRows';

import { computed, unref } from 'vue';

export interface UseSelectionColumnOptions {
  /** 当前**可见**行（含树形摊平后的子行）：全选只管这些行 */
  displayRows: ComputedRef<DisplayRow[]>;
  /** 全量数据源：`onChange` 要把 key 还原成行对象交出去 */
  dataSourceRef: Ref<Recordable[]>;
  getRowKeyValue: (record: Recordable) => TableRowKey;
  getRowSelection: ComputedRef<null | TableRowSelection>;
}

/**
 * 选择列的视图模型（勾选框该不该打勾、全选框的三态、点一下抛什么）。
 *
 * 与 `useRowSelection` 的分工：那边管**受控状态**（把 `selectedRowKeys` prop 镜像成
 * 内部 ref、提供 clear/set/selectRows 给外部 API），这边只管"这一列怎么渲染、
 * 用户点了以后按 antd 的约定回调谁"。合成一个 hook 会让"谁拥有状态"这件事再次模糊 ——
 * 而它正是这个组件里最容易搞错的地方。
 */
export function useSelectionColumn(options: UseSelectionColumnOptions) {
  const { dataSourceRef, displayRows, getRowKeyValue, getRowSelection } =
    options;

  const selectionType = computed(
    () => getRowSelection.value?.type ?? 'checkbox',
  );

  /**
   * 选中态用的是**字符串化**的 rowKey —— 与 `useRowSelection` 内部的 `getRowKeyValue`
   * 保持一致（那边就是 `String(record[rowKey])`），否则数字主键的表永远勾选不上。
   * 展开态相反，必须交原始值（见 `useTableRows` 的说明）。
   */
  const selectionKey = (record: Recordable): string =>
    String(getRowKeyValue(record));

  const isSelected = (record: Recordable) =>
    (getRowSelection.value?.selectedRowKeys ?? []).includes(
      selectionKey(record) as never,
    );

  function toggleRowSelection(record: Recordable) {
    const cfg = getRowSelection.value;
    if (!cfg) return;
    const key = selectionKey(record);
    const current = (cfg.selectedRowKeys ?? []) as string[];
    const index = current.indexOf(key);
    let keys: string[];
    if (selectionType.value === 'radio') {
      keys = index === -1 ? [key] : [];
    } else if (index === -1) {
      keys = [...current, key];
    } else {
      keys = current.filter((item) => item !== key);
    }
    const keySet = new Set(keys);
    const rows = unref(dataSourceRef).filter((item) =>
      keySet.has(selectionKey(item)),
    );
    cfg.onChange?.(keys, rows, { type: 'multiple' });
  }

  /** 可参与全选的记录：`getCheckboxProps` 判定为禁用的行不算 */
  const selectableRecords = computed(() =>
    displayRows.value
      .map((row) => row.record)
      .filter(
        (record) =>
          !getRowSelection.value?.getCheckboxProps?.(record)?.disabled,
      ),
  );

  const isAllSelected = computed(
    () =>
      selectableRecords.value.length > 0 &&
      selectableRecords.value.every((record) => isSelected(record)),
  );

  /** 半选：选了但不是全选。原生 `<input type="checkbox">` 用 `indeterminate` 属性表达 */
  const isIndeterminate = computed(() => {
    const selectedCount = selectableRecords.value.filter((record) =>
      isSelected(record),
    ).length;
    return selectedCount > 0 && selectedCount < selectableRecords.value.length;
  });

  function toggleAllSelection() {
    const cfg = getRowSelection.value;
    if (!cfg || cfg.hideSelectAll) return;
    if (isAllSelected.value) {
      cfg.onChange?.([], [], { type: 'all' });
      return;
    }
    cfg.onChange?.(
      selectableRecords.value.map((record) => selectionKey(record)),
      selectableRecords.value,
      { type: 'all' },
    );
  }

  const getCheckboxDisabled = (record: Recordable) =>
    getRowSelection.value?.getCheckboxProps?.(record)?.disabled ?? false;

  return {
    getCheckboxDisabled,
    isAllSelected,
    isIndeterminate,
    isSelected,
    selectionKey,
    selectionType,
    selectableRecords,
    toggleAllSelection,
    toggleRowSelection,
  };
}

export type UseSelectionColumnReturn = ReturnType<typeof useSelectionColumn>;

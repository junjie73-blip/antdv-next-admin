import type {
  BasicColumn,
  UseColumnsOptions,
  UseColumnsReturn,
} from '../types';

import { ref, toRaw, unref, watch } from 'vue';

import { cloneDeep, isString } from 'es-toolkit';

const isArray = Array.isArray;

export function useColumns(options: UseColumnsOptions): UseColumnsReturn {
  const {
    columns,
    showIndexColumn = false,
    indexColumnProps = {},
    actionColumn,
  } = options;

  const columnsRef = ref<BasicColumn[]>([]);
  const cacheColumnsRef = ref<BasicColumn[]>([]);

  const getIndexColumn = (): BasicColumn => ({
    key: 'index',
    dataIndex: 'index',
    title: '序号',
    width: 60,
    align: 'center',
    fixed: 'left',
    customRender: ({ index }) => index + 1,
    ...indexColumnProps,
  });

  const getActionColumn = (): BasicColumn | null => {
    const actionCol = unref(actionColumn);
    if (!actionCol) return null;
    return {
      key: 'action',
      dataIndex: 'action',
      title: '操作',
      width: actionCol.width || 200,
      fixed: actionCol.fixed || 'right',
      align: 'center',
      ...actionCol,
    };
  };

  const processColumns = (cols: BasicColumn[]): BasicColumn[] => {
    const result: BasicColumn[] = [];
    if (unref(showIndexColumn)) result.push(getIndexColumn());
    result.push(...cols.map((col) => ({ align: 'center' as const, ...col })));
    const actionCol = getActionColumn();
    if (actionCol) result.push(actionCol);
    return result;
  };

  const initColumns = () => {
    const rawColumns = unref(columns);
    if (!isArray(rawColumns)) return;
    const processed = processColumns(
      cloneDeep(toRaw(rawColumns) as BasicColumn[]),
    );
    columnsRef.value = processed;
    cacheColumnsRef.value = processed;
  };

  const setColumns = (columnList: BasicColumn[] | string[]) => {
    if (!isArray(columnList)) return;
    if (columnList.length > 0 && isString(columnList[0])) {
      const keys = columnList as string[];
      const map = new Map<string, BasicColumn>();
      for (const c of cacheColumnsRef.value) {
        const k = (c.key || c.dataIndex) as string;
        if (k) map.set(k, c);
      }
      columnsRef.value = keys
        .map((k) => map.get(k))
        .filter(Boolean) as BasicColumn[];
    } else {
      columnsRef.value = columnList as BasicColumn[];
    }
  };

  const getColumns = (): BasicColumn[] => unref(columnsRef);
  const getCacheColumns = (): BasicColumn[] => unref(cacheColumnsRef);
  const setCacheColumns = (cols: BasicColumn[]) => {
    cacheColumnsRef.value = cols;
  };

  const updateColumn = (column: Partial<BasicColumn>, key: string) => {
    const i = columnsRef.value.findIndex(
      (col) => col.key === key || col.dataIndex === key,
    );
    if (i !== -1) columnsRef.value[i] = { ...columnsRef.value[i], ...column };
  };

  watch(
    [
      () => unref(columns),
      () => unref(showIndexColumn),
      () => unref(actionColumn),
    ],
    initColumns,
    {
      immediate: true,
      deep: true,
    },
  );

  return {
    columnsRef,
    cacheColumnsRef,
    setColumns,
    getColumns,
    getCacheColumns,
    setCacheColumns,
    updateColumn,
  };
}

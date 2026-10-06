import type {
  FetchParams,
  FetchSetting,
  Recordable,
  UseDataSourceOptions,
  UseDataSourceReturn,
} from '../types';

import { ref, unref, watch } from 'vue';

// useDataSource.ts
import { useTimeoutFn } from '@vueuse/core';
import { message } from 'antdv-next';
import { cloneDeep, isFunction, isPlainObject } from 'es-toolkit';
import { resolveErrorMessage } from '~/composables';

const DEFAULT_FETCH_SETTING: FetchSetting = {
  pageField: 'pageNum',
  sizeField: 'pageSize',
  listField: 'list',
  totalField: 'total',
};

/** 解构后端响应外层包装（保持与原 unwrap 语义一致） */
function getRawData(raw: any): any {
  if (
    raw &&
    typeof raw === 'object' &&
    'data' in raw &&
    raw.data !== undefined
  ) {
    return raw.data;
  }
  return raw;
}

export function useDataSource(
  options: UseDataSourceOptions,
): UseDataSourceReturn {
  const {
    api,
    dataSource,
    beforeFetch,
    afterFetch,
    fetchSetting = DEFAULT_FETCH_SETTING,
    rowKey = 'id',
    immediate = true,
    pagination,
    loading,
  } = options;

  const dataSourceRef = ref<Recordable[]>([]);
  const rawDataSourceRef = ref<Recordable[]>([]);

  /** 请求序号：只有最新一次请求才能落地 */
  let requestId = 0;
  /** 用 AbortController 取消过期请求，避免旧响应覆盖新数据 */
  let abortController: AbortController | null = null;

  const getRowKeyValue = (record: Recordable): string => {
    const key = unref(rowKey);
    return isFunction(key) ? key(record) : (record[key] as string);
  };

  const buildFetchParams = (opt?: FetchParams): FetchParams => {
    const setting = { ...DEFAULT_FETCH_SETTING, ...fetchSetting };
    const { pageField, sizeField } = setting;

    const mergedParams: FetchParams = {
      ...unref(options.params),
      ...opt,
      fields: unref(options.fields) || [],
    };

    // 展开 searchInfo
    const searchData = mergedParams.searchInfo;
    if (searchData && isPlainObject(searchData)) {
      delete mergedParams.searchInfo;
      Object.assign(mergedParams, searchData);
    }

    if (pagination) {
      const paginationInfo = pagination.getPagination();
      if (paginationInfo && isPlainObject(paginationInfo)) {
        const p = mergedParams as Recordable;
        p[pageField!] = paginationInfo.current || 1;
        p[sizeField!] = paginationInfo.pageSize || 10;
      }
    }

    return mergedParams;
  };

  const processResponse = (raw: any) => {
    const res = getRawData(raw);
    const setting = { ...DEFAULT_FETCH_SETTING, ...fetchSetting };
    const { listField, totalField } = setting;

    let data: Recordable[] = [];
    if (listField && res[listField]) data = res[listField] as Recordable[];
    else if (Array.isArray(res.data)) data = res.data as Recordable[];
    else if (Array.isArray(res.records)) data = res.records as Recordable[];
    else if (Array.isArray(res)) data = res;

    if (isFunction(afterFetch)) data = afterFetch(data);

    let total = 0;
    if (totalField && res[totalField] !== undefined)
      total = res[totalField] as number;
    else if (res.totalCount !== undefined) total = res.totalCount as number;
    else if (res.total !== undefined) total = res.total as number;

    return { list: data, total };
  };

  const applyData = (list: Recordable[], total: number) => {
    dataSourceRef.value = list;
    rawDataSourceRef.value = cloneDeep(list);
    if (pagination && total > 0) pagination.setPagination({ total });
  };

  const fetch = async (opt?: FetchParams): Promise<void> => {
    const apiFn = unref(api);

    // 无 API → 本地数据模式
    if (!isFunction(apiFn)) {
      const sourceData = unref(dataSource);
      if (sourceData) {
        dataSourceRef.value = sourceData;
        rawDataSourceRef.value = sourceData;
      }
      return;
    }

    const currentRequestId = ++requestId;
    // ⭐ 取消上一次未完成的请求
    abortController?.abort();
    abortController = new AbortController();

    loading?.setLoading(true);

    try {
      let fetchParams = buildFetchParams(opt);

      if (isFunction(beforeFetch)) {
        const result = beforeFetch(fetchParams);
        if (result === false) return;
        fetchParams = result;
      }

      // ⭐ 统一按 Promise 处理；apiFn 内部建议走新的 useRequest / http
      const raw = await apiFn(fetchParams);

      if (currentRequestId !== requestId) return;
      const { list, total } = processResponse(raw);
      applyData(list, total);
    } catch (error: any) {
      // ⭐ 用户主动取消不弹提示
      if (error?.name === 'AbortError') return;
      const msg = resolveErrorMessage(error, '数据加载失败');
      console.error('[useDataSource] fetch error:', error);
      message.error(msg);
    } finally {
      if (currentRequestId === requestId) loading?.setLoading(false);
    }
  };

  // ============================================================
  // 本地数据操作（增删改查）
  // ============================================================

  const setTableData = (data: Recordable[]) => {
    dataSourceRef.value = data;
    rawDataSourceRef.value = cloneDeep(data);
  };

  const insertTableDataRecord = (
    record: Recordable | Recordable[],
    index?: number,
  ) => {
    const records = Array.isArray(record) ? record : [record];
    const insertIndex = index ?? dataSourceRef.value.length;
    dataSourceRef.value.splice(insertIndex, 0, ...records);
    rawDataSourceRef.value = cloneDeep(dataSourceRef.value);
  };

  const deleteTableDataRecord = (key: string | string[]) => {
    const keys = Array.isArray(key) ? key : [key];
    const keySet = new Set(keys);
    dataSourceRef.value = dataSourceRef.value.filter(
      (r) => !keySet.has(getRowKeyValue(r)),
    );
    rawDataSourceRef.value = cloneDeep(dataSourceRef.value);
  };

  const updateTableDataRecord = (key: string, record: Recordable) => {
    const index = dataSourceRef.value.findIndex(
      (item) => getRowKeyValue(item) === key,
    );
    if (index !== -1) {
      dataSourceRef.value[index] = { ...dataSourceRef.value[index], ...record };
      rawDataSourceRef.value = cloneDeep(dataSourceRef.value);
    }
  };

  const findTableDataRecord = (key: string): Recordable | undefined =>
    dataSourceRef.value.find((record) => getRowKeyValue(record) === key);

  // ⭐ 取消当前请求
  const abort = () => {
    abortController?.abort();
    abortController = null;
  };

  // ============================================================
  // 监听 dataSource（无 API 模式）
  // ============================================================

  watch(
    () => unref(dataSource),
    (newData) => {
      if (!unref(api) && newData) {
        dataSourceRef.value = newData;
        rawDataSourceRef.value = cloneDeep(newData);
      }
    },
    { immediate: true, deep: true },
  );

  if (immediate) {
    useTimeoutFn(() => {
      void fetch();
    }, 0);
  }

  return {
    dataSourceRef,
    rawDataSourceRef,
    fetch,
    reload: async (opt?: FetchParams) => {
      if (pagination) pagination.setPagination({ current: 1 });
      await fetch({ ...opt, pageNum: 1 });
    },
    setTableData,
    insertTableDataRecord,
    deleteTableDataRecord,
    updateTableDataRecord,
    findTableDataRecord,
    abort,
  };
}

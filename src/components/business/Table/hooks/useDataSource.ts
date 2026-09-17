
import { useTimeoutFn } from "@vueuse/core";
import { message } from "antdv-next";
import { cloneDeep, isFunction, isPlainObject } from "es-toolkit";
import { ref, unref, watch } from "vue";

import type {
  FetchParams,
  FetchSetting,
  Recordable,
  UseDataSourceOptions,
  UseDataSourceReturn,
} from "../types";

import { isAlovaMethod, resolveErrorMessage, unwrap } from "@/composables/useRequest";


// ⭐ 复用 useAppRequest 里的工具

const DEFAULT_FETCH_SETTING: FetchSetting = {
  pageField: "pageNum",
  sizeField: "pageSize",
  listField: "list",
  totalField: "total",
};

export function useDataSource(options: UseDataSourceOptions): UseDataSourceReturn {
  const {
    api,
    dataSource,
    beforeFetch,
    afterFetch,
    fetchSetting = DEFAULT_FETCH_SETTING,
    rowKey = "id",
    immediate = true,
    pagination,
    loading,
  } = options;

  // ============================================================
  // State
  // ============================================================
  const dataSourceRef = ref<Recordable[]>([]);
  const rawDataSourceRef = ref<Recordable[]>([]);

  // ⭐ 保存最后一次请求的 alova Method，用于 abort
  let lastMethod: any = null;

  // ⭐ 防止并发覆盖：记录请求 ID
  let requestId = 0;

  // ============================================================
  // 工具
  // ============================================================

  const getRowKeyValue = (record: Recordable): string => {
    const key = unref(rowKey);
    if (isFunction(key)) return key(record);
    return record[key!] as string;
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

    // 分页参数
    if (pagination) {
      const paginationInfo = pagination.getPagination();
      if (paginationInfo && isPlainObject(paginationInfo)) {
        const recordableParams = mergedParams as Recordable;
        recordableParams[pageField!] = paginationInfo.current || 1;
        recordableParams[sizeField!] = paginationInfo.pageSize || 10;
      }
    }

    return mergedParams;
  };

  /** ⭐ 处理响应：用 unwrap 统一解构 */
  const processResponse = (raw: any) => {
    const res = unwrap(raw);

    const setting = { ...DEFAULT_FETCH_SETTING, ...fetchSetting };
    const { listField, totalField } = setting;

    // 提取 list
    let data: Recordable[] = [];
    if (listField && listField in res) {
      data = res[listField] as Recordable[];
    } else if ("data" in res && Array.isArray(res.data)) {
      data = res.data as Recordable[];
    } else if ("records" in res && Array.isArray(res.records)) {
      data = res.records as Recordable[];
    } else if (Array.isArray(res)) {
      data = res;
    }

    if (afterFetch && isFunction(afterFetch)) {
      data = afterFetch(data);
    }

    // 提取 total
    let total = 0;
    if (totalField && totalField in res) {
      total = res[totalField] as number;
    } else if ("totalCount" in res) {
      total = res.totalCount as number;
    } else if ("total" in res) {
      total = res.total as number;
    }

    return { list: data, total };
  };

  // ============================================================
  // 核心：fetch
  // ============================================================

  const fetch = async (opt?: FetchParams): Promise<void> => {
    const apiFn = unref(api);

    // 无 API：直接用 dataSource（本地数据模式）
    if (!apiFn || !isFunction(apiFn)) {
      const sourceData = unref(dataSource);
      if (sourceData) {
        dataSourceRef.value = sourceData;
        rawDataSourceRef.value = sourceData;
      }
      return;
    }

    // ⭐ 请求 ID：防止并发响应互相覆盖
    const currentRequestId = ++requestId;

    loading?.setLoading(true);

    try {
      // 1) 构建参数
      let fetchParams = buildFetchParams(opt);

      // 2) beforeFetch 钩子
      if (beforeFetch && isFunction(beforeFetch)) {
        const result = beforeFetch(fetchParams);
        if (result === false) return;
        fetchParams = result;
      }

      // 3) 执行请求
      // ⭐ apiFn 可能返回：
      //    - alova Method（有 .send()）
      //    - Promise（已经 .send() 过的）
      const methodOrPromise = apiFn(fetchParams);

      // ⭐ 如果是 alova Method，保存引用 + 调用 .send()
      if (isAlovaMethod(methodOrPromise)) {
        lastMethod = methodOrPromise;
        const raw = await methodOrPromise.send();
        if (currentRequestId !== requestId) return; // 已被更新的请求覆盖，丢弃
        const { list, total } = processResponse(raw);
        applyData(list, total);
      } else {
        // Promise 直接 await
        const raw = await methodOrPromise;
        if (currentRequestId !== requestId) return;
        const { list, total } = processResponse(raw);
        applyData(list, total);
      }
    } catch (error: any) {
      // ⭐ 用统一错误处理
      const msg = resolveErrorMessage(error, "数据加载失败");
      console.error("[useDataSource] fetch error:", error);
      message.error(msg);
      // 保留旧数据，不清空
    } finally {
      // ⭐ 只有当前请求才能关 loading
      if (currentRequestId === requestId) {
        loading?.setLoading(false);
      }
    }
  };

  /** 应用数据 */
  const applyData = (list: Recordable[], total: number) => {
    dataSourceRef.value = list;
    rawDataSourceRef.value = cloneDeep(list);
    if (pagination && total > 0) {
      pagination.setPagination({ total });
    }
  };

  // ============================================================
  // 增删改查（本地操作）
  // ============================================================

  const setTableData = (data: Recordable[]) => {
    dataSourceRef.value = data;
    rawDataSourceRef.value = cloneDeep(data);
  };

  const insertTableDataRecord = (record: Recordable | Recordable[], index?: number) => {
    const records = Array.isArray(record) ? record : [record];
    const insertIndex = index ?? dataSourceRef.value.length;
    dataSourceRef.value.splice(insertIndex, 0, ...records);
    rawDataSourceRef.value = cloneDeep(dataSourceRef.value);
  };

  const deleteTableDataRecord = (key: string | string[]) => {
    const keys = Array.isArray(key) ? key : [key];
    const keySet = new Set(keys);
    dataSourceRef.value = dataSourceRef.value.filter(
      (record) => !keySet.has(getRowKeyValue(record)),
    );
    rawDataSourceRef.value = cloneDeep(dataSourceRef.value);
  };

  const updateTableDataRecord = (key: string, record: Recordable) => {
    const index = dataSourceRef.value.findIndex((item) => getRowKeyValue(item) === key);
    if (index > -1) {
      dataSourceRef.value[index] = { ...dataSourceRef.value[index], ...record };
      rawDataSourceRef.value = cloneDeep(dataSourceRef.value);
    }
  };

  const findTableDataRecord = (key: string): Recordable | undefined => {
    return dataSourceRef.value.find((record) => getRowKeyValue(record) === key);
  };

  // ============================================================
  // ⭐ 暴露 alova 能力
  // ============================================================

  /**
   * 中止最后一次请求
   * 用于：快速切换 tab / 快速连续刷新
   */
  const abort = () => {
    if (lastMethod && isAlovaMethod(lastMethod)) {
      try {
        lastMethod.abort();
      } catch {}
    }
  };

  // ============================================================
  // 监听 dataSource（无 API 模式）
  // ============================================================

  watch(
    () => unref(dataSource),
    (newData) => {
      const apiFn = unref(api);
      if (!apiFn && newData) {
        dataSourceRef.value = newData;
        rawDataSourceRef.value = cloneDeep(newData);
      }
    },
    { immediate: true, deep: true },
  );

  // ============================================================
  // 立即执行
  // ============================================================

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
      if (pagination) {
        pagination.setPagination({ current: 1 });
      }
      await fetch({ ...opt, pageNum: 1 });
    },
    setTableData,
    insertTableDataRecord,
    deleteTableDataRecord,
    updateTableDataRecord,
    findTableDataRecord,
    abort, // ⭐ 新增
  };
}

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

/**
 * 从响应体里取列表数组。
 *
 * 为什么不能只认 `listField`：这个项目里同时存在三套"列表"写法，都是真实来源——
 * 1. mock / Java 系后端：`{ list, total }`，即 `DEFAULT_FETCH_SETTING.listField`；
 * 2. .NET 分页习惯（`views/system/*` 的适配层就返回这个形状）：`{ items, totalCount }`；
 * 3. antd/vben 习惯：`{ data, records }` 或直接一个裸数组。
 * 以前只在第 1 条命中失败后依次试 3，把第 2 条漏掉了 —— 结果所有列表页
 * "分页总数正确、表格永远 No data"：total 走的是独立的兜底链，跟 list 无关。
 * 所以这里按 `listField → items → data → records → 裸数组` 的顺序嗅探，
 * 并且只接受 `Array.isArray` 的候选，避免把 `res.list = null` 当成数据带下去。
 */
function pickList(res: any, listField?: string): Recordable[] {
  if (!res || typeof res !== 'object') return [];
  const candidates = [
    listField ? res[listField] : undefined,
    res.items,
    res.data,
    res.records,
    res,
  ];
  return candidates.find((item) => Array.isArray(item)) ?? [];
}

/** 有些后端把 total 序列化成字符串（"50"），按数字用；其余脏值一律跳过 */
function asCount(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/** 从响应体里取总条数；找不到时退化成"当前页条数"，保证分页不显示 0 */
function pickTotal(
  res: any,
  totalField: string | undefined,
  list: Recordable[],
) {
  if (!res || typeof res !== 'object') return list.length;
  const candidates = [
    totalField ? res[totalField] : undefined,
    res.totalCount,
    res.total,
    // 兜底顺序与 list 保持一致：`data.total` 嵌一层是 mock 的另一种形状
    isPlainObject(res.data) ? res.data.total : undefined,
  ];
  for (const candidate of candidates) {
    const count = asCount(candidate);
    if (count !== undefined) return count;
  }
  // 纯数组响应没有 total 字段，用长度当总数（不分页的接口通常是这种）
  return Array.isArray(res) ? res.length : list.length;
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

  /**
   * 最近一次生效的搜索条件。
   *
   * 为什么要单独存：搜索框提交时走的是 `fetch({ searchInfo })`，条件只活在那一次的
   * 入参里，**没有落进任何状态**。于是之后任何一次不带条件的取数 —— 新增/编辑/删除后
   * 业务页惯常调用的 `reload()`、点分页翻页 —— 都会静默把查询条件丢掉，
   * 列表当场退回"全量第一页"。表现就是用户搜到某一行改完保存，那条记录凭空消失，
   * 只能重新搜一次才找得回来。这里把它记下来，后续 fetch/reload/翻页沿用同一份条件。
   */
  const searchInfoRef = ref<Recordable>({});

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

    // 展开 searchInfo：这一次没显式带条件就沿用上一次的，避免 reload / 翻页把查询条件弄丢
    const searchData = mergedParams.searchInfo ?? searchInfoRef.value;
    delete mergedParams.searchInfo;
    if (searchData && isPlainObject(searchData)) {
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

    let data = pickList(res, listField);

    if (isFunction(afterFetch)) data = afterFetch(data);

    return { list: data, total: pickTotal(res, totalField, data) };
  };

  const applyData = (list: Recordable[], total: number) => {
    dataSourceRef.value = list;
    rawDataSourceRef.value = cloneDeep(list);
    if (pagination && total > 0) pagination.setPagination({ total });
  };

  /**
   * 只更新记忆中的搜索条件，不触发取数。
   *
   * 给"重置表单但不自动查询"（`submitOnReset: false`）这类场景用：界面上的条件已经清空了，
   * 记忆里那份也得跟着清，否则下一次 reload 会带着用户看不见的旧条件查。
   */
  const setSearchInfo = (info?: Recordable) => {
    searchInfoRef.value = info && isPlainObject(info) ? { ...info } : {};
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

    // 显式带了条件就更新记忆（含重置后的空对象），后续 reload / 翻页才不会带着旧条件跑
    if (opt?.searchInfo && isPlainObject(opt.searchInfo)) {
      searchInfoRef.value = { ...opt.searchInfo };
    }

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
    setSearchInfo,
    abort,
  };
}

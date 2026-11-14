/**
 * 报表的取数 + 计算层：把 `ReportSpec` 接成一个响应式的结果集。
 *
 * 分层位置：`composables/`，是 core 纯函数与组件之间唯一的桥。
 * 组件因此可以完全不认识数据源，`ReportViewer` 只负责把这里算好的东西画出来。
 *
 * 三个刻意的分工：
 * - **取数与计算分开**：`reload()` 只管把行拿回来；结果集是 `computed`，
 *   所以改过滤条件、改 DSL（设计器每敲一下）都会立刻重算而**不会重新打接口**。
 * - **同一次刷新里按 `datasetId + params 指纹` 合并**：一张报表常有四五个 widget 共用一个数据集，
 *   不合并就是同一个请求打五遍。
 * - **新一轮刷新会掐掉上一轮的请求**：过滤条件连点两下时，慢的那次必须不能把旧数据盖回来，
 *   靠 `AbortSignal` + 结果写回前核对代次（generation）双保险。
 *
 * 不做的事：不做分页/懒加载、不做增量刷新（脏检查）、不做结果缓存（宿主自己包一层 source）。
 */

import type { Ref } from 'vue';

import type { ReportDataSource } from '../core/datasource';
import type {
  FilterValues,
  QueryResult,
  ReportSpec,
  Row,
  WidgetSpec,
} from '../core/types';

import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';

import { createConfiguredReportSource } from '../config';
import { aggregate, applyReportFilters } from '../core/aggregate';
import { fingerprintParams, requestKey } from '../core/datasource';

export interface UseReportDataOptions {
  /**
   * 过滤器取值。普通对象、Ref、组件转手时的 `toRef(props, 'filters')` 都收；
   * 宿主换一份取值或就地改某个键都会同步进来 —— 单向，本 composable 不回写宿主。
   */
  filters?: FilterValues | Ref<FilterValues | Ref<FilterValues> | undefined>;
  /** 配置变化后是否立刻取数，默认 true */
  immediate?: boolean;
  /** 显式数据源；不传则用 `configureReport()` 注入的运行时数据源 */
  source?: ReportDataSource;
  spec: Ref<ReportSpec> | ReportSpec;
}

/** 单个 widget 的渲染状态。`error` 与 `result` 互斥，`loading` 期间两者都可能是上一轮的值 */
export interface WidgetState {
  error?: string;
  loading: boolean;
  result?: QueryResult;
  /** 参与本次计算的原始行（已过报表级过滤器），导出明细时用 */
  rows: Row[];
}

export interface UseReportDataReturn {
  /** widgetId -> 错误文本；只反映"这块渲染不出来"，取数失败会落到用到该数据集的每个 widget */
  errors: Readonly<Ref<Record<string, string>>>;
  /** 当前过滤值，`ReportFilterBar` 可以直接 v-model 它 */
  filterValues: Ref<FilterValues>;
  /** 任一 widget 在途即为 true */
  loading: Readonly<Ref<boolean>>;
  /** 在途的数据集 id，调试与设计器"重算中"提示用 */
  pendingDatasets: Readonly<Ref<string[]>>;
  queryResult: (widgetId: string) => QueryResult | undefined;
  /** 重新取数（不会重算未变化的结果集，结果集是 computed） */
  reload: () => Promise<void>;
  setFilter: (field: string, value: unknown) => void;
  setFilters: (values: FilterValues) => void;
  states: Readonly<Ref<Record<string, WidgetState>>>;
  widgetData: (widgetId: string) => Row[];
  widgetState: (widgetId: string) => undefined | WidgetState;
}

function asRef<T>(value: Ref<T> | T): Ref<T> {
  return isRefLike(value) ? value : ({ value } as Ref<T>);
}

function isRefLike<T>(value: unknown): value is Ref<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    '__v_isRef' in value
  );
}

export function useReportData(
  options: UseReportDataOptions,
): UseReportDataReturn {
  const specRef = asRef(options.spec);
  /**
   * 过滤取值统一走这一层 getter：`options.filters` 有三种宿主写法 —— 普通对象（模板里
   * `:filters="ref"` 已经被摊成值）、Ref（render 函数或挂载时直接传 ref）、以及组件转手时的
   * `toRef(props, 'filters')`（值本身可能还套着一层 Ref）。逐层拆开，第三种也就不用各写一份。
   * 字面量那种（完全没有响应式）读多少次都是同一个值，watcher 不会凭空触发。
   */
  const filtersInput = computed<FilterValues>(() => {
    let value = options.filters as FilterValues | Ref<FilterValues> | undefined;
    while (isRefLike<FilterValues>(value)) value = value.value;
    return (value ?? {}) as FilterValues;
  });
  const filterValues = ref<FilterValues>({ ...filtersInput.value });
  const datasetRows = shallowRef<Record<string, Row[]>>({});
  const datasetErrors = shallowRef<Record<string, string>>({});
  const pendingDatasets = shallowRef<string[]>([]);
  const loading = ref(false);

  /** 外部把 filters 换成另一个对象、或就地改它的某个键时同步进来；单向流动，避免两边互相回写 */
  watch(
    filtersInput,
    (next) => {
      filterValues.value = { ...next };
    },
    { deep: true },
  );

  const controllers = new Set<AbortController>();
  let generation = 0;
  /** 同一指纹的并发 reload 合并成一次 */
  let inFlight: undefined | { fingerprint: string; promise: Promise<void> };

  function abortActive() {
    for (const controller of controllers) controller.abort();
    controllers.clear();
  }

  function currentSpec(): ReportSpec {
    return (
      specRef.value ?? {
        datasets: [],
        id: '',
        name: '',
        version: 0,
        widgets: [],
      }
    );
  }

  /** 过滤值是取数参数的一部分：换条件就该重新问一次后端 */
  function loadParams(): Record<string, unknown> {
    return { filters: filterValues.value };
  }

  async function fetchDataset(datasetId: string): Promise<Row[]> {
    const spec = currentSpec();
    const dataset = spec.datasets.find((item) => item.id === datasetId);
    if (!dataset) {
      throw new Error(`报表里没有数据集「${datasetId}」`);
    }
    const source = options.source ?? createConfiguredReportSource();
    const controller = new AbortController();
    controllers.add(controller);
    try {
      return await Promise.resolve(
        source.load(dataset, {
          filters: filterValues.value,
          params: loadParams(),
          signal: controller.signal,
        }),
      );
    } finally {
      controllers.delete(controller);
    }
  }

  async function reload(): Promise<void> {
    const spec = currentSpec();
    const ids = [
      ...new Set(
        spec.widgets
          .map((widget) => widget.query?.datasetId)
          .filter((id): id is string => !!id),
      ),
    ];
    const fingerprint = `${ids.toSorted().join(',')}|${fingerprintParams(loadParams())}`;
    if (inFlight && inFlight.fingerprint === fingerprint)
      return inFlight.promise;

    const run = async () => {
      const current = ++generation;
      abortActive();
      loading.value = true;
      pendingDatasets.value = ids;
      // 一次刷新内按指纹合并：多个 widget 用同一个数据集时只发一次
      const jobs = new Map<string, Promise<Row[]>>();
      const errors: Record<string, string> = {};
      const results: Record<string, Row[]> = {};

      await Promise.all(
        ids.map(async (datasetId) => {
          const key = requestKey(datasetId, loadParams());
          let job = jobs.get(key);
          if (!job) {
            job = fetchDataset(datasetId);
            jobs.set(key, job);
          }
          try {
            results[datasetId] = await job;
          } catch (error) {
            if (isAbort(error)) return;
            errors[datasetId] = messageOf(error);
          }
        }),
      );

      // 已经开了新一轮（或组件已卸载）就别把旧数据写回去，否则慢请求会盖掉新结果
      if (current === generation) {
        datasetRows.value = { ...datasetRows.value, ...results };
        datasetErrors.value = errors;
        pendingDatasets.value = [];
        loading.value = false;
      }
      if (inFlight?.fingerprint === fingerprint) inFlight = undefined;
    };

    const promise = run();
    inFlight = { fingerprint, promise };
    return promise;
  }

  /** 结果集：纯派生，改 DSL / 改过滤值都会自动重算，不触发取数 */
  const states = computed<Record<string, WidgetState>>(() => {
    const spec = currentSpec();
    const next: Record<string, WidgetState> = {};
    for (const widget of spec.widgets ?? []) {
      next[widget.id] = stateOf(widget, spec);
    }
    return next;
  });

  function stateOf(widget: WidgetSpec, spec: ReportSpec): WidgetState {
    const query = widget.query;
    // 没有 query 的格子（说明文本、甘特以外的手播内容）不参与取数，但全局刷新期间
    // 它也不该「抢跑」：loading 跟随整张报表的在途状态，刷完再落到自身内容。
    if (!query) return { loading: loading.value, rows: [] };
    const isLoading = pendingDatasets.value.includes(query.datasetId);
    const rows = datasetRows.value[query.datasetId] ?? [];
    const datasetError = datasetErrors.value[query.datasetId];
    if (datasetError) {
      return { error: datasetError, loading: isLoading, rows: [] };
    }
    const dataset = spec.datasets.find((item) => item.id === query.datasetId);
    const filtered = applyReportFilters(rows, spec.filters, filterValues.value);
    try {
      return {
        loading: isLoading,
        result: aggregate(filtered, query, dataset),
        rows: filtered,
      };
    } catch (error) {
      return { error: messageOf(error), loading: isLoading, rows: filtered };
    }
  }

  const errors = computed<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [id, state] of Object.entries(states.value)) {
      if (state.error) out[id] = state.error;
    }
    return out;
  });

  function setFilter(field: string, value: unknown) {
    filterValues.value = { ...filterValues.value, [field]: value };
  }

  function setFilters(values: FilterValues) {
    filterValues.value = { ...values };
  }

  /** 过滤值变化 → 重新取数；结果集的重算由上面的 computed 负责 */
  watch(filterValues, () => void reload());

  onScopeDispose(abortActive);

  if (options.immediate !== false) void reload();

  return {
    errors,
    filterValues,
    loading,
    pendingDatasets,
    queryResult: (widgetId) => states.value[widgetId]?.result,
    reload,
    setFilter,
    setFilters,
    states,
    widgetData: (widgetId) => states.value[widgetId]?.rows ?? [],
    widgetState: (widgetId) => states.value[widgetId],
  };
}

function isAbort(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'AbortError'
  );
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

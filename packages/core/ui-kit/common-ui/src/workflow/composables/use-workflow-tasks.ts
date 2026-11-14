import type { Ref } from 'vue';

import type { WorkflowTask } from '../core/types';

import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';

/**
 * 待办列表的数据层。
 *
 * 为什么不内置取数：本包不许 import 宿主的 `~/api`（会造成 turbo 建不出的环），
 * 所以这里只接一个 `load` 函数 —— 宿主用接口实现它，单测里用内存 store 实现它，
 * 两边的筛选/分页/自动刷新行为都由这一份代码保证，不各写一遍。
 */
export interface UseWorkflowTasksOptions {
  /** 只看某人的任务 */
  assignee?: Ref<string | undefined> | string;
  /** 取数：通常宿主在这里按当前登录人 + 待办状态查库 */
  load: () => Promise<WorkflowTask[]> | WorkflowTask[];
  /** 不传表示不设状态筛选；`OPEN_TASK_STATUSES` 是"还在等人办"的那组 */
  statuses?:
    | Ref<undefined | WorkflowTask['status'][]>
    | WorkflowTask['status'][];
  /** 自动刷新间隔（ms）；0 或不传表示不轮询，由宿主在动作后调 `refresh()` */
  pollMs?: number;
  /** 页长；不传或 <=0 表示不分页，一次性返回全部 */
  pageSize?: number | Ref<number>;
  immediate?: boolean;
  /** 取数失败的副作用（上报、弹提示）；不传则只写 error / errorText */
  onError?: (error: unknown) => void;
}

export interface UseWorkflowTasksReturn {
  /** 最近一次取数的错误；成功后清空。列表加载是后台行为，所以这里记账而不抛出 */
  error: Ref<undefined | unknown>;
  errorText: Ref<string | undefined>;
  /** 当前页数据（已按筛选条件过滤） */
  items: Readonly<Ref<WorkflowTask[]>>;
  loading: Ref<boolean>;
  page: Ref<number>;
  pageSize: Ref<number>;
  /** 未筛选的全量，跨页统计与"我发起的"计数用 */
  rawItems: Readonly<Ref<WorkflowTask[]>>;
  /** 返回本次是否取数成功：失败已经记进 error，不再抛出，避免初始加载/轮询留下未处理的 rejection */
  refresh: () => Promise<boolean>;
  /** 过滤后的总条数 */
  total: Readonly<Ref<number>>;
  totalPages: Readonly<Ref<number>>;
}

/** 待办的通用定义：还没轮到和正等着人办的都算 */
export const OPEN_TASK_STATUSES: WorkflowTask['status'][] = [
  'pending',
  'queued',
];

function unwrap<T>(value: Ref<T> | T | undefined): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'object' && value !== null && 'value' in value)
    return value.value;
  return value;
}

export function useWorkflowTasks(
  options: UseWorkflowTasksOptions,
): UseWorkflowTasksReturn {
  const rawItems = shallowRef<WorkflowTask[]>([]);
  const items = shallowRef<WorkflowTask[]>([]);
  const loading = ref(false);
  const page = ref(1);
  const total = ref(0);
  const totalPages = ref(1);
  const pageSize = ref(unwrap(options.pageSize) ?? 0);
  const error = ref<unknown>();
  const errorText = ref<string>();

  const visible = computed(() => {
    const assignee = unwrap(options.assignee);
    const statuses = unwrap(options.statuses);
    return rawItems.value.filter((task) => {
      if (assignee && task.assignee !== assignee) return false;
      if (statuses && statuses.length > 0 && !statuses.includes(task.status))
        return false;
      return true;
    });
  });

  function applyPage() {
    const list = visible.value;
    const size = pageSize.value;
    total.value = list.length;
    if (!size || size <= 0) {
      totalPages.value = 1;
      page.value = 1;
      items.value = list;
      return;
    }
    totalPages.value = Math.max(1, Math.ceil(list.length / size));
    if (page.value > totalPages.value) page.value = totalPages.value;
    if (page.value < 1) page.value = 1;
    const start = (page.value - 1) * size;
    items.value = list.slice(start, start + size);
  }

  async function refresh(): Promise<boolean> {
    loading.value = true;
    try {
      rawItems.value = [...(await options.load())];
      applyPage();
      error.value = undefined;
      errorText.value = undefined;
      return true;
    } catch (error) {
      // 记账而不抛出：初始加载与轮询都是 `void refresh()`，抛出会变成未处理的 rejection，
      // 表现是控制台里一条没人认领的错误 + 页面永远显示上一次的数据
      error.value = error;
      errorText.value = error instanceof Error ? error.message : String(error);
      options.onError?.(error);
      return false;
    } finally {
      loading.value = false;
    }
  }

  watch([visible, pageSize, page], applyPage, { deep: false });
  watch(pageSize, () => {
    page.value = 1;
  });

  if (options.immediate !== false) void refresh();

  const pollMs = options.pollMs ?? 0;
  if (pollMs > 0) {
    const timer = setInterval(() => void refresh(), pollMs);
    onScopeDispose(() => clearInterval(timer));
  }

  return {
    error,
    errorText,
    items,
    loading,
    page,
    pageSize,
    rawItems,
    refresh,
    total,
    totalPages,
  };
}

import type { Ref } from 'vue';

import type { StartInput, WorkflowEngine } from '../core/engine';
import type { WorkflowInstance, WorkflowTask } from '../core/types';

import { readonly, ref, shallowRef, watch } from 'vue';

/**
 * 把一个流程实例接进响应式世界。
 *
 * 口径：组件与页面**不直接调引擎**，都走这层。理由是引擎是异步命令式的
 * （每个动作返回新的实例对象），而视图要的是"动作之后自动刷新 + 动作期间按钮禁用"。
 * 这里只做这三件事：状态、busy、错误；不做缓存、不做乐观更新 ——
 * 流程推进的正确性只能以引擎返回的实例为准，猜一步就会把待办列表画成假样子。
 */
export interface UseWorkflowOptions {
  /** 引擎实例：由 `createConfiguredWorkflowEngine` 或宿主自己造的都行 */
  engine: WorkflowEngine;
  /** 实例 id；传 undefined 表示还没发起流程，配合 `start()` 用 */
  instanceId?: Ref<string | undefined> | string | undefined;
  /** 出错时的副作用（弹提示、上报）；不传则只写 error */
  onError?: (error: unknown) => void;
}

export interface UseWorkflowReturn {
  addSign: (
    taskId: string,
    input: {
      actor?: string;
      comment?: string;
      mode?: 'after' | 'before';
      users: string[];
    },
  ) => Promise<void>;
  busy: Ref<boolean>;
  cancel: (input?: { actor?: string; comment?: string }) => Promise<void>;
  complete: (
    taskId: string,
    input?: {
      actor?: string;
      comment?: string;
      variables?: Record<string, unknown>;
    },
  ) => Promise<void>;
  error: Ref<undefined | unknown>;
  errorText: Ref<string | undefined>;
  instance: Readonly<Ref<undefined | WorkflowInstance>>;
  refresh: () => Promise<void>;
  reject: (
    taskId: string,
    input?: { actor?: string; comment?: string; to?: string },
  ) => Promise<void>;
  resume: (input?: { actor?: string; comment?: string }) => Promise<void>;
  skip: (
    taskId: string,
    input?: { actor?: string; comment?: string },
  ) => Promise<void>;
  start: (input: StartInput) => Promise<void>;
  suspend: (input?: { actor?: string; comment?: string }) => Promise<void>;
  tasks: Readonly<Ref<WorkflowTask[]>>;
  /** 手动触发一次到钟扫描，返回这次放开了几件事 */
  tick: (at?: number) => Promise<number>;
  transfer: (
    taskId: string,
    input: { actor?: string; comment?: string; to: string },
  ) => Promise<void>;
  withdraw: (input?: { actor?: string; comment?: string }) => Promise<void>;
}

export function useWorkflow(options: UseWorkflowOptions): UseWorkflowReturn {
  const { engine, onError } = options;
  const current = shallowRef<WorkflowInstance>();
  const tasks = shallowRef<WorkflowTask[]>([]);
  const busy = ref(false);
  const error = ref<unknown>();
  const errorText = ref<string>();

  function resolveId(): string | undefined {
    const raw = options.instanceId;
    // 两种用法分工：不传 instanceId = "实例由我在本页发起"，回落到自己 start() 出来的那个；
    // 传了（哪怕是 ref(undefined)）= 以它为准，宿主切列表选中项时这里必须跟着变
    if (raw === undefined) return current.value?.id;
    return typeof raw === 'object' && raw !== null ? raw.value : raw;
  }

  async function refresh() {
    const id = resolveId();
    if (!id) {
      current.value = undefined;
      tasks.value = [];
      return;
    }
    const found = await engine.getInstance(id);
    current.value = found;
    tasks.value = found ? await engine.tasksOf(found.id) : [];
  }

  function fail(caught: unknown): never {
    error.value = caught;
    errorText.value = caught instanceof Error ? caught.message : String(caught);
    onError?.(caught);
    throw caught;
  }

  async function run(action: () => Promise<WorkflowInstance>) {
    busy.value = true;
    error.value = undefined;
    errorText.value = undefined;
    try {
      const result = await action();
      current.value = result;
      tasks.value = await engine.tasksOf(result.id);
      return result;
    } catch (error) {
      fail(error);
    } finally {
      busy.value = false;
    }
  }

  watch(
    () => resolveId(),
    () => {
      void refresh();
    },
    { immediate: true },
  );

  /** 实例级动作的共同前置：得先有实例 id，否则报错而不是静默 no-op */
  function requireId(op: string): string {
    const id = resolveId();
    if (!id) throw new Error(`useWorkflow.${op}：还没有实例 id`);
    return id;
  }

  return {
    addSign: async (taskId, input) => {
      await run(() => engine.addSign(taskId, input));
    },
    busy,
    cancel: async (input) => {
      await run(() => engine.cancel(requireId('cancel'), input));
    },
    complete: async (taskId, input) => {
      await run(() => engine.complete(taskId, input));
    },
    error,
    errorText,
    instance: readonly(current) as Readonly<Ref<undefined | WorkflowInstance>>,
    refresh,
    reject: async (taskId, input) => {
      await run(() => engine.reject(taskId, input));
    },
    resume: async (input) => {
      await run(() => engine.resume(requireId('resume'), input));
    },
    skip: async (taskId, input) => {
      await run(() => engine.skip(taskId, input));
    },
    /**
     * 直接吃引擎的 `StartInput`：设计器改出来的草稿定义要走 `definition` 字段发起，
     * 这一层原来把它收窄掉了，等于把引擎的多版本能力在 composable 处截断。
     */
    start: async (input) => {
      await run(() => engine.start(input));
    },
    suspend: async (input) => {
      await run(() => engine.suspend(requireId('suspend'), input));
    },
    tasks: readonly(tasks) as Readonly<Ref<WorkflowTask[]>>,
    /** 手动到钟：演示超时提醒/自动办理时点一下就行，生产由宿主定时任务调 */
    tick: async (at?: number) => {
      // tick 是跨实例的扫描，返回的是"这次放开了几件事"而不是实例；
      // 所以跑完要主动刷新一次当前实例，不能靠 run 的返回值
      busy.value = true;
      try {
        const fired = await engine.tick(at);
        await refresh();
        return fired;
      } catch (error) {
        fail(error);
      } finally {
        busy.value = false;
      }
    },
    transfer: async (taskId, input) => {
      await run(() => engine.transfer(taskId, input));
    },
    withdraw: async (input) => {
      await run(() => engine.withdraw(requireId('withdraw'), input));
    },
  };
}

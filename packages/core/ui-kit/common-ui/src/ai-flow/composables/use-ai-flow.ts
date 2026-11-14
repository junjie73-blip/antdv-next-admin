import type { ComputedRef, Ref } from 'vue';

import type { AiRunner } from '../core/runner';
import type {
  AiFlowDefinition,
  AiFlowEvent,
  AiRunState,
  AiRunStatus,
  AiUsage,
} from '../core/types';

import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';

/**
 * 把一次 AI 编排运行接进响应式世界。
 *
 * 分层位置：`composables/use-ai-flow.ts`，视图与运行器之间唯一的一层。
 * 组件**不许直接调 runner**：runner 是异步命令式的（动作返回 `AiRunState`），
 * 而视图要的是「动作之后自动刷新 + 动作期间按钮禁用 + 流式 token 自动追加」。
 *
 * 这里只做四件事：状态、busy、事件缓冲、错误。刻意不做的事：
 * 1. **不做乐观更新。** 节点状态只以运行器交回的 `AiRunState` 为准。运行器是就地改同一个 state 对象，
 *    所以「等模型」的时候视图不该自己把节点涂成绿色 —— AI 流程里这类假状态极难复现；
 * 2. 不缓存、不自动重跑：`flow` 变了只清空状态。换图等于换一次实验，自动跑一次是在烧 token；
 * 3. 事件缓冲有上限（`maxEvents`）：流式节点一秒能出几十条 chunk，无限堆会把标签页拖死，
 *    丢的也只是最前面的回看记录，运行日志（`state.logs`）不受影响。
 */

export interface UseAiFlowOptions {
  /** 要跑的流程 */
  flow: AiFlowDefinition;
  /** 出错时的副作用（弹提示、上报）；不传则只写 `error` */
  onError?: (error: unknown) => void;
  /** 事件缓冲上限，超出丢弃最早的；只影响回看，不影响运行 */
  maxEvents?: number;
  /** 运行器：`createAiRunner` 或 `createConfiguredAiRunner` 造的都行 */
  runner: AiRunner;
}

export interface UseAiFlowReturn {
  /** 取消当前运行；没有进行中的运行返回 false */
  cancel: () => boolean;
  error: Ref<unknown>;
  /** 最近的事件（含流式 chunk），运行面板的时间线直接消费 */
  events: Ref<AiFlowEvent[]>;
  /** 日志拼成的纯文本，给「复制给同事看」这种场景 */
  logText: ComputedRef<string>;
  output: ComputedRef<unknown>;
  /** 续跑挂起的运行；不传 runState 就用当前状态（人工确认节点的标准回路） */
  resume: (
    humanInput?: unknown,
    runState?: AiRunState,
  ) => Promise<AiRunState | undefined>;
  /** 起跑。`input` 会成为 `values` 的初始变量，模板里的 `{{ 原始文本 }}` 就来自这里 */
  run: (input?: Record<string, unknown>) => Promise<AiRunState | undefined>;
  runId: ComputedRef<string | undefined>;
  running: Ref<boolean>;
  /** 运行态本身。运行器就地更新同一个对象，所以挂起/收尾两个时刻由 `publish` 主动换引用（见其注释） */
  state: Ref<AiRunState | undefined>;
  status: ComputedRef<AiRunStatus | undefined>;
  usage: ComputedRef<AiUsage>;
}

const EMPTY_USAGE: AiUsage = { completion: 0, prompt: 0, total: 0 };
const DEFAULT_MAX_EVENTS = 200;

export function useAiFlow(options: UseAiFlowOptions): UseAiFlowReturn {
  const { runner } = options;
  const maxEvents = options.maxEvents ?? DEFAULT_MAX_EVENTS;

  const current = shallowRef<AiRunState>();
  const events = ref<AiFlowEvent[]>([]);
  const running = ref(false);
  const error = ref<unknown>();
  /** 事件在回调里追加，数组整份换掉才有响应式；`buffer` 避免每次读 `events.value` 再展开 */
  let buffer: AiFlowEvent[] = [];

  /**
   * 把「就地改过的运行态」重新推给视图。
   *
   * 运行器全程只改同一个 `AiRunState` 对象，动作结束时交回的也是它，而 `current` 是 `shallowRef` ——
   * 同一个引用赋回去，Vue 用 `Object.is` 一比就当没变化，不通知任何人。于是面板里那些
   * 「依赖 `props.state` 引用」的 `computed`（状态徽标、进度、节点行）停在挂起那一刻，
   * 而模板里直接读的 `state.output` 却跟着别的 props 变化刷新了 —— 界面自相矛盾：
   * 输出已经出来，徽标还写着「等待人工确认」。换一次引用（浅拷贝共享 nodes/values，
   * 还是同一份现场）才能同时满足「不做乐观更新」和「动作结束就一定刷新」。
   */
  function publish(): void {
    if (current.value) current.value = { ...current.value };
  }

  /**
   * 「本次运行」的事件归属。
   *
   * 判据不能是「手里这份 state 的 id」：`current.value` 要等动作返回才换，于是**第二次**运行时
   * 它还停在第一次的运行上，第二次的所有事件（含流式 token）都被当成"别的页面的"丢掉 ——
   * 表现是重跑一次后面板字幕不再动，而运行本身跑得好好的。
   * 改成：动作期间到达的第一个 runId 就认领为本次，之后只认它；空闲时到达的一律不认领，
   * 那是共用同一个 runner 的别的页面在跑。
   */
  let runIdOfRun: string | undefined;

  const unsubscribe = runner.on((event) => {
    if (!runIdOfRun && running.value) runIdOfRun = event.runId;
    if (event.runId !== runIdOfRun) return;
    buffer =
      buffer.length >= maxEvents
        ? [...buffer.slice(buffer.length - maxEvents + 1), event]
        : [...buffer, event];
    events.value = buffer;
    // 收尾时事件比返回值先落地、挂起后动作就返回了：这两个时刻运行态已定型，视图要自己刷
    if (event.kind === 'run.awaiting' || event.kind === 'run.finished')
      publish();
    if (event.kind === 'run.finished') runIdOfRun = undefined;
  });
  onScopeDispose(unsubscribe);

  watch(
    () => options.flow,
    () => {
      current.value = undefined;
      buffer = [];
      events.value = [];
      error.value = undefined;
      runIdOfRun = undefined;
    },
  );

  async function run(
    input?: Record<string, unknown>,
  ): Promise<AiRunState | undefined> {
    running.value = true;
    // 新的运行：让第一个到达的事件（`run.started`）决定本次 id
    runIdOfRun = undefined;
    error.value = undefined;
    try {
      // 现读 `options.flow`：宿主传的是 reactive 的选项对象，一开始解构出来的那份
      // 会永远停在第一张图上 —— 于是「换图」时状态被清空、跑的却还是旧图
      current.value = await runner.run(options.flow, input ?? {});
      return current.value;
    } catch (error) {
      error.value = error;
      options.onError?.(error);
      return undefined;
    } finally {
      running.value = false;
    }
  }

  async function resume(
    humanInput?: unknown,
    runState?: AiRunState,
  ): Promise<AiRunState | undefined> {
    const target = runState ?? current.value;
    if (!target) return undefined;
    running.value = true;
    // 续跑知道自己是接着哪一次运行，直接钉住 id，不必等第一个事件来认领
    runIdOfRun = target.id;
    error.value = undefined;
    try {
      current.value = await runner.resume(target, humanInput);
      return current.value;
    } catch (error) {
      error.value = error;
      options.onError?.(error);
      return undefined;
    } finally {
      running.value = false;
    }
  }

  function cancel(): boolean {
    // 第一次运行还没返回时 `current.value` 是空的，只认它就等于「运行中点取消没反应」；
    // 已经认领的 runId 才是当下真正在跑的那一次
    const id = runIdOfRun ?? current.value?.id;
    if (!id) return false;
    // 取消只是同步打个标记，真正停下来要等当前这一波收尾，所以这里不改 state：改了就是猜
    return runner.cancel(id);
  }

  return {
    cancel,
    error,
    events,
    logText: computed(() =>
      (current.value?.logs ?? [])
        .map((log) => `[${log.level}] ${log.message}`)
        .join('\n'),
    ),
    output: computed(() => current.value?.output),
    resume,
    run,
    runId: computed(() => current.value?.id),
    running,
    state: current,
    status: computed(() => current.value?.status),
    usage: computed(() => current.value?.usage ?? EMPTY_USAGE),
  };
}

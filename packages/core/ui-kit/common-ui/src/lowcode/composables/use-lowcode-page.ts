import type { Ref } from 'vue';

import type { LowcodeContext } from '../config';
import type { DataSourceRunState } from '../core/datasource';
import type { ValidationResult } from '../core/dsl';
import type {
  LowcodeEventPayload,
  LowcodeIssue,
  NodeSchema,
  PageSchema,
} from '../core/types';

import {
  getCurrentInstance,
  inject,
  isRef,
  onScopeDispose,
  reactive,
  readonly,
  ref,
  shallowRef,
  watch,
} from 'vue';

import { createLowcodeContext, LOWCODE_CONTEXT_KEY } from '../config';
import {
  applyEventAction,
  parseEventAction,
  setPath as writeScopePath,
} from '../core/binding';
import { findNode, validatePageSchema } from '../core/dsl';

/**
 * 把一份 `PageSchema` 接进响应式世界。
 *
 * 分层位置：`composables/`。它是 Schema 与视图之间唯一的**状态**通道：
 * 渲染器只读 `scope`、只抛事件，取数与写回都在这里发生。
 *
 * 口径：
 * - `scope` 用 `reactive` 而不是 `ref`：低代码的写入是「按路径改一个深层键」，
 *   用 ref 就得整份替换，等于每次输入一个字符都重建一棵对象树；
 * - 装载顺序是 state -> 数据源（依赖由 runner 保证），所以 `params` 里可以引用 `state`；
 * - **不**在这里做请求缓存、路由、权限判断，那些属于宿主；
 * - **不**直接改 schema：改 Schema 是设计器动作（走 `dsl` 的不可变函数），页面只读。
 */

export interface UseLowcodePageOptions {
  /** 装配好的上下文；不传则用 `createLowcodeContext()` 现装一份 */
  context?: LowcodeContext;
  /** scope 的底色，优先级高于 `schema.state`（宿主注入当前用户之类） */
  initialState?: Record<string, unknown>;
  /** `emit:` 动作的落地处；未接线时动作会记成错误而不是静默丢弃 */
  onEvent?: (
    name: string,
    payload: unknown,
    source: LowcodeEventPayload,
  ) => void;
  /** 取数/表达式/动作出错的通知；不传则只写 `errors` */
  onError?: (message: string) => void;
  /**
   * 页面 Schema；传 ref 时**换页**（`id` 变了）会自动重新装载：写 state、重跑数据源。
   *
   * 同一 `id` 下只改 `tree`（设计器的常态）不会重挂，只把新树交给渲染器 ——
   * 否则一次属性编辑就会把用户已经填进 scope 的表单冲回 `schema.state` 的初值。
   * 真要在同一个 id 上换一份新Revision（例如拉到 v2 的同名页），
   * 要么给个新 id，要么自己对每个源调一次 `refreshDataSource(id)`。
   */
  schema: PageSchema | Ref<PageSchema | undefined>;
}

export interface UseLowcodePageReturn {
  /** 当前上下文，组件层可以拿它做 provide */
  context: LowcodeContext;
  /** 各数据源的运行态快照 */
  dataSources: Readonly<Ref<Record<string, DataSourceRunState>>>;
  /** 渲染器抛出的事件入口 */
  dispatch: (event: LowcodeEventPayload) => void;
  /** 这一页累计的运行期问题（含装载报错与事件动作报错）；换页（`id` 变了）时清空 */
  errors: Ref<string[]>;
  /** 页面根节点，直接喂给 `LowCodeRenderer` */
  nodes: Ref<NodeSchema[]>;
  /** 是否还有数据源在飞 */
  loading: Ref<boolean>;
  refreshDataSource: (id: string) => Promise<DataSourceRunState | undefined>;
  runDataSource: (id: string) => Promise<DataSourceRunState | undefined>;
  /** 渲染用的 scope：state + 数据源写回的 path */
  scope: Record<string, unknown>;
  setPath: (path: string, value: unknown) => void;
  /** 保存前跑一次体检；结果不写进 `errors`，由宿主自己决定怎么展示 */
  validate: () => ValidationResult;
}

function currentSchema(
  source: PageSchema | Ref<PageSchema | undefined>,
): PageSchema | undefined {
  // 用 `isRef` 而不是「有没有 value 键」：Schema 是宿主数据，谁都可能带一个 value 字段
  return isRef(source) ? source.value : source;
}

export function useLowcodePage(
  options: UseLowcodePageOptions,
): UseLowcodePageReturn {
  // 直接往 ref 的 value 里 push：ref(数组) 的代理目标就是这个数组本身，
  // 但只有经过代理写入才会触发重渲染，所以这里统一走 `errors.value`
  const errors = ref<string[]>([]);

  const push = (message: string) => {
    if (errors.value.includes(message)) return;
    errors.value.push(message);
    options.onError?.(message);
  };

  const report = (item: LowcodeIssue) => {
    if (item.level !== 'error') return;
    push(`${item.nodeId ? `节点「${item.nodeId}」：` : ''}${item.message}`);
  };

  const context: LowcodeContext =
    options.context ?? createLowcodeContext({ report });

  const scope = reactive<Record<string, unknown>>({});
  const states = shallowRef<Record<string, DataSourceRunState>>({});
  const loading = ref(false);

  const syncStates = () => {
    states.value = context.runner.states();
    loading.value = Object.values(states.value).some((item) => item.loading);
    // `$ds` 是表达式的只读视图：`{{ $ds.orders.error }}` 用来画错误态而不必多接一个 prop
    scope.$ds = states.value;
    // 自动源失败也必须进 `errors`：runner 只把错记在状态里，
    // 少了这一步，页面会一边显示「没有运行期错误」一边把数据区留空 —— 最难查的那种假象。
    // 去重靠 `push`：装载每帧都会重跑状态同步，重复塞会把面板刷爆。
    for (const [id, item] of Object.entries(states.value)) {
      if (item.error && !item.loading) push(`数据源「${id}」：${item.error}`);
    }
  };

  const unsubscribe = context.runner.subscribe(syncStates);
  onScopeDispose(() => {
    unsubscribe();
  });

  function loadIntoScope(page: PageSchema) {
    // 数据源先 define：Schema 换了新 id 要能被 `refresh:id` 找到
    context.runner.define(page.dataSources ?? []);
    const merged = { ...page.state, ...options.initialState };
    for (const [key, value] of Object.entries(merged)) {
      if (value === undefined) delete scope[key];
      else scope[key] = value;
    }
    // initialState 优先于 schema.state，所以这里再补一次宿主侧的键
    for (const [key, value] of Object.entries(options.initialState ?? {})) {
      if (value !== undefined) scope[key] = value;
    }
  }

  // 树用 `shallowRef`：Schema 的改动一律走 `dsl` 的不可变函数换一个新数组，
  // 把整棵树深度响应化既没必要（渲染要读的「值」都在 scope 里）也会让大页面变慢
  const nodes = shallowRef<NodeSchema[]>(
    currentSchema(options.schema)?.tree ?? [],
  );

  async function mount(page: PageSchema) {
    // 换页从空状态起步：runner 的 `load` 对「已成功且没过期」的结果是复用的，
    // 而两页的同名数据源（`id` 常常都是 `list`）根本不是同一份业务数据，
    // 不清缓存就会出现「切到 B 页看到的还是 A 页的数据」。
    // 注意 `reset()` 只清结果、不清定义：`define` 是增量的（全局默认源不能被某页抹掉），
    // 所以 A 页带来的源在 B 页装载时还会再跑一次。要两套页面彻底隔离，宿主给每页各装配一个 context。
    context.runner.reset();
    loadIntoScope(page);
    nodes.value = page.tree;
    await context.runner.loadAll(scope);
    syncStates();
  }

  // 换页判据是 **id**，不是「schema 对象换了」。设计器改一个属性也会产出新的 Schema 对象
  // （`dsl` 全链路不可变），按对象身份就会把整页重挂一遍：数据源全部重发、
  // scope 被 `schema.state` 的初值覆盖 —— 表现就是「在属性面板动一下，用户刚填的表单没了」。
  watch(
    () => currentSchema(options.schema)?.id,
    () => {
      const page = currentSchema(options.schema);
      if (!page) {
        nodes.value = [];
        return;
      }
      // 换页把上一页的运行期问题一起带走：`errors` 是"这一页跑成什么样"的账本，
      // 留着上一页的「数据源「list」：xxx」会让新页面看起来带着先天病，
      // 宿主按它决定能不能保存时就是误判。同 id 只改树（设计器常态）不走这里，账本不动。
      errors.value = [];
      void mount(page);
    },
    { immediate: true },
  );

  // 同一页只换树：这是设计器的常态动作，只需要把新引用交给渲染器，
  // 既不重跑数据源也不重置 scope（`dispatch` 与 `validate` 每次都现读 `schema.tree`，不会读到旧树）。
  watch(
    () => currentSchema(options.schema)?.tree,
    (tree) => {
      nodes.value = tree ?? [];
    },
  );

  const run = async (
    id: string,
    refresh: boolean,
  ): Promise<DataSourceRunState | undefined> => {
    const state = refresh
      ? await context.runner.refresh(id, scope)
      : await context.runner.load(id, scope);
    // 报错由 `syncStates` 统一出口，这里不再单独 push 一份，免得同一条错两个措辞
    syncStates();
    return state;
  };

  return {
    context,
    dataSources: readonly(states) as Readonly<
      Ref<Record<string, DataSourceRunState>>
    >,
    dispatch: (event) => {
      const page = currentSchema(options.schema);
      const node = page ? findNode(page.tree, event.nodeId) : undefined;
      const raw = node?.events?.[event.name];
      if (!node || raw === undefined) return;
      const action = parseEventAction(raw);
      const result = applyEventAction({
        action,
        ctx: context.scopeBase(),
        evaluator: context.evaluator,
        onEmit: (name, payload) => options.onEvent?.(name, payload, event),
        onRefresh: (id) => run(id, true),
        payload: event.payload,
        scope,
      });
      if (result.error)
        push(`节点「${event.nodeId}」的事件「${event.name}」：${result.error}`);
      if (result.changed) syncStates();
    },
    errors,
    loading,
    nodes,
    refreshDataSource: (id) => run(id, true),
    runDataSource: (id) => run(id, false),
    scope,
    setPath: (path, value) => {
      try {
        writeScopePath(scope, path, value);
      } catch (error) {
        push(error instanceof Error ? error.message : String(error));
      }
    },
    validate: () => {
      const page = currentSchema(options.schema);
      return page
        ? validatePageSchema(page, {
            maxDepth: context.maxDepth,
            registry: context.registry,
          })
        : {
            errors: [],
            issues: [],
            valid: true,
            warnings: [],
          };
    },
  };
}

/**
 * 组件层拿 context 的快捷方式：优先级 `参数/prop` -> `provide/inject` -> 现装一份。
 *
 * 「现装一份」只在既没传也没 provide 时发生（单测、宿主脚本直接调），
 * 因此组件永远拿得到东西，但生产页面应该由入口 provide 一次，避免每页各装一套注册表。
 *
 * 入参给函数时是**跟着 prop 走**的：设计器换一套装配（切租户、切物料包）只需要
 * `:context="nextContext"`，不必整棵子树重挂。返回的是逐个 getter 的门面，
 * 读 `context.registry` 的那一刻才去取值，所以取值点仍然在调用方的响应式依赖里。
 * 传死对象时退化成一次装配定终身，行为和旧签名一致。
 */
export function useLowcodeContext(
  provided?: (() => LowcodeContext | undefined) | LowcodeContext,
): LowcodeContext {
  if (provided && typeof provided !== 'function') return provided;
  // `inject()` 在 setup 之外调用会报警告，所以先确认自己在组件实例上下文里
  const injected = getCurrentInstance()
    ? inject(LOWCODE_CONTEXT_KEY, undefined)
    : undefined;
  // 兜底那份只装一次：每次读都 createLowcodeContext() 会让 registry 换身份，
  // 渲染器每帧查物料都在跟一个新对象打交道，宿主的「同一页同一套物料」也就没了
  let builtin: LowcodeContext | undefined;
  const resolve = (): LowcodeContext =>
    (typeof provided === 'function' ? provided() : provided) ??
    injected ??
    (builtin ??= createLowcodeContext());
  // 显式列成员而不用 Proxy：LowcodeContext 加字段时这里会编译报错，
  // 而不是运行时悄悄少一个透传属性（那正是最难查的那类「面板空白但没报错」）
  return {
    get datasourceTimeoutMs() {
      return resolve().datasourceTimeoutMs;
    },
    get evaluator() {
      return resolve().evaluator;
    },
    get maxDepth() {
      return resolve().maxDepth;
    },
    get registry() {
      return resolve().registry;
    },
    get report() {
      return resolve().report;
    },
    get runner() {
      return resolve().runner;
    },
    get scopeBase() {
      return resolve().scopeBase;
    },
  };
}

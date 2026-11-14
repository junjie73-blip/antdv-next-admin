import type { ImLimits } from './core/limits';
import type { ImSeed, ImStore } from './core/store';
import type { ImTransport } from './core/types';
import type { UseImReturn } from './core/use-im';

import { DEFAULT_LIMITS } from './core/limits';
import { createImStore } from './core/store';
import { createMemoryTransport, createSocketTransport } from './core/transport';
import { useIm } from './core/use-im';

/**
 * 宿主注入点。
 *
 * 存在的理由还是那条硬规矩：**子包不许 import 宿主的 `~/api` / `~/stores` / `~/views` / `~/locales`**。
 * 而 IM 需要的宿主能力一样都绕不开 —— 当前登录人是谁、预览地址怎么生成、时间以谁的时钟为准、
 * 附件上限多少。所以这些全部由宿主以闭包函数的形式注进来，包反向调用它们；
 * 反过来 import 会让 turbo 依赖图建不出来（两个包互相声明依赖直接整体失败）。
 *
 * 与 `useIm(options)` 的分工：`useIm` 只认显式 options（单测里没有全局态也能跑），
 * 只有 `createConfiguredIm()` 读这里的运行时配置。
 *
 * 这一层不做什么：不弹提示、不写存储、不注册路由。
 * 尤其**不弹 toast** —— 轻提示属于 `@antdv/popup-ui`，而它不在本包依赖里，
 * 这是刻意的：IM 的失败提示该由宿主决定用哪种通知（会话内红条还是全局 toast），包只发事件。
 */

export type { ImLimits } from './core/limits';
export { DEFAULT_LIMITS } from './core/limits';

/** 附件预览地址生成器：宿主拿到 File/Blob 后自己决定用 blob URL、CDN 还是自定义协议 */
export type ImRuntimeObjectUrl = (source: unknown) => string;

export interface ImRuntimeConfig {
  createObjectUrl: ImRuntimeObjectUrl | undefined;
  limits: ImLimits;
  /** 时钟注入点：撤回窗口与乐观消息时间戳都走它，测试因此完全确定 */
  now: (() => number) | undefined;
  /**
   * 传实例 = 全局共享一条连接（多数应用就一个 IM 长连接）；
   * 传工厂 = 每次 `createConfiguredIm()` 一套（单测、多账号）。
   */
  transport: (() => ImTransport) | ImTransport | undefined;
  /** socket 地址提供者：只配了 `url` 没配 `transport` 时，用它建 socket transport */
  url: (() => string) | undefined;
  /**
   * 当前登录人，由宿主从自己的会话存储里取，包不猜也不兜底。
   * 字符串与函数两种写法都收（与 `useIm` 的 `userId` 同一口径）：宿主那边是个响应式登录态时
   * 给函数，纯配置项时给字符串，别让"读一次就定死了"这件事由调用方去猜。
   */
  userId: (() => string) | string | undefined;
}

const DEFAULT_RUNTIME: ImRuntimeConfig = {
  createObjectUrl: undefined,
  limits: { ...DEFAULT_LIMITS },
  now: undefined,
  transport: undefined,
  url: undefined,
  userId: undefined,
};

let runtime: ImRuntimeConfig = {
  ...DEFAULT_RUNTIME,
  limits: { ...DEFAULT_LIMITS },
};

export function getImRuntime(): ImRuntimeConfig {
  return { ...runtime, limits: { ...runtime.limits } };
}

/**
 * `configureIm` 的入参：`limits` 单独放宽成逐字段可选。
 * 运行时里存的那一份一定是完整的（缺的字段由出厂值兜住），
 * 但宿主当然只写自己要改的那两三档 —— 类型跟着实现走，别逼调用方抄一遍 DEFAULT_LIMITS。
 */
export interface ImRuntimePatch extends Omit<
  Partial<ImRuntimeConfig>,
  'limits'
> {
  limits?: Partial<ImLimits>;
}

/** 增量合并：`limits` 逐字段覆盖，其余整体替换；多次调用是叠加而不是清零 */
export function configureIm(partial: ImRuntimePatch): ImRuntimeConfig {
  runtime = {
    ...runtime,
    ...partial,
    limits: { ...runtime.limits, ...partial.limits },
  };
  return runtime;
}

/** 单测与多实例宿主用它隔离全局态 */
export function resetImRuntime(): void {
  runtime = { ...DEFAULT_RUNTIME, limits: { ...DEFAULT_LIMITS } };
}

export interface CreateConfiguredImOptions {
  /** 传给 store 的初始数据：演示页给一批种子会话，单测给确定夹具 */
  seed?: ImSeed;
  /** 传了就跳过运行时里的 transport，用于"这一次我要一个纯内存实例" */
  transport?: ImTransport;
}

export interface ConfiguredIm {
  im: UseImReturn;
  store: ImStore;
  transport: ImTransport;
}

/**
 * 按运行时配置装一套 IM。
 *
 * 默认落内存 transport —— 示例页、单测、SSR 探针在不配任何东西时也能跑通整条链路；
 * 只有显式 `configureIm({ transport: createSocketTransport({ url }) })`（或只配 `url`）才走真 socket。
 * 「默认不联网」是刻意的：出错形态应该是"消息没发出去"，而不是"连上了不该连的环境"。
 */
export function createConfiguredIm(
  options: CreateConfiguredImOptions = {},
): ConfiguredIm {
  // 三级回落写成一段读起来是"显式 > 运行时实例 > 运行时工厂 > 内存兜底"，
  // 而不是四个嵌套三元：这一处配错的排查成本很高，宁可多写两行
  const fromRuntime =
    typeof runtime.transport === 'function'
      ? runtime.transport()
      : runtime.transport;
  const transport =
    options.transport ??
    fromRuntime ??
    (runtime.url === undefined
      ? // 兜底实现单独命名：出问题时一眼能看出"这里没走 socket"，而不是 transport 配错了
        createMemoryTransport()
      : createSocketTransport({ url: runtime.url }));

  const store = createImStore(options.seed);
  const im = useIm({
    // 运行时限额原样传下去：`useIm` 那边还有第二道判（正文超长、附件超数、撤回窗口），
    // 少了这一行就是"输入区按宿主的口径拦、状态机按出厂口径拦"，两边给出的原因会打架
    limits: runtime.limits,
    now: runtime.now,
    store,
    transport,
    // 原样透传：`useIm` 的 `userId` 同样两种写法都收，这里再包一层函数只会让"什么时候读的登录态"说不清
    userId: runtime.userId ?? '',
  });
  return { im, store, transport };
}

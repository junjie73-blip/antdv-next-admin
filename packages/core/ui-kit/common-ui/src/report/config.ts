/**
 * 全局接线点：宿主把自己的取数通道、配色与图表实现注进来。
 *
 * 存在的理由是本仓库的两条硬规矩：
 * - **子包不许 import 宿主的 `~/api` / `~/stores`**（两个包互相声明依赖会让 turbo 建不出图），
 *   所以网络通道只能以 `fetcher` / `source` 的形式反向注入；
 * - **样式不许出现裸颜色**，所以图表配色不写死在本包，由宿主从 design token 读出来喂 `palette`；
 *   没注入时保持 `undefined`，让 ECharts 走它自己的默认色板。
 *
 * 与 `createRemoteSource()` / `useReportData()` 的分工：那两个都只认显式参数（单测里没有全局态），
 * 只有 `createConfiguredReportSource()` 读这里的运行时配置。
 *
 * 不做的事：不做持久化（刷新后由宿主再配一次，这也是它能在单测里隔离的原因）、
 * 不做多租户作用域（要多套配置就各自显式传 source）。
 */

import type { Component } from 'vue';

import type {
  RemoteFetcher,
  ReportDataSource,
  StaticTable,
} from './core/datasource';

import { markRaw } from 'vue';

import { ECharts } from '../components/charts';
import { createRemoteSource, createStaticSource } from './core/datasource';

export interface ReportRuntimeConfig {
  /** 图表容器默认高度（CSS 长度），交给图表组件而不是 option */
  chartHeight: string;
  /** 栅格默认列数，`ReportViewer` 未传 columns 时用它 */
  columns: number;
  /** 远端取数通道；`source` 缺省时用它现造一个 remote 源 */
  fetcher: RemoteFetcher | undefined;
  /** 图表配色；`undefined` 表示用 ECharts 默认色板 */
  palette: string[] | undefined;
  /** 报表级默认数据源；`useReportData` 未显式传 source 时用它 */
  source: ReportDataSource | undefined;
  /** 图形渲染组件；缺省用 `@antdv/common-ui/charts` 的 ECharts（props：option / height / loading） */
  widgetChart: Component;
}

const DEFAULT_RUNTIME: ReportRuntimeConfig = {
  chartHeight: '300px',
  columns: 12,
  fetcher: undefined,
  palette: undefined,
  source: undefined,
  // 留成可替换的注入点有两个理由：宿主想换渲染实现（SSR 出图、自研 SVG）不必改本包；
  // jsdom 没有 canvas，组件测试会把它换成一个只接 option 的假组件。
  widgetChart: markRaw(ECharts),
};

let runtime: ReportRuntimeConfig = { ...DEFAULT_RUNTIME };

export function getReportRuntime(): ReportRuntimeConfig {
  return { ...DEFAULT_RUNTIME, ...runtime };
}

/**
 * 增量合并，返回合并后的配置；多次调用是叠加而不是替换。
 * 传 `undefined` 表示"这一项不动"，要清空请用 `resetReportRuntime()`。
 */
export function configureReport(
  partial: Partial<ReportRuntimeConfig>,
): ReportRuntimeConfig {
  for (const [key, value] of Object.entries(partial) as [
    keyof ReportRuntimeConfig,
    unknown,
  ][]) {
    if (value !== undefined) runtime = { ...runtime, [key]: value };
  }
  return getReportRuntime();
}

/** 单测与多实例宿主用它隔离全局态 */
export function resetReportRuntime(): void {
  runtime = { ...DEFAULT_RUNTIME };
}

/** 只包 fetcher 时缓存一份，让并发请求的合并索引（coalescer）跨 widget、跨报表共用 */
let remoteCache:
  | undefined
  | { fetcher: RemoteFetcher; source: ReportDataSource };

/**
 * 按运行时配置取数据源。
 *
 * 优先级：显式 `source` > 有 `fetcher` 时现造的 remote 源 > 一个"每次都抛可诊断错误"的占位源。
 * 最后一条是刻意的：没配数据源时报表必须红给用户看，而不是画一张全 0 的空图骗人。
 */
export function createConfiguredReportSource(): ReportDataSource {
  const { fetcher, source } = getReportRuntime();
  if (source) return source;
  if (fetcher) {
    if (!remoteCache || remoteCache.fetcher !== fetcher) {
      remoteCache = { fetcher, source: createRemoteSource({ fetcher }) };
    }
    return remoteCache.source;
  }
  return {
    load(dataset) {
      throw new Error(
        `@antdv/common-ui/report 没有可用的数据源：请在宿主入口调用 configureReport({ source }) 或 configureReport({ fetcher })（本次要取的数据集：${dataset.id}）`,
      );
    },
  };
}

/** 一步把内存表配成默认数据源，示例页与 e2e 常用 */
export function setReportStaticTables(
  tables: Record<string, StaticTable>,
): ReportRuntimeConfig {
  return configureReport({ source: createStaticSource(tables) });
}

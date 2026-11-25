/**
 * 上下文引擎：把「当前路由 + 选中行 + 页面声明的工具」收敛成一份只读快照。
 *
 * 应用层模块，允许依赖 vue-router；但只读取 route.meta.aiContext，不修改路由状态。
 * AI 工具层通过 ToolRuntime.context() 拿到这里的快照，不直接碰 store/router。
 */
import type {
  AiContextSnapshot,
  AiFieldDescriptor,
  AiLinkDescriptor,
} from '@antdv/ai-tools';
import type { RouteLocationNormalizedLoaded } from 'vue-router';

import { useRouteStore } from '@antdv/stores';
import { findMenuByPath } from '@antdv/utils/menu';

/** 路由 meta.aiContext 的声明结构（在页面 defineOptions 或路由表里声明） */
export interface AiContextMeta {
  entity: string;
  title: string;
  description?: string;
  fields?: AiFieldDescriptor[];
  tools?: string[];
  links?: AiLinkDescriptor[];
  /** 快捷 Prompt 按路由生成 */
  prompts?: string[];
}

declare module 'vue-router' {
  interface RouteMeta {
    aiContext?: AiContextMeta;
  }
}

/** 兜底：没有声明 aiContext 的页面也能得到稳定快照 */
const FALLBACK: AiContextMeta = {
  entity: 'page',
  title: '当前页面',
  tools: ['navigate_to'],
  links: [],
  prompts: ['这个页面能做什么？', '总结当前页面的关键数据'],
};

/** 把路由名/路径转成可读标题，避免面板顶部出现「当前页面 · page」这种无效信息 */
function humanizeRoute(route: RouteLocationNormalizedLoaded): string {
  // 路由 meta 由插件与静态路由两处扩充，title 的类型在不同声明下可能是 never；
  // 这里只读展示文本，按 Record 取一次即可，不参与任何类型决策。
  const metaTitle = (route.meta as Record<string, unknown>).title;
  // 路由 name 的类型在插件声明与 @antdv/types 的扩充之间可能收敛成 never，
  // 这里只取展示文本，显式放宽成 unknown 读取即可。
  const raw = String(
    metaTitle ??
      (route.name as unknown) ??
      ((route as { path?: string }).path as unknown) ??
      '',
  );
  const last = raw.split('/').filter(Boolean).pop() ?? raw;
  return (
    last
      .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
      .replace(/[-_]/gu, ' ')
      .trim() || '当前页面'
  );
}

/**
 * 没声明 aiContext 的页面不再一律显示「当前页面 / page」：
 * 先从后端菜单树按 path/name 反查真实菜单名（含 hidden 页），再看静态路由的 meta.title，
 * 最后才把路由名拆成可读文本。菜单未加载完时也不会抛错。
 */
export function metaOf(route: RouteLocationNormalizedLoaded): AiContextMeta {
  const declared = route.meta.aiContext as AiContextMeta | undefined;
  if (declared) return declared;

  let menuTitle = '';
  let menuEntity = '';
  try {
    const menus = useRouteStore().menus;
    const menu =
      findMenuByPath(menus, route.path, { includeHidden: true }) ??
      findMenuByPath(menus, String(route.name ?? ''), { includeHidden: true });
    menuTitle = menu?.title ?? '';
    menuEntity = menu?.name ?? '';
  } catch {
    // Pinia 还没装好的极早期调用：退回静态信息即可
  }

  const title = menuTitle || humanizeRoute(route);
  return {
    ...FALLBACK,
    title,
    entity: menuEntity || String(route.name ?? 'page'),
    prompts: [`分析当前${title}的关键指标`, `列出${title}里最需要关注的 3 项`, '这个页面能做什么？'],
  };
}

/** 选中行由页面写入，key 用 route.name，避免跨页串线 */
const selectionStore = new Map<string, Record<string, unknown>[]>();

export function setPageSelection(routeName: string, rows: Record<string, unknown>[]) {
  selectionStore.set(routeName, rows);
}

export function clearPageSelection(routeName: string) {
  selectionStore.delete(routeName);
}

export function snapshotOf(route: RouteLocationNormalizedLoaded): AiContextSnapshot {
  const meta = metaOf(route);
  const routeName = String(route.name ?? (route as { path: string }).path);
  return {
    route: routeName,
    title: meta.title,
    entity: meta.entity,
    fields: meta.fields,
    tools: meta.tools,
    links: meta.links,
    selectedRows: selectionStore.get(routeName) ?? [],
    filters: { ...route.query } as Record<string, unknown>,
  };
}

/** 按路由生成快捷 Prompt：页面声明优先，否则按实体给一组通用问题 */
export function promptsOf(route: RouteLocationNormalizedLoaded): string[] {
  const meta = metaOf(route);
  if (meta.prompts?.length) return meta.prompts.slice(0, 3);
  return [
    `分析当前${meta.title}的关键指标`,
    `列出${meta.title}里最需要关注的 3 项`,
    '把当前页面的状态生成图表',
  ];
}

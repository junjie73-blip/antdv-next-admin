import type { MenuConfig } from '@antdv/types';

import type { ComputedRef } from 'vue';

import { computed } from 'vue';

import { findMenuChain, menuKeyOf, normalizeMenuPath } from '@antdv/shared/menu';

/**
 * 面包屑。
 *
 * 数据来源有两个，优先级在这一轮被调反了方向，原因是可复现的：
 *
 * 1. **菜单树祖先链（首选）**——面包屑回答的是"我在导航的哪一格"，
 *    那么它的层级、名称、图标就必须和侧栏/顶栏是同一份数据。
 *    老版本先读路由 `meta.title`，于是两种错位同时出现：
 *    - 文件约定路由只有**叶子**声明了 `meta.title`，父级布局记录没有，
 *      结果层级被砍到只剩一级；再叠加"只有一级就不显示"的偏好，
 *      登录落到的首页整条面包屑直接消失（表现是"第一次进页面面包屑没加载出来"）。
 *    - 叶子自己写的标题和菜单不一致（菜单「分析面板」/ 页面写「系统分析」），
 *      面包屑和侧栏各说各话，图标更是靠渲染侧硬猜。
 * 2. **路由 `matched` 上的 `meta.title`（兜底）**——菜单里收录不到的页面
 *    仍然要有位置感：登录/重定向/异常页、按 id 打开的详情页，
 *    以及菜单数据还没回来的那一帧。
 */

export interface BreadcrumbRouteLike {
  matched?: Array<{
    meta?: { icon?: unknown, title?: unknown };
    path?: string;
    redirect?: unknown;
  }>;
  name?: string | symbol;
  path: string;
}

export interface BreadcrumbItem {
  icon?: string;
  path: string;
  title: string;
}

export interface BreadcrumbDeps {
  /** 已补全 path 的菜单树；没有菜单（如未登录页）时传 () => [] */
  menus: () => MenuConfig[];
  route: () => BreadcrumbRouteLike;
}

function toText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** 菜单节点 → 面包屑项（没有名字的节点不占一格） */
function chainToItems(chain: MenuConfig[]): BreadcrumbItem[] {
  return chain
    .filter((menu) => !!menu.title)
    .map((menu) => ({
      icon: menu.icon,
      path: menu.path,
      title: menu.title,
    }));
}

/**
 * 从菜单树取当前路由所在祖先链（含自身）；`menuKeyOf` 保证与导航用同一套 key。
 *
 * 这里必须带上隐藏项：面包屑回答的是"我站在哪"，而隐藏页（部门管理、账户设置）
 * 本来就是可以直达的页面，按默认语义搜不到就会显示成一片空白。
 *
 * name 先于 path：文件约定路由的 name 由框架生成（`/system/user/`），
 * 与业务菜单的 name（`SystemUser`）不同源，这类页面自然落到 path 那一条；
 * 而显式声明过 name 的页面（`Analysis`）两边同源，按 name 命中最稳。
 * path 比对先归一化，尾斜杠与缺失的前导斜杠都不该让一级面包屑掉队。
 */
function chainFromMenus(
  menus: MenuConfig[],
  route: BreadcrumbRouteLike,
): BreadcrumbItem[] {
  const options = { includeHidden: true };
  const byName =
    route.name === undefined || route.name === null
      ? []
      : findMenuChain(
          menus,
          (menu) => !!menu.name && menu.name === route.name,
          [],
          options,
        );
  const target = normalizeMenuPath(route.path);
  const byPath = findMenuChain(
    menus,
    (menu) => !!menu.path && normalizeMenuPath(menu.path) === target,
    [],
    options,
  );
  return chainToItems(byName.length > 0 ? byName : byPath);
}

/** 路由 `matched` → 面包屑项（菜单查不到时的兜底来源） */
function chainFromRoute(route: BreadcrumbRouteLike): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [];
  for (const record of route.matched ?? []) {
    const title = toText(record.meta?.title);
    // 没有标题的层级（布局节点）不占一格，否则面包屑会出现空片段
    if (!title) continue;
    items.push({
      icon: toText(record.meta?.icon),
      path: record.path ?? route.path,
      title,
    });
  }
  return items;
}

/**
 * 菜单链优先，路由 meta 兜底。
 *
 * 两条来源不能"合并"：菜单链给出的是导航层级，meta 给出的是页面自己声明的标题，
 * 拼在一起就是同一格两个名字。谁都不到就返回空数组，渲染侧按"没内容"处理。
 */
export function createBreadcrumbSource(
  deps: BreadcrumbDeps,
): ComputedRef<BreadcrumbItem[]> {
  return computed<BreadcrumbItem[]>(() => {
    const route = deps.route();
    const fromMenus = chainFromMenus(deps.menus(), route);
    if (fromMenus.length > 0) return fromMenus;
    return chainFromRoute(route);
  });
}

/** 面包屑是否需要渲染：只有一级且用户设置了"单级隐藏"时不显示 */
export function shouldShowBreadcrumb(
  items: BreadcrumbItem[],
  options: { enabled?: boolean; hideWhenOnlyOne?: boolean } = {},
): boolean {
  const { enabled = true, hideWhenOnlyOne = false } = options;
  if (!enabled || items.length === 0) return false;
  return !(hideWhenOnlyOne && items.length === 1);
}

/**
 * 当前所在一级菜单的 key：双列 / 混合形态用它决定图标栏高亮哪一项。
 *
 * 与 `createMenuTreeSource` 里的 `activeTopMenu` 同语义 —— 链要穿得过隐藏父级，
 * 但高亮只能落在真的渲染得出来的那一级上。
 */
export function activeTopMenuKey(menus: MenuConfig[], path: string) {
  const chain = findMenuChain(
    menus,
    (menu) => menu.path === path,
    [],
    { includeHidden: true },
  );
  const top = chain.find((menu) => !menu.hidden);
  return top ? menuKeyOf(top) : undefined;
}

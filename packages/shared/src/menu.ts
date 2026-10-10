import type { MenuConfig, MenuKey } from '@antdv/types';
import type { MenuProps } from 'antdv-next';

import type { Router } from 'vue-router';

import { h } from 'vue';

import { Icon } from '@iconify/vue';
import { Badge } from 'antdv-next';

type AntdMenuItem = NonNullable<MenuProps['items']>[number];

/* ============================================================
 * key 体系
 *
 * 后端菜单里绝大多数节点只有 `name`（= 路由 name），没有 `path`。
 * 旧实现用 `menu.path` 当 antd Menu 的 key，于是多个一级菜单的 key 都是
 * `undefined` —— 选中任意一项时它们一起高亮，混合布局也取不到二级子菜单。
 *
 * 现在横向一级菜单、侧边二级菜单、标签页共用同一个 key：
 *   key = name ?? 补全后的 path ?? title
 * 并且 `path` 由路由表反查补全（`attachMenuPaths`），补全后再参与回退。
 * ============================================================ */

/** 菜单/标签页统一 key */
export function menuKeyOf(menu: MenuConfig): MenuKey {
  return menu.name ?? menu.path ?? menu.title;
}

/** 是否叶子节点（没有可见子节点） */
export function isLeafMenu(menu: MenuConfig): boolean {
  return visibleMenus(menu.children).length === 0;
}

/** 过滤隐藏节点，保持原始顺序 */
export function visibleMenus(list?: MenuConfig[]): MenuConfig[] {
  return (list ?? []).filter((m) => m && !m.hidden);
}

/** 深度优先遍历，返回祖先链（含自身）；找不到返回 [] */
export function findMenuChain(
  list: MenuConfig[] | undefined,
  predicate: (menu: MenuConfig) => boolean,
  parents: MenuConfig[] = [],
): MenuConfig[] {
  for (const menu of visibleMenus(list)) {
    const chain = [...parents, menu];
    if (predicate(menu)) return chain;

    const found = findMenuChain(menu.children, predicate, chain);
    if (found.length > 0) return found;
  }
  return [];
}

export function findMenuByKey(
  list: MenuConfig[],
  key?: MenuKey,
): MenuConfig | undefined {
  if (!key) return undefined;
  return findMenuChain(list, (m) => menuKeyOf(m) === key).pop();
}

/** 按 name 查（菜单 name 与路由 name 同源） */
export function findMenuByName(
  list: MenuConfig[],
  name?: string,
): MenuConfig | undefined {
  if (!name) return undefined;
  return findMenuChain(list, (m) => m.name === name).pop();
}

/** 按完整 path 查 */
export function findMenuByPath(
  list: MenuConfig[],
  path?: string,
): MenuConfig | undefined {
  if (!path) return undefined;
  return findMenuChain(list, (m) => m.path === path).pop();
}

/**
 * 当前路由属于哪个一级菜单 —— 混合布局的选中态与二级菜单都由此推导，
 * 不再写死 `/system`。
 */
export function findTopLevelMenu(
  list: MenuConfig[],
  matcher: (menu: MenuConfig) => boolean,
): MenuConfig | undefined {
  for (const menu of visibleMenus(list)) {
    if (matcher(menu)) return menu;
    if (findMenuChain(menu.children, matcher).length > 0) return menu;
  }
  return undefined;
}

/** 第一个可见叶子（用于一级目录点击后跳转、以及固定首页标签） */
export function firstLeafMenu(menu?: MenuConfig): MenuConfig | undefined {
  if (!menu) return undefined;
  if (isLeafMenu(menu)) return menu;
  const [first] = visibleMenus(menu.children);
  return firstLeafMenu(first);
}

/** 全部叶子节点，顺序与菜单一致 */
export function flattenLeafMenus(list: MenuConfig[]): MenuConfig[] {
  const out: MenuConfig[] = [];
  const walk = (nodes: MenuConfig[]) => {
    for (const node of visibleMenus(nodes)) {
      if (isLeafMenu(node)) out.push(node);
      walk(node.children ?? []);
    }
  };
  walk(list);
  return out;
}

/**
 * 用路由表补全缺失的 `path`。
 *
 * 后端菜单只给 name，而 path 要用于：外链判断、面包屑点击、标签页刷新、
 * 路由反查一级菜单。这里在渲染层补全而不是写回 store，避免 store 依赖 router
 * 造成循环引用（router 的守卫会 import store）。
 */
export function attachMenuPaths(
  list: MenuConfig[],
  router: Router,
): MenuConfig[] {
  return visibleMenus(list).map((menu) => {
    const next: MenuConfig = { ...menu };

    if (!next.path && next.name && router.hasRoute(next.name)) {
      // 路由表用了 `RouteRecordRaw` 的字面量联合类型，name 是宽 string，需要断言
      next.path = router.resolve({ name: next.name } as never).path;
    }
    if (next.children?.length)
      next.children = attachMenuPaths(next.children, router);
    return next;
  });
}

/* ============================================================
 * antd Menu items 构造
 * ============================================================ */

function renderExternalLabel(title: string, href: string) {
  return h(
    'a',
    {
      href,
      target: '_blank',
      rel: 'noopener noreferrer',
      onClick: (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(href, '_blank', 'noopener,noreferrer');
      },
    },
    title,
  );
}

/** 构造菜单 label：标题 + Badge + 右侧 extra */
function renderLabel(m: MenuConfig) {
  const labelText =
    m.isExternal && m.path ? renderExternalLabel(m.title, m.path) : m.title;

  // 没有 badge 也没有 extra → 直接返回纯文本，避免多余 DOM
  if (!m.badge && !m.extra) return labelText;

  return h(
    'span',
    {
      class:
        'menu-label-wrapper flex w-full min-w-0 items-center justify-between gap-2',
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        width: '100%',
        minWidth: 0,
      },
    },
    [
      // 左侧：标题 + Badge
      h(
        'span',
        {
          style: {
            display: 'flex min-w-0 flex-1 items-center gap-1.5',
            alignItems: 'center',
            gap: '6px',
            minWidth: 0,
            flex: 1,
            overflow: 'hidden',
          },
        },
        [
          h(
            'span',
            {
              class: 'menu-label-text truncate',
              style: {
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              },
            },
            [labelText],
          ),
          m.badge ? renderBadge(m.badge) : null,
        ],
      ),
      // 右侧：extra
      m.extra
        ? h(
            'span',
            {
              class:
                'menu-extra shrink-0 text-[11px] text-slate-400 dark:text-slate-500',
              style: {
                flexShrink: 0,
                fontSize: '11px',
              },
            },
            m.extra,
          )
        : null,
    ],
  );
}

function renderBadge(badge: NonNullable<MenuConfig['badge']>) {
  return h(Badge, {
    count: badge.dot ? undefined : badge.text,
    dot: badge.dot,
    status: badge.status,
    overflowCount: badge.overflowCount ?? 99,
    size: 'small',
    offset: [2, -2],
  });
}

export interface BuildMenuItemsOptions {
  /**
   * 只保留指定层级的子树深度：混合布局的一级导航传 1（目录不展开子项，
   * 子项交给侧边栏），水平布局传 Infinity（二级用浮层）。
   */
  maxDepth?: number;
  /** 是否渲染子节点 */
  withChildren?: boolean;
}

export function buildMenuItems(
  menus: MenuConfig[],
  options: BuildMenuItemsOptions = {},
): AntdMenuItem[] {
  const { maxDepth = Infinity, withChildren = true } = options;

  const walk = (list: MenuConfig[], depth: number): AntdMenuItem[] =>
    visibleMenus(list).map((m) => {
      const item: Record<string, unknown> = {
        key: menuKeyOf(m),
        label: renderLabel(m),
        disabled: m.disabled,
      };

      // 闭包内属性窄化会失效，先把 icon 取成局部常量
      const icon = m.icon;
      if (icon) item.icon = () => h(Icon, { class: 'text-lg', icon });

      const children =
        withChildren && depth < maxDepth ? m.children : undefined;
      if (children?.length) item.children = walk(children, depth + 1);
      return item as AntdMenuItem;
    });

  return walk(menus, 1);
}

/** 收集所有可展开父级 key（用于 openKeys 初始化与「展开全部/收起全部」） */
export function collectSubmenuKeys(menus: MenuConfig[]): MenuKey[] {
  const out: MenuKey[] = [];
  const walk = (list: MenuConfig[]) => {
    for (const menu of visibleMenus(list)) {
      if (!isLeafMenu(menu)) out.push(menuKeyOf(menu));
      walk(menu.children ?? []);
    }
  };
  walk(menus);
  return out;
}

/** 某 key 对应的祖先 key 链（不含自身），用于展开定位 */
export function findAncestorKeys(
  menus: MenuConfig[],
  key?: MenuKey,
): MenuKey[] {
  if (!key) return [];
  const chain = findMenuChain(menus, (m) => menuKeyOf(m) === key);
  return chain.slice(0, -1).map((m) => menuKeyOf(m));
}

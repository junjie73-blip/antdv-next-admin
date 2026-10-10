import type { MenuConfig, MenuKey } from '@antdv/types';
import type { MenuProps } from 'antdv-next';

import type { RouteRecordRaw } from 'vue-router';

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

/**
 * 菜单/标签页统一 key。
 *
 * 必须用真值判断而不是 `??`：后端目录节点的 `path` 是空串（不是 undefined），
 * `name ?? path ?? title` 会把它当成合法 key，于是所有目录的 key 都是 `''`，
 * 选中态依旧会「点一个亮一串」。
 */
export function menuKeyOf(menu: MenuConfig): MenuKey {
  if (menu.name) return menu.name;
  if (menu.path) return menu.path;
  return menu.title;
}

/** 是否叶子节点（没有可见子节点） */
export function isLeafMenu(menu: MenuConfig): boolean {
  return visibleMenus(menu.children).length === 0;
}

/**
 * 过滤隐藏节点，保持原始顺序
 *
 * 「隐藏」只表示**不在导航里出现**，不代表这个页面没权限 ——
 * 所以隐藏节点会一路留在菜单树里，供权限、标签页标题、面包屑反查使用；
 * 只有渲染导航（`buildMenuItems`）和"挑一个能点的项"（`firstLeafMenu`）才把它们剔掉。
 * 需要连隐藏一起搜的地方显式传 `includeHidden`。
 */
export function visibleMenus(list?: MenuConfig[]): MenuConfig[] {
  return (list ?? []).filter((m) => m && !m.hidden);
}

/**
 * 递归版：把"该渲染的那棵树"整体剔干净。
 *
 * `visibleMenus` 只处理一层，适合"父级已经确定、只要拿它的可见孩子"的出口
 * （`activeTopChildren` 那类）；而侧边整棵树直出的形态（垂直布局）必须逐层剔，
 * 否则隐藏页会顺着 `source.menus` 这棵全量树漏进导航。
 */
export function visibleMenuTree(list?: MenuConfig[]): MenuConfig[] {
  return visibleMenus(list).map((menu) =>
    menu.children?.length
      ? { ...menu, children: visibleMenuTree(menu.children) }
      : menu,
  );
}

/**
 * 框架级菜单/路由 name —— 不来自业务菜单，也不该被导航裁剪动到。
 *
 * 存在这份名单的原因很具体：`apps/web/src/router/index.ts` 在启动时就把 views 下
 * 每个 .vue 注册成了路由，而"按菜单裁剪"要拿路由表和菜单树比对。
 * 登录页、注册页、`/redirect/*` 中转页、三张异常页、通配兜底这些都不在菜单里，
 * 不加豁免就会被一起裁掉 —— 最坏的是布局壳 `Root`，它一没，整站白屏。
 *
 * 名单按**实际生成的 name** 写：文件约定路由给 `/error/404` 生成的是 `Error404`，
 * 不是小写连字符的 `error-404`；光按 name 判还会因为框架改名而漏，
 * 所以另外按 path 兜一层（`isBuiltinMenuPath`）。
 */
const BUILT_IN_MENU_NAMES = new Set([
  'CatchAll',
  'Error403',
  'Error404',
  'Error503',
  'Exception',
  'Forbidden',
  'Home',
  'InternalServerError',
  'NotFound',
  'Redirect',
  'Register',
  'Root',
  'Unauthorized',
]);

/** 内置异常页的 path 前缀：name 由框架生成，不保证和这里一字不差，所以按 path 再兜一层 */
const BUILT_IN_MENU_PATHS = new Set([
  '/error/403',
  '/error/404',
  '/error/503',
  '/login',
  '/logout',
  '/register',
]);

export function isBuiltinMenuName(name?: string): boolean {
  return !!name && BUILT_IN_MENU_NAMES.has(name);
}

export function isBuiltinMenuPath(path?: string): boolean {
  if (!path) return false;
  return BUILT_IN_MENU_PATHS.has(normalizeMenuPath(path));
}

/**
 * 把菜单树摊成两张查找表，供"这条路由该不该注册"判定。
 *
 * name 和 path 都要收：业务菜单写的是 `SystemUser`，文件约定路由生成的
 * name 是 `/system-user-` 这种，两边对不上；只有 path 能把两者对上。
 * 外链的 path 是真外链（`https://…`），本站路由永远匹配不上，天然被排除。
 */
export function collectMenuKeys(menus: MenuConfig[]): {
  byName: Set<string>;
  byPath: Set<string>;
} {
  const byName = new Set<string>();
  const byPath = new Set<string>();
  const walk = (list: MenuConfig[]) => {
    for (const menu of list) {
      if (!menu) continue;
      if (menu.name) byName.add(menu.name);
      const path = normalizeMenuPath(menu.path);
      if (path && !menu.isExternal) byPath.add(path);
      if (menu.children?.length) walk(menu.children);
    }
  };
  walk(menus);
  return { byName, byPath };
}

/** 搜索时是否把隐藏节点也纳入候选 */
export interface MenuSearchOptions {
  includeHidden?: boolean;
}

/** 遍历入口：默认剔掉隐藏节点，`includeHidden` 时只做基础的空值过滤 */
function walkableMenus(list: MenuConfig[] | undefined, includeHidden?: boolean) {
  if (includeHidden) return (list ?? []).filter((m) => !!m);
  return visibleMenus(list);
}

/** 深度优先遍历，返回祖先链（含自身）；找不到返回 [] */
export function findMenuChain(
  list: MenuConfig[] | undefined,
  predicate: (menu: MenuConfig) => boolean,
  parents: MenuConfig[] = [],
  options: MenuSearchOptions = {},
): MenuConfig[] {
  for (const menu of walkableMenus(list, options.includeHidden)) {
    const chain = [...parents, menu];
    if (predicate(menu)) return chain;

    const found = findMenuChain(menu.children, predicate, chain, options);
    if (found.length > 0) return found;
  }
  return [];
}

export function findMenuByKey(
  list: MenuConfig[],
  key?: MenuKey,
  options?: MenuSearchOptions,
): MenuConfig | undefined {
  if (!key) return undefined;
  return findMenuChain(list, (m) => menuKeyOf(m) === key, [], options).pop();
}

/** 按 name 查（菜单 name 与路由 name 同源） */
export function findMenuByName(
  list: MenuConfig[],
  name?: string,
  options?: MenuSearchOptions,
): MenuConfig | undefined {
  if (!name) return undefined;
  return findMenuChain(list, (m) => m.name === name, [], options).pop();
}

/**
 * 按完整 path 查（两侧都归一化，忽略结尾斜杠差异）。
 *
 * 默认只看可见项（菜单联动、选中态用这个语义）；
 * 标签页/权限这类"用户已经站在这个页面上"的场景要传 `includeHidden`，
 * 否则隐藏页面查不到菜单，标题只能退回路径。
 */
export function findMenuByPath(
  list: MenuConfig[],
  path?: string,
  options?: MenuSearchOptions,
): MenuConfig | undefined {
  const target = normalizeMenuPath(path);
  if (!target) return undefined;
  return findMenuChain(
    list,
    (m) => !!m.path && normalizeMenuPath(m.path) === target,
    [],
    options,
  ).pop();
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
  if (!menu || menu.hidden) return undefined;
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
 *
 * 默认顺手剔掉隐藏节点（渲染侧就用这个默认值）；store 里要留全量树做权限判断时
 * 传 `{ includeHidden: true }`，隐藏页面才有正确的 path 参与授权与标签页反查。
 */
export function attachMenuPaths(
  list: MenuConfig[],
  router: MenuPathRouter,
  options: MenuSearchOptions = {},
): MenuConfig[] {
  return resolveMenuTree(list, buildRouteIndex(router), '', options);
}

/**
 * 递归补全：`parentPath` 是本层已知的父级绝对路径，
 * 用来把后端写成的相对片段（`user`）拼成可导航的完整路径。
 *
 * 优先级（从"后端说了算"到"前端兜底"）：
 * 1. 绝对 path —— 后端给的就是契约，直接采用（外链也走这条）；
 * 2. 路由表里确实存在的拼接结果（`/system` + `user`）；
 * 3. name 反查路由表；
 * 4. 末级路径段在路由表里唯一命中（父级没给 path 时的兜底）；
 * 5. 原样拼出来的值 —— 宁可留一个不完美但稳定的 path，也不留空，
 *    否则 key 会退化到 title，选中态又变成"点一个亮一串"。
 */
function resolveMenuTree(
  list: MenuConfig[],
  index: RouteIndex,
  parentPath: string,
  options: MenuSearchOptions = {},
): MenuConfig[] {
  return walkableMenus(list, options.includeHidden).map((menu) => {
    const next: MenuConfig = { ...menu };
    const raw = menu.path ?? '';
    const isAbsolute = !!raw && (ABSOLUTE_URL.test(raw) || raw.startsWith('/'));
    const joined = raw ? joinMenuPath(parentPath, raw) : '';

    let resolved: string | undefined;
    if (isAbsolute) {
      resolved = joined;
    } else if (joined && index.known(joined)) {
      resolved = joined;
    } else if (menu.name) {
      resolved = index.pathOfName(menu.name);
    }
    if (!resolved && joined) {
      resolved = guessPathBySegment(index, joined, parentPath);
    }

    next.path = resolved ?? joined;

    if (menu.children?.length) {
      next.children = resolveMenuTree(
        menu.children,
        index,
        next.path || parentPath,
        options,
      );
    }
    return next;
  });
}

function guessPathBySegment(
  index: RouteIndex,
  candidate: string,
  parentPath: string,
): string | undefined {
  const segment = candidate.split('/').filter(Boolean).pop();
  if (!segment) return undefined;
  const hits = index.pathsBySegment(segment);
  if (hits.length === 1) return hits[0];
  if (hits.length > 1 && parentPath) {
    const underParent = hits.filter(
      (path) => path === parentPath || path.startsWith(`${parentPath}/`),
    );
    if (underParent.length === 1) return underParent[0];
  }
  return undefined;
}

/* ============================================================
 * path 归一化与路由表索引
 *
 * 文件约定式路由（unplugin-vue-router）会把目录页写成 `/system/user/`，
 * 而 vue-router 解析出来的记录 path 没有结尾斜杠；后端菜单又可能只给
 * 一个相对片段。三种写法必须收敛成同一个 key，否则选中态、面包屑、
 * 标签页与权限判断会各说各话。
 * ============================================================ */

/** 外链（带协议或协议相对）不参与路径归一化，否则 https://x 会被拼成 /https://x */
const ABSOLUTE_URL = /^(?:[a-z][a-z\d+\-.]*:)?\/\//i;

/**
 * 这个 path 是不是站外链接。
 *
 * 渲染侧要拿它决定"怎么变成链接"：站内 path 要走 `router.resolve`（hash 模式下
 * 得到 `#/system/user`，history 模式下得到 `/system/user`），外链必须原样交给浏览器。
 * 判定规则只有这一份 —— 归一化、拼接、面包屑都按它分辨内外链，别处再写一遍
 * 正则迟早和这里漂移。
 */
export function isExternalPath(path?: string): boolean {
  return !!path && ABSOLUTE_URL.test(path);
}

/** 归一化：补前导斜杠、去掉多余结尾斜杠（根路径除外）；外链原样返回 */
export function normalizeMenuPath(path?: string): string {
  if (!path) return '';
  if (isExternalPath(path)) return path;
  const slashed = path.startsWith('/') ? path : `/${path}`;
  if (slashed === '/') return '/';
  return slashed.replace(/\/+$/, '');
}

/** 父子路径拼接：子项以 `/` 开头视为绝对路径，否则挂在父级下 */
export function joinMenuPath(parentPath: string, childPath: string): string {
  if (isExternalPath(childPath)) return childPath;
  const child = normalizeMenuPath(childPath);
  if (!child) return normalizeMenuPath(parentPath);
  if (childPath.startsWith('/')) return child;
  const parent = normalizeMenuPath(parentPath);
  // child 已经带上前导斜杠，这里直接相接，避免出现 `/system//user`
  return normalizeMenuPath(parent ? `${parent}${child}` : child);
}

/**
 * 只做"名字 → 路径"的查询接口，外加可选的导航注册表操作。
 *
 * 路由表交给 `getRoutes()` 现读，而不是 `import` 生成物（`vue-router/auto-routes`）：
 * 后者是 HMR 活引用，一旦有人调用 `router.removeRoute`，下次约定路由热更新会把
 * 整张表重新 addRoute 一遍，菜单裁剪在 dev 里就被悄悄撤销了（表现是"隐藏没生效"）。
 *
 * 后两个是**可选**的注册表操作：只做菜单渲染的调用方（侧栏/标签页）不必实现，
 * 而要做"按菜单裁剪路由"的调用方（守卫装配处）必须给 ——
 * 用可选而不是新开一个接口，是为了让 router 实例一处注入两个用途，别传两份引用传歪。
 *
 * 形参必须写成 vue-router 自己的类型而不是 `unknown`：真实 `Router` 的
 * `addRoute(route: RouteRecordRaw, …)` 并不满足"能吃下任意值"的签名，
 * 写宽了反而让装配处传不进来了（参数逆变）。
 */
export interface MenuPathRouter {
  addRoute?: (route: RouteRecordRaw, parentName?: string) => unknown;
  getRoutes?: () => { path: string }[];
  hasRoute(name: string): boolean;
  removeRoute?: (name: string) => void;
  resolve(to: { name: string }): { path: string };
}

interface RouteIndex {
  known(path: string): boolean;
  pathOfName(name: string): string | undefined;
  pathsBySegment(segment: string): string[];
}

/** 兜底 404 记录与错误页不参与猜测，否则任何片段都能"匹配上" */
const UNROUTABLE = /^\/(error|:pathMatch)/;

function buildRouteIndex(router: MenuPathRouter): RouteIndex {
  const paths = new Set<string>();
  const bySegment = new Map<string, string[]>();

  for (const record of router.getRoutes?.() ?? []) {
    const path = normalizeMenuPath(record.path);
    if (!path || UNROUTABLE.test(path)) continue;
    paths.add(path);
    const segment = path.split('/').filter(Boolean).pop();
    if (!segment) continue;
    const bucket = bySegment.get(segment);
    if (bucket) bucket.push(path);
    else bySegment.set(segment, [path]);
  }

  return {
    known: (path) => paths.has(normalizeMenuPath(path)),
    pathOfName: (name) => {
      if (!router.hasRoute(name)) return undefined;
      // 路由表用了 `RouteRecordRaw` 的字面量联合类型，name 是宽 string，需要断言
      return normalizeMenuPath(router.resolve({ name }).path);
    },
    pathsBySegment: (segment) => bySegment.get(segment) ?? [],
  };
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
   * 没有图标的菜单项也占一个图标位。
   *
   * 侧边栏（inline）是一列文字对齐的东西：只要有一项没图标，它的文字就会比
   * 邻居更靠左，整列看起来"参差不齐"；深层级再叠上 antd 自己的 padding-left
   * 更明显。传 true 时给缺图标的项补一个由 antd 托管尺寸的槽位
   * （`.ant-menu-item-icon` 的 min-width 与它到标题的 margin 都来自 antd 的 token，
   * 所以槽位和真图标完全等宽，不靠这里猜像素）。
   *
   * 顶栏的横向导航默认不开：那里没有图标就是不该留空白，宽度要留给文字。
   */
  keepIconSlot?: boolean;
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
  const {
    keepIconSlot = false,
    maxDepth = Infinity,
    withChildren = true,
  } = options;

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
      else if (keepIconSlot) item.icon = () => h('span');

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
